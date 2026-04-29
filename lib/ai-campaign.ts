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

interface CampaignTenantContext {
  domain: string
  brand_voice?: string | null
  seo_metrics?: {
    domain_rating: number
    organic_keywords: number
    backlinks: number
    est_monthly_traffic: number
  }
  competitor_domains?: string[]
}

export interface InternalLinkPool {
  products: Array<{ url: string; slug: string }>
  collections: Array<{ url: string; slug: string }>
  pages: Array<{ url: string; slug: string }>
  blogs: Array<{ url: string; slug: string }>
}

interface GenerateCounterArgs {
  tenant: CampaignTenantContext
  contentType: string
  primaryKeyword: string
  title: string
  guardrailTemplate: string
  internalLinks?: InternalLinkPool
}

export interface CounterCampaignResult {
  content: string
  competitor_reference?: {
    title: string
    url: string
    domain: string
  }
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    competitor_reference: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: 'string' },
        url: { type: 'string' },
        domain: { type: 'string' },
      },
      required: ['title', 'url', 'domain'],
    },
    content: {
      type: 'string',
      description: 'Full counter article in markdown. Starts with metadata header, then headings + body.',
    },
  },
  required: ['competitor_reference', 'content'],
} as const

interface EditCampaignArgs {
  tenant: CampaignTenantContext
  contentType: string
  primaryKeyword: string
  currentContent: string
  editInstruction: string
  internalLinks?: InternalLinkPool
}

export interface EditCampaignResult {
  content: string
  summary_of_changes: string
}

const EDIT_DELIM = '<<<<EDITED_ARTICLE>>>>'
const SUMMARY_DELIM = '<<<<SUMMARY>>>>'

export async function editCampaignContent(
  args: EditCampaignArgs
): Promise<EditCampaignResult> {
  const { tenant, contentType, primaryKeyword, currentContent, editInstruction, internalLinks } =
    args

  function fmtLinks(items: Array<{ url: string; slug: string }>, limit = 50): string {
    return items
      .slice(0, limit)
      .map((i) => `- ${i.url}`)
      .join('\n')
  }

  const linkPoolBlock = internalLinks
    ? [
        `Allowed internal links (use only these if you add new links):`,
        `Products:`,
        fmtLinks(internalLinks.products),
        `Collections:`,
        fmtLinks(internalLinks.collections),
        `Pages:`,
        fmtLinks(internalLinks.pages, 20),
        `Blogs:`,
        fmtLinks(internalLinks.blogs, 20),
      ].join('\n')
    : '(no sitemap configured — do not add new fabricated links)'

  const systemPrompt = [
    `You are an in-place article editor for ${tenant.domain}. Output the FULL revised article verbatim, with surgical edits applied.`,
    ``,
    `===== ABSOLUTE RULES =====`,
    `1. Output every paragraph, heading, list, link, and FAQ from the original UNCHANGED, except where the edit instruction explicitly modifies them.`,
    `2. Do NOT rewrite, summarize, condense, reorder, or restructure sections that the edit does not target.`,
    `3. Preserve the metadata header (Title, Proposed URL, Title Tag, Meta Description, Content Intent, Target Keyword) verbatim unless the instruction modifies metadata.`,
    `4. Preserve every existing internal link, external citation, heading hierarchy (## H2, ### H3), and bullet/list formatting.`,
    `5. First-person plural voice ("we", "our"). Never list competitor brands as alternatives.`,
    `6. New internal links must come from the allowed pool below. No fabricated URLs.`,
    ``,
    `Brand voice: ${tenant.brand_voice || '(authoritative first-person plural)'}`,
    `Content type: ${contentType}`,
    `Target keyword: ${primaryKeyword}`,
    ``,
    linkPoolBlock,
    ``,
    `===== OUTPUT FORMAT =====`,
    `Output exactly this structure with no extra text outside the delimiters:`,
    ``,
    `${EDIT_DELIM}`,
    `[full revised article markdown — every original section retained except where the edit applies]`,
    `${SUMMARY_DELIM}`,
    `[1-2 sentence summary of what changed]`,
  ].join('\n')

  const userPrompt = [
    `Edit instruction: ${editInstruction}`,
    ``,
    `Current article (preserve everything except what the instruction targets):`,
    `---ARTICLE START---`,
    currentContent,
    `---ARTICLE END---`,
  ].join('\n')

  const response = await getClient().responses.create({
    model: 'gpt-4o',
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_output_tokens: 16000,
  })

  const raw = response.output_text || ''
  const startIdx = raw.indexOf(EDIT_DELIM)
  const sumIdx = raw.indexOf(SUMMARY_DELIM)

  if (startIdx === -1 || sumIdx === -1 || sumIdx <= startIdx) {
    throw new Error(`Edit output missing delimiters. Raw: ${raw.slice(0, 200)}`)
  }

  const content = raw.slice(startIdx + EDIT_DELIM.length, sumIdx).trim()
  const summary = raw.slice(sumIdx + SUMMARY_DELIM.length).trim()

  if (!content) {
    throw new Error('Edit output produced empty article body')
  }

  return {
    content,
    summary_of_changes: summary || 'Edit applied.',
  }
}

