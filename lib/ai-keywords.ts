import OpenAI from 'openai'

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set')
    }
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _client
}

export type KeywordIntent =
  | 'informational'
  | 'commercial'
  | 'transactional'
  | 'navigational'
  | 'unknown'

export type KeywordSource = 'websearch' | 'campaign' | 'seo'

export interface StoreKeyword {
  keyword: string
  intent: KeywordIntent
  page_url: string
  evidence: string
  sources: KeywordSource[]
}

export interface StoreKeywordsResult {
  store: string
  keywords: StoreKeyword[]
  generated_at: string
}

const KEYWORDS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    keywords: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          keyword: {
            type: 'string',
            description:
              'The actual keyword phrase the store targets, lowercased. 1-6 words.',
          },
          intent: {
            type: 'string',
            enum: ['informational', 'commercial', 'transactional', 'navigational'],
          },
          page_url: {
            type: 'string',
            description:
              'URL of the store page where this keyword is targeted (product, category, blog, etc.). Empty string if cannot be attributed to a single page.',
          },
          evidence: {
            type: 'string',
            description:
              'Short explanation of why this keyword is targeted by the store (e.g. appears in title tag, H1, repeated body copy, dedicated category page).',
          },
        },
        required: ['keyword', 'intent', 'page_url', 'evidence'],
      },
    },
  },
  required: ['keywords'],
} as const

interface RawKeyword {
  keyword: string
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational'
  page_url: string
  evidence: string
}

interface RawOutput {
  keywords: RawKeyword[]
}

function normalizeDomain(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

export async function findStoreKeywords({
  store,
  brandContext,
}: {
  store: string
  brandContext?: string
}): Promise<StoreKeywordsResult> {
  const normalized = normalizeDomain(store)

  const response = await getClient().responses.create({
    model: 'gpt-4o',
    tools: [{ type: 'web_search_preview' }],
    input: [
      {
        role: 'system',
        content:
          `You are an SEO keyword auditor. Use web search to inspect a store's own pages and identify the keywords the store actively targets.\n` +
          `Methodology:\n` +
          `1. Run site-restricted searches (site:${normalized} ...) and broader open searches that surface ${normalized}'s pages.\n` +
          `2. Inspect the titles, meta descriptions, headings, and snippets of category pages, product pages, and blog posts on ${normalized}.\n` +
          `3. Extract the top 20-30 keyword phrases the store appears to actively optimize for. Prioritize phrases that recur across the site or anchor a dedicated page.\n` +
          `4. For each keyword: provide the lowercased phrase, the most representative page URL on ${normalized}, the search intent, and short evidence (e.g. "anchors /collections/running-shoes title tag").\n` +
          `5. Do not invent pages. Only include keywords you can attribute to actual pages observed in search results.\n` +
          `6. Skip the brand name itself unless it appears as part of a phrase (brand + product type is OK).\n` +
          `Return ONLY valid JSON matching the schema.`,
      },
      {
        role: 'user',
        content:
          `Target site: ${normalized}\n` +
          `Brand context: ${brandContext || '(none provided — infer from the domain)'}`,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'store_keywords',
        strict: true,
        schema: KEYWORDS_SCHEMA as Record<string, unknown>,
      },
    },
    max_output_tokens: 4096,
  })

  const text = response.output_text ?? ''
  let parsed: RawOutput
  try {
    parsed = JSON.parse(text) as RawOutput
  } catch {
    throw new Error(`Store-keywords parse failed: ${text.slice(0, 200)}`)
  }

  const cleaned: StoreKeyword[] = parsed.keywords
    .map((k) => ({
      keyword: k.keyword.trim().toLowerCase(),
      intent: k.intent,
      page_url: k.page_url,
      evidence: k.evidence,
      sources: ['websearch'] as KeywordSource[],
    }))
    .filter((k) => k.keyword.length > 0)

  return {
    store: normalized,
    keywords: cleaned,
    generated_at: new Date().toISOString(),
  }
}

export interface ExternalKeyword {
  keyword: string
  source: KeywordSource
  page_url?: string
  evidence?: string
}

export function mergeKeywords(
  base: StoreKeyword[],
  external: ExternalKeyword[]
): StoreKeyword[] {
  const map = new Map<string, StoreKeyword>()
  for (const k of base) {
    map.set(k.keyword, { ...k, sources: [...k.sources] })
  }
  for (const ext of external) {
    const key = ext.keyword.trim().toLowerCase()
    if (!key) continue
    const existing = map.get(key)
    if (existing) {
      if (!existing.sources.includes(ext.source)) {
        existing.sources.push(ext.source)
      }
      if (!existing.page_url && ext.page_url) existing.page_url = ext.page_url
      if (!existing.evidence && ext.evidence) existing.evidence = ext.evidence
    } else {
      map.set(key, {
        keyword: key,
        intent: 'unknown',
        page_url: ext.page_url || '',
        evidence: ext.evidence || '',
        sources: [ext.source],
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.sources.length - a.sources.length)
}
