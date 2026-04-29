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
    primary_keyword: string
  }>
  live_keywords?: {
    blogs: string[]
    products: string[]
  }
  ai_ranking?: {
    themes: Array<{
      theme: string
      keyword: string
      category: string
      user_rank: number | null
      rankings: Array<{
        rank: number
        brand: string
        domain: string
        reason: string
        isUser: boolean
        domain_rating: number
        traffic: number
        backlinks: number
      }>
    }>
    visibility_score: number
    avg_rank: number | null
    ranked_in_count: number
    total_themes: number
    generated_at: string
  } | null
  top_keywords?: Array<{
    keyword: string
    position: number
    volume: number
    difficulty: number
    url: string
  }>
  tracked_keywords?: string[]
}

export function buildRAGContext(context: TenantContext): string {
  const liveBlogs = context.live_keywords?.blogs || []
  const liveProducts = context.live_keywords?.products || []

  const formatList = (items: string[], cap = 25) =>
    items.length === 0
      ? '(none)'
      : items.slice(0, cap).map((s) => `- ${s}`).join('\n') +
        (items.length > cap ? `\n…(+${items.length - cap} more)` : '')

  return `
You are an SEO + content strategist for ${context.domain}. Be direct, specific, and analytical. Use the tenant data below to answer with concrete numbers, keyword names, and product references — never give generic advice.

===== TENANT DATA =====

SEO Metrics:
- Domain Rating: ${context.seo_metrics.domain_rating}
- Organic Keywords: ${context.seo_metrics.organic_keywords}
- Backlinks: ${context.seo_metrics.backlinks}
- Est. Monthly Traffic: ${context.seo_metrics.est_monthly_traffic}

Competitors:
${context.competitors.length === 0 ? '(none configured)' : context.competitors.map(c => `- ${c.name} (DR: ${c.domain_rating}, Traffic: ${c.traffic})`).join('\n')}

AI Ranking (latest run):
${
  !context.ai_ranking
    ? '(no AI ranking computed yet — tell user to click "Run" on the AI Ranking page)'
    : [
        `AI Visibility: ranked in ${context.ai_ranking.ranked_in_count}/${context.ai_ranking.total_themes} themes (${Math.round(context.ai_ranking.visibility_score * 100)}%)`,
        `Avg rank where present: ${context.ai_ranking.avg_rank !== null ? `#${context.ai_ranking.avg_rank.toFixed(1)}` : 'n/a'}`,
        `Generated: ${new Date(context.ai_ranking.generated_at).toISOString().slice(0, 10)}`,
        ``,
        `Per-theme breakdown:`,
        ...context.ai_ranking.themes.map((t) => {
          const rankLabel = t.user_rank ? `#${t.user_rank}` : 'NOT RANKED'
          const top3 = t.rankings
            .slice(0, 3)
            .map((r) => `${r.brand}${r.isUser ? ' (YOU)' : ''}`)
            .join(', ')
          return `  • [${t.theme}] keyword "${t.keyword}" — your rank: ${rankLabel}. Top 3: ${top3}`
        }),
      ].join('\n')
}

Top organic keywords (Ahrefs, SERP positions):
${
  !context.top_keywords || context.top_keywords.length === 0
    ? '(none cached — tell user to click "Refresh" on the SEO Metrics page)'
    : context.top_keywords
        .slice(0, 25)
        .map(
          (k) =>
            `  - "${k.keyword}" — pos #${k.position}, vol ${k.volume}, KD ${k.difficulty}${k.url ? ` (${k.url})` : ''}`
        )
        .join('\n')
}

Recent Campaigns (in this app):
${context.recent_campaigns.length === 0 ? '(none yet)' : context.recent_campaigns.map(c => `- "${c.title}" — kw: "${c.primary_keyword || '?'}" (${c.content_type}, ${c.status})`).join('\n')}

Live store products (slugs):
${formatList(liveProducts)}

Live store blog posts (slugs):
${formatList(liveBlogs)}

Content guardrails (templates):
${Object.entries(context.guardrails).map(([type, template]) => `${type}: ${template}`).join('\n') || '(default templates)'}

===== SCOPE =====

Answer anything related to: SEO, rankings, keywords, competitors, traffic, backlinks, products, store content, content campaigns, blog/shoppable strategy, content gaps, keyword cannibalization, internal linking, brand positioning.

When asked about "my products" / "my rankings" / "my keywords" — pull from the lists above (live products, recent campaigns, SEO metrics). If data is missing, say so explicitly and tell the user which tab/setting needs filling.

Only refuse if the question is clearly off-topic (e.g. cooking recipes, dating advice, math homework). For genuinely off-topic asks, respond: "I help with SEO and content strategy for ${context.domain}. Try asking about your rankings, competitors, content gaps, or campaigns."

Never refuse a question that touches the tenant data above.
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

export type CampaignIntent =
  | { type: 'campaign'; content_type: string; primary_keyword: string; title: string }
  | { type: 'edit_campaign'; campaign_hint: string; edit_instruction: string }
  | { type: 'chat' }