export async function generateCounterCampaign(
  args: GenerateCounterArgs
): Promise<CounterCampaignResult> {
  const { tenant, contentType, primaryKeyword, title, guardrailTemplate, internalLinks } = args

  const competitorList =
    tenant.competitor_domains && tenant.competitor_domains.length > 0
      ? tenant.competitor_domains.join(', ')
      : '(none configured — use web search to discover competitors for this keyword)'

  function fmtLinks(items: Array<{ url: string; slug: string }>, limit = 50): string {
    return items
      .slice(0, limit)
      .map((i) => `- ${i.url}`)
      .join('\n')
  }

  const linkPoolBlock = internalLinks
    ? [
        `===== INTERNAL LINK POOL (use ONLY these real URLs) =====`,
        `Pick 5-8 most relevant for this article. Every link MUST be either an existing blog, a product, or a product collection from the lists below — all directly related to the article topic. Embed them naturally as inline markdown links in body copy. Do NOT invent URLs or paths not in this list. "Pages / guides" entries are for context only — DO NOT use them as the primary internal links.`,
        ``,
        `Products (REQUIRED — every draft must reference at least 2 actual store products from this list):`,
        fmtLinks(internalLinks.products),
        ``,
        `Collections / categories (link to relevant ones):`,
        fmtLinks(internalLinks.collections),
        ``,
        `Existing blogs (link to topically related reads):`,
        fmtLinks(internalLinks.blogs, 20),
        ``,
        `Pages / guides (context only — avoid using as internal links unless truly relevant):`,
        fmtLinks(internalLinks.pages, 20),
      ].join('\n')
    : `===== INTERNAL LINK POOL =====\n(no sitemap configured — use only the bare domain ${tenant.domain} for any internal references; do not fabricate slugs)`

  const isShoppable = contentType === 'shoppable'
  const intentLine = isShoppable
    ? `bottom-of-funnel, commercial — buyer is comparing products and ready to convert`
    : `middle-of-funnel, informational/commercial — buyer is researching solutions`

  function slugify(s: string): string {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
  }
  const keywordSlug = slugify(primaryKeyword)
  const fixedTitle = isShoppable ? primaryKeyword : title

  const systemPrompt = [
    `You are the in-house SEO content writer for ${tenant.domain}. You write AS the brand, not as an outside reviewer.`,
    ``,
    `===== HARD RULES =====`,
    `1. The article topic IS "${primaryKeyword}". Write a real ${contentType} that ranks for it.`,
    `2. NEVER recommend, compare, or list competitor brands/products as alternatives. Do NOT mention competitor names, domains, or products in the body.`,
    `3. Position ${tenant.domain} as THE solution. Use first-person plural ("we engineer", "our materials", "we design").`,
    `4. Mention competitor pages ONLY in the JSON "competitor_reference" field (not in article body). The body must read as a single-vendor authority piece, not a comparison roundup.`,
    `5. Cite EXTERNAL authoritative sources for credibility (e.g. EPA, U.S. Chamber, SCORE, government/standards bodies, university research). Never cite competitor sites as sources.`,
    `6. INTERNAL LINKING (HARD — applies to BOTH blog AND shoppable):`,
    `   a. Embed 5-8 markdown links [text](url) total in the article body, drawn from the INTERNAL LINK POOL below.`,
    `   b. AT LEAST 2 of those links MUST point to actual store PRODUCT URLs from the pool. This applies to BLOGS too — blogs are not exempt. A blog without 2+ product links is incomplete and will be rejected.`,
    `   c. Add 1-2 links to PRODUCT COLLECTION URLs from the pool when relevant.`,
    `   d. Add 1-2 links to existing BLOG URLs from the pool as related reads.`,
    `   e. Embed product links contextually inside body paragraphs (e.g. "our [waterproof menus](/products/waterproof-menus) are engineered..."). NOT only in a "related products" footer.`,
    `   f. Do NOT fabricate URLs — every href MUST appear verbatim in the pool.`,
    `   g. Before finalizing, count your markdown links. If <5 total or <2 product links, add more before returning.`,
    `7. ${isShoppable ? 'For SHOPPABLE: lead with pain point, focus on product features and use cases, name the brand product line repeatedly. DO NOT include a "Key Takeaways" section — shoppables go straight from intro to product/feature sections.' : `For BLOG: structure is FIXED:\n   - Start with "## Key Takeaways" + EXACTLY 3 bullets (no more, no less).\n   - Each bullet MUST follow this format: \`- **Lead Phrase**: explanation sentence.\` Bold lead phrase, COLON, then a single full explanation sentence. Do not skip the colon. Do not omit the bold lead phrase. Example: \`- **Versatile and Compact Format**: The A5 paper size measures 148mm x 210mm and adapts across hospitality, education, and government.\`\n   - Immediately after Key Takeaways, the OPENING SECTION (the article intro under the H1/topic heading) MUST be EXACTLY 3 paragraphs in this order:\n     P1: Topical intro — define / describe the keyword topic, set context for the reader.\n     P2: Brand intro — introduce ${tenant.domain} and our offering as the trusted solution (this is where the brand authority lands).\n     P3: Article preview — start with "In this blog, we'll examine..." (or close variant) and tell the reader what sections follow.\n   - Then H2 sections (each with intro bridge sentence + 3-6 H3 subsections), then FAQ.\n   - You MUST still cite + link to specific store products from the pool inside body sections.`}`,
    `8. End with a FAQ section. Heading MUST be EXACTLY: "## Frequently Asked Questions About ${primaryKeyword}". Then EXACTLY 5 FAQ items (### question, then answer) — no more, no less. Each answer should reinforce ${tenant.domain}'s offering.`,
    `9. WORD COUNT: minimum 2000 words in the article body (excluding metadata header). Count carefully — articles under 2000 words will be rejected. Aim for 2200-2800 to comfortably clear the floor.`,
    `10. METADATA RULES (HARD):`,
    isShoppable
      ? `   - SHOPPABLE: Title MUST equal the target keyword verbatim. Title Tag MUST be the keyword (optionally suffixed with " | ${tenant.domain}"). Proposed URL MUST be "/${keywordSlug}".`
      : `   - BLOG: Proposed URL MUST be "/${keywordSlug}" (slug derived from the keyword). Title may be SEO-shaped but MUST contain the keyword.`,
    `   - Title MUST NOT exceed 60 characters (counts apply to Title and Title Tag both). Trim until <=60.`,
    `   - Meta Description MUST NOT exceed 160 characters. Trim until <=160.`,
    ``,
    `===== EXAMPLES =====`,
    `WRONG body line: "Top picks: TerraSlate, PuffinPaper, REVLAR, Tyvek..."`,
    `RIGHT body line: "We engineer waterproof, rip-proof synthetic paper made with military-grade polymers..."`,
    ``,
    `WRONG title: "How to Counter Competitor Blogs"`,
    `RIGHT title: "Best Waterproof Menus for Restaurants in 2026 — Buyer's Guide"`,
    ``,
    `===== PROCESS =====`,
    `1. Use web_search_preview to find the top-ranking competitor page for "${primaryKeyword}". Identify what makes it rank: depth, structure, headings, intent match, schema, internal links.`,
    `   Competitors to check first: ${competitorList}`,
    `2. Draft a SUPERIOR ${contentType} on "${primaryKeyword}" — match their depth + exceed in originality, specificity, brand authority, and FAQ coverage.`,
    `3. The body must read as if ${tenant.domain} is the only vendor in the room.`,
    ``,
    `===== BRAND VOICE =====`,
    tenant.brand_voice || '(use professional, authoritative, first-person plural tone — "we", "our")',
    ``,
    `===== STRUCTURE TEMPLATE (follow) =====`,
    guardrailTemplate || '(if no template: use H2/H3 sections, lists where helpful, ending with FAQ)',
    ``,
    linkPoolBlock,
    ``,
    `===== OUTPUT FORMAT =====`,
    `Return JSON. "content" field is a complete markdown article starting with this metadata header (NO leading "---" separator):`,
    ``,
    `${fixedTitle}`,
    `Proposed URL: /${keywordSlug}`,
    `Title Tag: ${isShoppable ? primaryKeyword : `[SEO title that contains "${primaryKeyword}"]`}`,
    `Meta Description: [<=160 chars, includes "${primaryKeyword}"]`,
    `Content Intent: ${intentLine}`,
    `Target Keyword: ${primaryKeyword}`,
    ``,
    `[then article body using ## H2, ### H3, **bold**, - lists, with internal /links, ending in FAQ section]`,
    ``,
    `"competitor_reference" captures the competitor page you analyzed — used for internal tracking only, never appears in body.`,
  ].join('\n')

  const userPrompt = [
    `Tenant: ${tenant.domain}`,
    `Content type: ${contentType}`,
    `Target keyword (article topic): ${primaryKeyword}`,
    `Working title: ${title}`,
    ``,
    `Find the top-ranking competitor page for "${primaryKeyword}" and draft a SUPERIOR ${contentType} that beats it. The body must position ${tenant.domain} as the sole expert/vendor — never list or compare competitor products in body.`,
  ].join('\n')

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
        name: 'counter_campaign',
        strict: true,
        schema: SCHEMA as Record<string, unknown>,
      },
    },
    max_output_tokens: 12000,
  })

  const text = response.output_text
  if (!text) throw new Error('Counter campaign returned no output')

  let parsed: CounterCampaignResult
  try {
    parsed = JSON.parse(text) as CounterCampaignResult
  } catch {
    throw new Error(`Counter campaign parse failed: ${text.slice(0, 200)}`)
  }

  const audit = auditInternalLinks(parsed.content, internalLinks, contentType)
  if (audit.needsRetry && internalLinks) {
    console.log('[campaign] retrying with explicit link injection. previous:', audit)
    parsed = await retryWithLinkInjection({
      original: parsed,
      systemPrompt,
      userPrompt,
      pool: internalLinks,
      contentType,
      audit,
    })
  }

  parsed.content = ensureMetadataHeader(parsed.content, {
    title: fixedTitle,
    primaryKeyword,
    keywordSlug,
    isShoppable,
    intentLine,
  })

  return parsed
}

