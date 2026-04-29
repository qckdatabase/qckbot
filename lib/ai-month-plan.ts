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

export interface MonthPlanItem {
  primary_keyword: string
  title: string
  content_type: 'blog' | 'shoppable'
}

interface PlanMonthArgs {
  domain: string
  brandVoice?: string | null
  takenKeywords: string[]
  liveBlogKeywords: string[]
  liveProductKeywords: string[]
  trackedKeywords?: string[]
  count: number
}

const VALID_TYPES = ['blog', 'shoppable'] as const

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          primary_keyword: { type: 'string' },
          title: { type: 'string' },
          content_type: { type: 'string', enum: VALID_TYPES },
        },
        required: ['primary_keyword', 'title', 'content_type'],
      },
    },
  },
  required: ['items'],
} as const

export async function planMonth(args: PlanMonthArgs): Promise<MonthPlanItem[]> {
  const {
    domain,
    brandVoice,
    takenKeywords,
    liveBlogKeywords,
    liveProductKeywords,
    trackedKeywords = [],
    count,
  } = args

  const fmtList = (label: string, items: string[]) => {
    const unique = Array.from(new Set(items.filter(Boolean)))
    if (unique.length === 0) return `  ${label}: (none)`
    return `  ${label}:\n${unique.slice(0, 80).map((k) => `    - "${k}"`).join('\n')}`
  }

  const takenBlock = [
    fmtList('Already-generated draft keywords', takenKeywords),
    fmtList('Live store blog slugs', liveBlogKeywords),
    fmtList('Live store product slugs', liveProductKeywords),
    fmtList('Tracked store keywords (audited via web search + Ahrefs)', trackedKeywords),
  ].join('\n')

  const systemPrompt = [
    `You are an SEO content strategist for ${domain}.`,
    `Brand voice: ${brandVoice || '(authoritative first-person plural)'}`,
    ``,
    `Generate a content calendar of EXACTLY ${count} new content briefs.`,
    ``,
    `Mix:`,
    `  - ~70% blog (informational/commercial, middle of funnel) — keywords like "what is X", "best X for Y", "how to X", "X vs Y", "X buyer's guide".`,
    `  - ~30% shoppable (bottom of funnel, commercial) — keywords matching product/category nouns shoppers search when ready to buy.`,
    ``,
    `Each item:`,
    `  - primary_keyword: PRODUCT/SERVICE noun phrase searchers actually type. Specific, not abstract.`,
    `  - title: SEO-shaped article title containing the keyword (≤60 chars).`,
    `  - content_type: "blog" or "shoppable".`,
    ``,
    `KEYWORD CANNIBALIZATION GUARD (HARD):`,
    `Forbidden keywords (already targeted on this tenant — never reuse, never near-duplicate):`,
    takenBlock,
    `Rules:`,
    `  - Never reuse exact taken keyword.`,
    `  - Never near-duplicate (singular/plural swap, word-order, synonym).`,
    `  - Each of the ${count} items must target distinct, non-overlapping search intent from each other AND from forbidden lists.`,
    `  - Spread across topical clusters relevant to ${domain}'s products. Don't pick ${count} variations of the same theme.`,
    ``,
    `Return JSON: { items: [...] }. Output exactly ${count} items.`,
  ].join('\n')

  const userPrompt = `Plan ${count} content briefs for ${domain} for the next month. Mix blog + shoppable.`

  const response = await getClient().responses.create({
    model: 'gpt-4o',
    tools: [{ type: 'web_search_preview' }],
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'month_plan',
        strict: true,
        schema: SCHEMA as Record<string, unknown>,
      },
    },
    max_output_tokens: 4000,
  })

  const text = response.output_text
  if (!text) throw new Error('Month plan returned no output')

  try {
    const parsed = JSON.parse(text) as { items: MonthPlanItem[] }
    return parsed.items.slice(0, count)
  } catch {
    throw new Error(`Month plan parse failed: ${text.slice(0, 200)}`)
  }
}

export function weekdaysInMonth(year: number, month: number): Date[] {
  const dates: Date[] = []
  const d = new Date(Date.UTC(year, month - 1, 1))
  while (d.getUTCMonth() === month - 1) {
    const day = d.getUTCDay()
    if (day >= 1 && day <= 5) {
      dates.push(new Date(d))
    }
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return dates
}
