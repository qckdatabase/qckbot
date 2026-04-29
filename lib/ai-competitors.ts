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

export interface OrganicCompetitor {
  rank: number
  brand: string
  domain: string
  reason: string
  url: string
  shared_keywords: string[]
  domain_rating: number
}

export interface OrganicCompetitorsResult {
  store: string
  competitors: OrganicCompetitor[]
  generated_at: string
}

const COMPETITORS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    competitors: {
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
              'Bare root domain of the competitor site (no protocol, no path). E.g. nike.com',
          },
          reason: {
            type: 'string',
            description:
              'One sentence explaining why this site competes organically with the target store (shared keyword themes, overlapping SERPs, similar product category).',
          },
          url: {
            type: 'string',
            description: 'Source URL cited from web search, or empty string if none',
          },
          shared_keywords: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Up to 5 keyword themes or queries this competitor shares organic visibility on with the target store.',
          },
          domain_rating: {
            type: 'integer',
            description:
              'Estimated domain authority on a 0-100 scale, inferred from how often and how prominently this site appears in organic results during the web search. Best guess; integer.',
          },
        },
        required: ['rank', 'brand', 'domain', 'reason', 'url', 'shared_keywords', 'domain_rating'],
      },
    },
  },
  required: ['competitors'],
} as const

interface RawOutput {
  competitors: OrganicCompetitor[]
}

function normalizeDomain(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

export async function findOrganicCompetitors({
  store,
  brandContext,
}: {
  store: string
  brandContext?: string
}): Promise<OrganicCompetitorsResult> {
  const normalized = normalizeDomain(store)

  const response = await getClient().responses.create({
    model: 'gpt-4o',
    tools: [{ type: 'web_search_preview' }],
    input: [
      {
        role: 'system',
        content:
          `You are an SEO competitive analyst. Use web search to identify the top 10 ORGANIC SEARCH competitors for a given target site.\n` +
          `Organic competitors are sites that rank in Google's organic results for the SAME or HIGHLY OVERLAPPING keyword set as the target — not just brands in the same category, but sites you would actually find on the same SERPs.\n` +
          `Methodology:\n` +
          `1. Identify 3-6 representative head/torso keywords the target site likely ranks for, based on its niche.\n` +
          `2. Search those keywords on the open web. Note which non-target domains repeatedly appear in organic results (skip ads, marketplaces like Amazon/eBay/Etsy unless they are the only obvious competitor).\n` +
          `3. Return the 10 most consistent overlapping organic competitors, ranked by overlap strength.\n` +
          `For each competitor: brand name, ROOT DOMAIN of the competitor itself (not source article), 1-sentence reason citing the overlap, source URL from web search, up to 5 shared keyword themes, and an estimated domain_rating 0-100 based on how often and prominently the site appeared in organic results.\n` +
          `Exclude the target site itself. Do not invent domains — only include sites you actually saw in search results.\n` +
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
        name: 'organic_competitors',
        strict: true,
        schema: COMPETITORS_SCHEMA as Record<string, unknown>,
      },
    },
    max_output_tokens: 4096,
  })

  const text = response.output_text ?? ''
  let parsed: RawOutput
  try {
    parsed = JSON.parse(text) as RawOutput
  } catch {
    throw new Error(`Organic-competitors parse failed: ${text.slice(0, 200)}`)
  }

  const cleaned = parsed.competitors
    .map((c) => ({ ...c, domain: normalizeDomain(c.domain) }))
    .filter((c) => c.domain && c.domain !== normalized)
    .slice(0, 10)

  return {
    store: normalized,
    competitors: cleaned,
    generated_at: new Date().toISOString(),
  }
}