interface MetadataHeaderArgs {
  title: string
  primaryKeyword: string
  keywordSlug: string
  isShoppable: boolean
  intentLine: string
}

const META_KEYS_ORDER = [
  'title',
  'proposed url',
  'title tag',
  'meta description',
  'content intent',
  'target keyword',
]

function ensureMetadataHeader(content: string, args: MetadataHeaderArgs): string {
  const lines = content.split('\n')
  let foundMeta = 0
  for (let i = 0; i < Math.min(20, lines.length); i++) {
    const stripped = lines[i].replace(/\*\*/g, '').trim().toLowerCase()
    if (!stripped) continue
    if (META_KEYS_ORDER.some((k) => stripped.startsWith(`${k}:`))) {
      foundMeta += 1
    }
    if (stripped.startsWith('## ') || stripped.startsWith('# ')) break
  }
  if (foundMeta >= 3) return content

  const titleTag = args.isShoppable
    ? args.primaryKeyword
    : args.title
  const metaDescBase = args.isShoppable
    ? `Shop ${args.primaryKeyword} from a trusted source. Durable, fast turnaround, built for high-traffic environments.`
    : `Everything you need to know about ${args.primaryKeyword} — guide, buyer tips, and FAQs.`
  const metaDesc =
    metaDescBase.length > 160 ? metaDescBase.slice(0, 157) + '...' : metaDescBase

  const header = [
    `Title: ${args.title}`,
    `Proposed URL: /${args.keywordSlug}`,
    `Title Tag: ${titleTag}`,
    `Meta Description: ${metaDesc}`,
    `Content Intent: ${args.intentLine}`,
    `Target Keyword: ${args.primaryKeyword}`,
    '',
  ].join('\n')

  return header + '\n' + content.trim()
}

