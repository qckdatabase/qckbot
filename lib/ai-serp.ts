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

export interface SerpResult {
  position: number
  url: string
  title: string
  domain: string
}

export interface SerpCheckResult {
  keyword: string
  domain: string
  position: number | null
  top_url: string | null
  results: SerpResult[]
  checked_at: string
}

const SERP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          position: { type: 'integer' },
          url: { type: 'string' },
          title: { type: 'string' },
          domain: {
            type: 'string',
            description:
              'Bare root domain of the result (no protocol, no path). E.g. nike.com',
          },
        },
        required: ['position', 'url', 'title', 'domain'],
      },
    },
  },
  required: ['results'],
} as const

interface RawOutput {
  results: SerpResult[]
}

function normalizeDomain(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

export async function checkSerp({
  keyword,
  domain,
}: {
  keyword: string
  domain: string
}): Promise<SerpCheckResult> {
  const targetDomain = normalizeDomain(domain)
  const cleanKeyword = keyword.trim()

  if (!cleanKeyword) throw new Error('Keyword is required')
  if (!targetDomain) throw new Error('Target domain is required')

  const response = await getClient().responses.create({
    model: 'gpt-4o',
    tools: [{ type: 'web_search_preview' }],
    input: [
      {
        role: 'system',
        content:
          `You are a SERP (search engine results page) analyst. Use web search to fetch the top 20 organic Google results for a query and return them as structured JSON.\n` +
          `Rules:\n` +
          `1. Search the literal query as provided.\n` +
          `2. Return up to 20 organic results in the order they appeared. Skip ads, "people also ask" boxes, image carousels, and video carousels.\n` +
          `3. For each result, include the 1-based position, full URL, page title, and the bare ROOT DOMAIN (no protocol, no www, no path).\n` +
          `4. Do not invent results. If fewer than 20 organic listings appeared, return only what you saw.\n` +
          `Return ONLY valid JSON matching the schema.`,
      },
      {
        role: 'user',
        content: `Query: "${cleanKeyword}"`,
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'serp_results',
        strict: true,
        schema: SERP_SCHEMA as Record<string, unknown>,
      },
    },
    max_output_tokens: 4096,
  })

  const text = response.output_text ?? ''
  let parsed: RawOutput
  try {
    parsed = JSON.parse(text) as RawOutput
  } catch {
    throw new Error(`SERP parse failed: ${text.slice(0, 200)}`)
  }

  const results = parsed.results
    .map((r) => ({ ...r, domain: normalizeDomain(r.domain) }))
    .sort((a, b) => a.position - b.position)

  const match = results.find((r) => r.domain === targetDomain)

  return {
    keyword: cleanKeyword,
    domain: targetDomain,
    position: match ? match.position : null,
    top_url: match ? match.url : null,
    results,
    checked_at: new Date().toISOString(),
  }
}
