import OpenAI from 'openai'
import { getSiteMetrics } from './ahrefs'

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

export interface RankingEntry {
  rank: number
  brand: string
  domain: string
  reason: string
  url: string
  isUser: boolean
  domain_rating: number
  traffic: number
  backlinks: number
}

export interface RankingResult {
  keyword: string
  store: string
  category: string
  rankings: RankingEntry[]
  user_rank: number | null
  generated_at: string
}

const VALID_CATEGORIES = [
  'Beauty',
  'Apparel',
  'Home',
  'Wellness',
  'Office',
  'Food',
  'Pets',
  'Sports',
  'Kids',
  'Electronics',
  'Other',
] as const

const STAGE1_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rankings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rank: { type: 'integer' },
          brand: { type: 'string' },
          domain: {
            type: 'string',
            description:
              'Bare root domain of the brand site (no protocol, no path). E.g. nike.com',
          },
          reason: { type: 'string' },
          url: {
            type: 'string',
            description: 'Source URL cited from web search, or empty string if none',
          },
        },
        required: ['rank', 'brand', 'domain', 'reason', 'url'],
      },
    },
  },
  required: ['rankings'],
} as const

const STAGE2_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rankings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rank: { type: 'integer' },
          brand: { type: 'string' },
          domain: { type: 'string' },
          reason: { type: 'string' },
          url: { type: 'string' },
          isUser: { type: 'boolean' },
        },
        required: ['rank', 'brand', 'domain', 'reason', 'url', 'isUser'],
      },
    },
    category: {
      type: 'string',
      description: `Category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
    },
  },
  required: ['rankings', 'category'],
} as const

interface Stage1Output {
  rankings: Array<{
    rank: number
    brand: string
    domain: string
    reason: string
    url: string
  }>
}

type Stage2Entry = Omit<RankingEntry, 'domain_rating' | 'traffic' | 'backlinks'>

interface Stage2Output {
  rankings: Stage2Entry[]
  category: string
}

function normalizeDomain(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

async function groundedSearch(keyword: string): Promise<Stage1Output> {
  const response = await getClient().responses.create({
    model: 'gpt-4o',
    tools: [{ type: 'web_search_preview' }],
    input: [
      {
        role: 'system',
        content:
          `You are an e-commerce discovery assistant. Given a shopper's query, use web search to identify the top ~10 online stores or brands a shopper would be recommended today.\n` +
          `For each recommended brand: include the brand name, the BRAND'S ROOT DOMAIN (e.g. nike.com — the brand site itself, not the source article), the source URL cited from the web search, and a 1-sentence reason.\n` +
          `Rank purely on shopper relevance and authority for the query. Do not bias toward any particular brand.\n` +
          `Return ONLY valid JSON matching the schema.`,
      },
      { role: 'user', content: `Shopper query: "${keyword}"` },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'rankings',
        strict: true,
        schema: STAGE1_SCHEMA as Record<string, unknown>,
      },
    },
    max_output_tokens: 4096,
  })

  const text = response.output_text ?? ''
  try {
    return JSON.parse(text) as Stage1Output
  } catch {
    throw new Error(`Stage 1 parse failed: ${text.slice(0, 200)}`)
  }
}

async function classifyAndFlag(stage1: Stage1Output, store: string): Promise<Stage2Output> {
  const response = await getClient().responses.create({
    model: 'gpt-4o',
    input: [
      {
        role: 'system',
        content:
          `You are a JSON processor. Take the ranked brand list below and produce updated JSON with two additions:\n` +
          `1. Set isUser: true on the entry where brand matches the user's store "${store}" (fuzzy match on brand name is fine).\n` +
          `2. Classify the keyword's industry category from these options: ${VALID_CATEGORIES.join(', ')}.\n` +
          `Preserve all url values. Return ONLY valid JSON matching the schema.`,
      },
      {
        role: 'user',
        content: `Ranked brands from web search:\n${JSON.stringify(stage1.rankings, null, 2)}`,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'rankings',
        strict: true,
        schema: STAGE2_SCHEMA as Record<string, unknown>,
      },
    },
    max_output_tokens: 2048,
  })

  const text = response.output_text ?? ''
  try {
    return JSON.parse(text) as Stage2Output
  } catch {
    throw new Error(`Stage 2 parse failed: ${text.slice(0, 200)}`)
  }
}

const KEYWORD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    keyword: {
      type: 'string',
      description:
        'A single short shopper search query (2-5 words) that real customers would type to find this kind of store',
    },
  },
  required: ['keyword'],
} as const

async function inferKeyword(store: string, brandContext?: string): Promise<string> {
  const response = await getClient().responses.create({
    model: 'gpt-4o',
    input: [
      {
        role: 'system',
        content:
          'Given a store domain and optional brand context, return one realistic shopper search query a buyer would type to discover this category of store. Plain noun phrase. 2-5 words. Lowercase. No brand names. JSON only.',
      },
      {
        role: 'user',
        content: `Store: ${store}\nContext: ${brandContext || '(none)'}`,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'keyword',
        strict: true,
        schema: KEYWORD_SCHEMA as Record<string, unknown>,
      },
    },
    max_output_tokens: 256,
  })

  const text = response.output_text ?? ''
  try {
    const parsed = JSON.parse(text) as { keyword: string }
    return parsed.keyword.trim()
  } catch {
    throw new Error(`Keyword inference parse failed: ${text.slice(0, 200)}`)
  }
}

async function enrichWithMetrics(entries: Stage2Entry[]): Promise<RankingEntry[]> {
  return Promise.all(
    entries.map(async (e) => {
      const domain = normalizeDomain(e.domain || '')
      if (!domain) {
        return { ...e, domain, domain_rating: 0, traffic: 0, backlinks: 0 }
      }
      try {
        const m = await getSiteMetrics(domain)
        return {
          ...e,
          domain,
          domain_rating: m.domain_rating,
          traffic: m.est_monthly_traffic,
          backlinks: m.backlinks,
        }
      } catch (err) {
        console.error(`Ahrefs metrics failed for ${domain}:`, err)
        return { ...e, domain, domain_rating: 0, traffic: 0, backlinks: 0 }
      }
    })
  )
}

export async function rankByKeyword({
  keyword,
  store,
}: {
  keyword: string
  store: string
}): Promise<RankingResult> {
  const stage1 = await groundedSearch(keyword)
  const stage2 = await classifyAndFlag(stage1, store)

  const top = stage2.rankings.slice(0, 10)
  const enriched = await enrichWithMetrics(top)
  const userEntry = enriched.find((r) => r.isUser)

  return {
    keyword,
    store,
    category: stage2.category,
    rankings: enriched,
    user_rank: userEntry ? userEntry.rank : null,
    generated_at: new Date().toISOString(),
  }
}

export async function rankAuto({
  store,
  brandContext,
}: {
  store: string
  brandContext?: string
}): Promise<RankingResult> {
  const keyword = await inferKeyword(store, brandContext)
  return rankByKeyword({ keyword, store })
}