interface LinkAudit {
  total_links: number
  product_links: number
  pool_products: number
  needsRetry: boolean
}

function auditInternalLinks(
  content: string,
  pool: InternalLinkPool | undefined,
  contentType: string
): LinkAudit {
  const empty: LinkAudit = {
    total_links: 0,
    product_links: 0,
    pool_products: 0,
    needsRetry: false,
  }
  if (!pool) return empty
  const linkRe = /\[[^\]]+\]\(([^)]+)\)/g
  const hrefs: string[] = []
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(content)) !== null) {
    hrefs.push(m[1])
  }
  const productUrls = new Set(pool.products.map((p) => p.url))
  const productSlugs = new Set(pool.products.map((p) => p.slug))
  const productHits = hrefs.filter((h) => productUrls.has(h) || productSlugs.has(h))
  const audit: LinkAudit = {
    total_links: hrefs.length,
    product_links: productHits.length,
    pool_products: pool.products.length,
    needsRetry: pool.products.length > 0 && (hrefs.length < 5 || productHits.length < 2),
  }
  console.log('[campaign] link audit:', audit)
  if (audit.needsRetry) {
    console.warn(
      `[campaign] ${contentType} draft has ${productHits.length} product links / ${hrefs.length} total (need >=2 product, >=5 total).`
    )
  }
  return audit
}