export async function detectCampaignIntent(
  userMessage: string,
  context: TenantContext,
  brandVoice?: string | null
): Promise<CampaignIntent> {
  const validTypes = [
    'blog',
    'shoppable',
    'listicle',
    'faq_guide',
    'llm',
    'collection_refresh',
    'location_page',
    'landing_page',
    'knowledge_center',
    'service_page',
    'blog_refresh',
  ]

  const recentCampaigns = (context.recent_campaigns || [])
    .map((c) => `${c.title} (${c.content_type}, kw: "${c.primary_keyword || '?'}")`)
    .join('; ')

  const generatedKeywords = (context.recent_campaigns || [])
    .map((c) => (c.primary_keyword || '').trim().toLowerCase())
    .filter(Boolean)

  const liveBlogs = context.live_keywords?.blogs || []
  const liveProducts = context.live_keywords?.products || []

  const fmtList = (label: string, items: string[]) => {
    const unique = Array.from(new Set(items.filter(Boolean)))
    if (unique.length === 0) return `  ${label}: (none)`
    return `  ${label}:\n${unique.slice(0, 80).map((k) => `    - "${k}"`).join('\n')}`
  }
  const trackedKeywords = context.tracked_keywords || []
  const takenKeywordsBlock = [
    fmtList('Already-generated draft keywords (in this app)', generatedKeywords),
    fmtList('Live store blog post slugs (existing published blogs)', liveBlogs),
    fmtList('Live store product slugs (existing products)', liveProducts),
    fmtList('Tracked store keywords (audited from web search + Ahrefs)', trackedKeywords),
  ].join('\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          `Classify the user message into one of three types:\n` +
          `- "campaign": user asks to generate/create/draft/counter a NEW piece of content.\n` +
          `- "edit_campaign": user asks to revise/edit/update/shorten/expand/rewrite/fix an EXISTING campaign draft. Phrases: "edit the X campaign", "shorten the intro", "rewrite the FAQ", "make it more casual", "add a section about pricing", "update the latest draft".\n` +
          `- "chat": general questions about SEO/competitors/business.\n\n` +
          `When type="campaign":\n` +
          `- content_type: one of ${validTypes.join(', ')}.\n` +
          `- primary_keyword: PRODUCT or SERVICE noun phrase. NEVER abstract phrases like "competitor analysis".\n` +
          `- title: real ranking-friendly article title targeting the keyword.\n` +
          `If user says "counter the best blog of my competitors", pick the most likely product keyword for ${context.domain}.\n\n` +
          `KEYWORD CANNIBALIZATION GUARD (HARD):\n` +
          `Pulled from FOUR sources — never overlap with any of them:\n` +
          `${takenKeywordsBlock}\n` +
          `Rules:\n` +
          `  - Never reuse an exact taken keyword from ANY of the four lists above.\n` +
          `  - Never pick a near-duplicate (singular vs plural, word-order swap, synonym) of any taken keyword.\n` +
          `  - Live blog/product slugs reflect what the store ALREADY ranks for — pick a distinct, non-overlapping keyword that targets a separate search intent.\n` +
          `  - If user explicitly requests a topic that maps to a taken keyword, broaden it to a sibling intent (e.g. "waterproof menus" already taken → use "waterproof menu covers" or "outdoor restaurant menus" instead).\n\n` +
          `When type="edit_campaign":\n` +
          `- campaign_hint: which campaign — title/keyword phrase from user, or "latest" if unspecified.\n` +
          `- edit_instruction: the actual revision request, paraphrased clearly.\n` +
          `For unused fields in any branch, return empty string "".\n\n` +
          `Tenant context:\n` +
          `- Domain: ${context.domain}\n` +
          `- Brand voice: ${brandVoice || '(none)'}\n` +
          `- Recent campaigns (candidates for edit_campaign hint matching): ${recentCampaigns || '(none)'}\n`,
      },
      { role: 'user', content: userMessage },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'campaign_intent',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: ['campaign', 'edit_campaign', 'chat'] },
            content_type: { type: 'string' },
            primary_keyword: { type: 'string' },
            title: { type: 'string' },
            campaign_hint: {
              type: 'string',
              description:
                'For edit_campaign: title/keyword phrase identifying which existing campaign to edit, or "latest"/"last" if user did not specify.',
            },
            edit_instruction: {
              type: 'string',
              description:
                'For edit_campaign: the user\'s revision request (e.g. "shorten the intro", "add an FAQ about pricing").',
            },
          },
          required: [
            'type',
            'content_type',
            'primary_keyword',
            'title',
            'campaign_hint',
            'edit_instruction',
          ],
        },
      },
    },
    max_tokens: 384,
  })

  const text = response.choices[0]?.message?.content || ''
  try {
    const parsed = JSON.parse(text) as {
      type: 'campaign' | 'edit_campaign' | 'chat'
      content_type: string
      primary_keyword: string
      title: string
      campaign_hint: string
      edit_instruction: string
    }
    if (parsed.type === 'campaign') {
      return {
        type: 'campaign',
        content_type: parsed.content_type,
        primary_keyword: parsed.primary_keyword,
        title: parsed.title,
      }
    }
    if (parsed.type === 'edit_campaign') {
      return {
        type: 'edit_campaign',
        campaign_hint: parsed.campaign_hint || 'latest',
        edit_instruction: parsed.edit_instruction,
      }
    }
    return { type: 'chat' }
  } catch {
    return { type: 'chat' }
  }
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
