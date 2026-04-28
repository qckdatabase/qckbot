import OpenAI from 'openai'

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set')
    }
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

interface TenantContext {
  tenant_id: string
  domain: string
  ahrefs_target: string
  seo_metrics: {
    domain_rating: number
    organic_keywords: number
    backlinks: number
    est_monthly_traffic: number
  }
  competitors: Array<{
    name: string
    domain_rating: number
    traffic: number
  }>
  guardrails: Record<string, string>
  recent_campaigns: Array<{
    title: string
    content_type: string
    status: string
  }>
}

export function buildRAGContext(context: TenantContext): string {
  return `
You are an SEO strategist for ${context.domain}.

Current SEO Metrics:
- Domain Rating: ${context.seo_metrics.domain_rating}
- Organic Keywords: ${context.seo_metrics.organic_keywords}
- Backlinks: ${context.seo_metrics.backlinks}
- Est. Monthly Traffic: ${context.seo_metrics.est_monthly_traffic}

Competitors:
${context.competitors.map(c => `- ${c.name} (DR: ${c.domain_rating}, Traffic: ${c.traffic})`).join('\n')}

Content Guardrails (format templates):
${Object.entries(context.guardrails).map(([type, template]) => `${type}: ${template}`).join('\n')}

Recent Campaigns:
${context.recent_campaigns.map(c => `- ${c.title} (${c.content_type}, ${c.status})`).join('\n')}

IMPORTANT: You can ONLY answer questions about this client's SEO data, competitors, campaigns, and content. If asked anything else, respond: "I can only help with your SEO and content campaigns. Ask me about your rankings, competitors, or to generate a new campaign."
`
}

export async function chatWithContext(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: TenantContext
): Promise<string> {
  const systemMessage = {
    role: 'system' as const,
    content: buildRAGContext(context),
  }

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [systemMessage, ...messages],
    max_tokens: 2000,
  })

  return response.choices[0]?.message?.content || ''
}

export async function generateCampaignContent(
  tenantContext: TenantContext,
  contentType: string,
  keyword: string,
  guardrailTemplate: string
): Promise<string> {
  const systemPrompt = `${buildRAGContext(tenantContext)}

Generate a ${contentType} for keyword: ${keyword}

Follow this format template:
${guardrailTemplate}

Output ONLY the content in plain text with markdown formatting (## for H2, ### for H3, **bold**, - for lists). Start with metadata header: Title, Proposed URL, Title Tag, Meta Description, Content Intent, Target Keyword.
`

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: systemPrompt }],
    max_tokens: 4000,
  })

  return response.choices[0]?.message?.content || ''
}