interface RetryArgs {
  original: CounterCampaignResult
  systemPrompt: string
  userPrompt: string
  pool: InternalLinkPool
  contentType: string
  audit: LinkAudit
}

async function retryWithLinkInjection(args: RetryArgs): Promise<CounterCampaignResult> {
  const { original, systemPrompt, pool, contentType, audit } = args
  const productList = pool.products.slice(0, 20).map((p) => `- ${p.url}`).join('\n')
  const collectionList = pool.collections.slice(0, 10).map((c) => `- ${c.url}`).join('\n')
  const blogList = pool.blogs.slice(0, 10).map((b) => `- ${b.url}`).join('\n')

  const fixPrompt = [
    `Your previous draft had ${audit.product_links} product links and ${audit.total_links} total links — INSUFFICIENT.`,
    `Required: at least 2 product links AND at least 5 total markdown links [text](url) inserted inline in body paragraphs.`,
    ``,
    `Take your previous article BELOW and add internal links by editing body sentences.`,
    `Use markdown anchor syntax [anchor text](url). Pick anchor text from the surrounding sentence — do NOT add a separate "related products" footer.`,
    `Each href MUST appear verbatim in the lists below. Do not invent URLs.`,
    ``,
    `Required products to weave in (pick at least 2):`,
    productList,
    ``,
    `Helpful collections (pick 1-2 if relevant):`,
    collectionList,
    ``,
    `Related blogs (pick 1-2):`,
    blogList,
    ``,
    `Output the FULL revised article + competitor_reference JSON, same shape as before. Preserve all metadata and existing prose, only add inline links.`,
    ``,
    `===== PREVIOUS ARTICLE =====`,
    original.content,
  ].join('\n')

  const response = await getClient().responses.create({
    model: 'gpt-4o',
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: fixPrompt },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'counter_campaign',
        strict: true,
        schema: SCHEMA as Record<string, unknown>,
      },
    },
    max_output_tokens: 12000,
  })

  const text = response.output_text
  if (!text) {
    console.warn('[campaign] retry returned no output. keeping original.')
    return original
  }
  try {
    const retried = JSON.parse(text) as CounterCampaignResult
    const audit2 = auditInternalLinks(retried.content, pool, contentType)
    if (audit2.product_links >= audit.product_links) {
      return retried
    }
    console.warn('[campaign] retry produced no improvement. keeping original.')
    return original
  } catch {
    console.warn('[campaign] retry parse failed. keeping original.')
    return original
  }
}
