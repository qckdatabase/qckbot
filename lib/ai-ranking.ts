import OpenAI from 'openai'
import { getSiteMetrics, getKeywords } from './ahrefs'

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

export interface ThemeResult {
  theme: string
  keyword: string
  category: string
  rankings: RankingEntry[]
  user_rank: number | null
}

export interface MultiThemeRankingResult {
  store: string
  themes: ThemeResult[]
  visibility_score: number
  avg_rank: number | null
  ranked_in_count: number
  total_themes: number
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

const CATEGORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    category: {
      type: 'string',
      description: `Category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
    },
  },
  required: ['category'],
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

interface ClassifyOutput {
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

async function classifyKeyword(keyword: string, brands: string[]): Promise<string> {
  const response = await getClient().responses.create({
    model: 'gpt-4o',
    input: [
      {
        role: 'system',
        content:
          `Classify the shopper search query into one of these categories: ${VALID_CATEGORIES.join(', ')}. JSON only.`,
      },
      {
        role: 'user',
        content: `Query: "${keyword}"\nTop brands found: ${brands.slice(0, 10).join(', ')}`,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'category',
        strict: true,
        schema: CATEGORY_SCHEMA as Record<string, unknown>,
      },
    },
    max_output_tokens: 256,
  })

  const text = response.output_text ?? ''
  try {
    const parsed = JSON.parse(text) as ClassifyOutput
    return parsed.category
  } catch {
    return 'Other'
  }
}

function flagUserEntry(rankings: Stage1Output['rankings'], store: string): Stage2Entry[] {
  const storeDomain = normalizeDomain(store)
  return rankings.map((r) => ({
    ...r,
    domain: normalizeDomain(r.domain),
    isUser: normalizeDomain(r.domain) === storeDomain,
  }))
}

function brandTokens(store: string): string[] {
  const root = normalizeDomain(store).split('.')[0] || ''
  const tokens = root.split(/[-_]/).filter((t) => t.length >= 3)
  return tokens.length ? tokens : [root].filter(Boolean)
}

const THEMES_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    themes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          theme: {
            type: 'string',
            description:
              'Short label for this product or service category, e.g. "running shoes" or "tax filing".',
          },
          keyword: {
            type: 'string',
            description:
              'One realistic shopper search query (2-5 words, lowercase, no brand names) representing this theme.',
          },
        },
        required: ['theme', 'keyword'],
      },
    },
  },
  required: ['themes'],
} as const

interface ThemeSeed {
  theme: string
  keyword: string
}

async function extractThemes(store: string, brandContext?: string): Promise<ThemeSeed[]> {
  const kws = await getKeywords(store, 100).catch(() => [])
  const brands = brandTokens(store)
  const realKws = kws
    .filter((k) => k.keyword && k.volume > 0 && k.position > 0 && k.position <= 50)
    .filter((k) => !brands.some((b) => k.keyword.toLowerCase().includes(b)))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 30)
    .map((k) => k.keyword)

  const seedBlock = realKws.length
    ? `Real organic keywords this store ranks for (Ahrefs, ordered by volume):\n${realKws.join('\n')}\nCluster these into 3-5 distinct shopper-facing themes.`
    : `No Ahrefs keyword data. Use web search to discover what this store actually offers (products and/or services). Identify 3-5 distinct shopper-facing themes from the live site.`

  const useWebsearch = realKws.length === 0

  const response = await getClient().responses.create({
    model: 'gpt-4o',
    tools: useWebsearch ? [{ type: 'web_search_preview' }] : [],
    input: [
      {
        role: 'system',
        content:
          `You map a store's offerings into 3-5 distinct themes (product or service categories).\n` +
          `For each theme: a short human label, plus ONE realistic shopper search query (2-5 words, lowercase, no brand names) a buyer would type to find that kind of offering.\n` +
          `Themes must be distinct from each other (cover different parts of the catalog).\n` +
          `Return ONLY valid JSON.`,
      },
      {
        role: 'user',
        content: `Store: ${store}\nBrand context: ${brandContext || '(none)'}\n\n${seedBlock}`,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'themes',
        strict: true,
        schema: THEMES_SCHEMA as Record<string, unknown>,
      },
    },
    max_output_tokens: 1024,
  })

  const text = response.output_text ?? ''
  try {
    const parsed = JSON.parse(text) as { themes: ThemeSeed[] }
    return parsed.themes
      .map((t) => ({ theme: t.theme.trim(), keyword: t.keyword.trim().toLowerCase() }))
      .filter((t) => t.theme && t.keyword)
      .slice(0, 5)
  } catch {
    throw new Error(`Theme extraction parse failed: ${text.slice(0, 200)}`)
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
  const flagged = flagUserEntry(stage1.rankings, store)
  const top = flagged.slice(0, 10)
  const [enriched, category] = await Promise.all([
    enrichWithMetrics(top),
    classifyKeyword(keyword, top.map((r) => r.brand)),
  ])
  const userEntry = enriched.find((r) => r.isUser)

  return {
    keyword,
    store,
    category,
    rankings: enriched,
    user_rank: userEntry ? userEntry.rank : null,
    generated_at: new Date().toISOString(),
  }
}

async function rankOneTheme(
  seed: ThemeSeed,
  store: string
): Promise<ThemeResult> {
  const stage1 = await groundedSearch(seed.keyword)
  const flagged = flagUserEntry(stage1.rankings, store)
  const top = flagged.slice(0, 10)
  const [enriched, category] = await Promise.all([
    enrichWithMetrics(top),
    classifyKeyword(seed.keyword, top.map((r) => r.brand)),
  ])
  const userEntry = enriched.find((r) => r.isUser)
  return {
    theme: seed.theme,
    keyword: seed.keyword,
    category,
    rankings: enriched,
    user_rank: userEntry ? userEntry.rank : null,
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let cursor = 0
  async function next() {
    while (cursor < items.length) {
      const idx = cursor++
      results[idx] = await worker(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next))
  return results
}

export async function rankAuto({
  store,
  brandContext,
}: {
  store: string
  brandContext?: string
}): Promise<MultiThemeRankingResult> {
  const seeds = await extractThemes(store, brandContext)
  if (!seeds.length) {
    throw new Error('Could not infer any offering themes for this store')
  }

  const themes = await runWithConcurrency(seeds, 3, (s) => rankOneTheme(s, store))
  const ranks = themes
    .map((t) => t.user_rank)
    .filter((r): r is number => r !== null)
  const ranked_in_count = ranks.length
  const total_themes = themes.length
  const visibility_score = total_themes ? ranked_in_count / total_themes : 0
  const avg_rank = ranks.length
    ? ranks.reduce((a, b) => a + b, 0) / ranks.length
    : null

  return {
    store,
    themes,
    visibility_score,
    avg_rank,
    ranked_in_count,
    total_themes,
    generated_at: new Date().toISOString(),
  }
}
