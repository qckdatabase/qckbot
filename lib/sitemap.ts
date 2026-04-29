const MAX_URLS = 5000
const FETCH_TIMEOUT_MS = 8000

async function fetchWithTimeout(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'qckbot-seo/1.0' },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function extractTagValues(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1].trim())
  }
  return out
}

export async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  const visited = new Set<string>()
  const urls: string[] = []

  async function crawl(url: string, depth = 0) {
    if (depth > 4 || visited.has(url) || urls.length >= MAX_URLS) return
    visited.add(url)

    const body = await fetchWithTimeout(url)
    if (!body) return

    if (/<sitemapindex/i.test(body)) {
      const childSitemaps = extractTagValues(body, 'loc').slice(0, 30)
      await Promise.all(childSitemaps.map((s) => crawl(s, depth + 1)))
      return
    }

    const locs = extractTagValues(body, 'loc')
    for (const loc of locs) {
      if (urls.length >= MAX_URLS) break
      urls.push(loc)
    }
  }

  await crawl(sitemapUrl)
  return urls
}

export interface InternalLinkCandidate {
  url: string
  slug: string
  category: 'product' | 'collection' | 'page' | 'blog' | 'other'
}

export function categorizeUrls(urls: string[]): InternalLinkCandidate[] {
  return urls.map((url) => {
    let slug = url
    try {
      const u = new URL(url)
      slug = u.pathname
    } catch {
      // keep as-is
    }
    let category: InternalLinkCandidate['category'] = 'other'
    if (/\/(products?|shop|store|item|items)\//i.test(slug)) {
      category = 'product'
    } else if (
      /\/(collections?|categor(?:y|ies)|shop-by|department|catalog)\//i.test(slug)
    ) {
      category = 'collection'
    } else if (
      /\/(blogs?|articles?|news|posts?|learn|guides?|resources?|insights?)\//i.test(slug)
    ) {
      category = 'blog'
    } else if (/\/pages?\//i.test(slug)) {
      category = 'page'
    }

    return { url, slug, category }
  })
}

export async function getInternalLinkPool(sitemapUrl: string | null | undefined): Promise<{
  products: InternalLinkCandidate[]
  collections: InternalLinkCandidate[]
  pages: InternalLinkCandidate[]
  blogs: InternalLinkCandidate[]
}> {
  if (!sitemapUrl) {
    return { products: [], collections: [], pages: [], blogs: [] }
  }
  const urls = await fetchSitemapUrls(sitemapUrl)
  const categorized = categorizeUrls(urls)
  const others = categorized.filter((c) => c.category === 'other')
  if (
    categorized.filter((c) => c.category === 'blog').length === 0 &&
    others.length > 0
  ) {
    console.log(
      '[sitemap] no blogs categorized. Sample uncategorized slugs:',
      others.slice(0, 15).map((o) => o.slug)
    )
  }
  console.log('[sitemap] total urls fetched:', urls.length, 'sitemap_url:', sitemapUrl)
  return {
    products: categorized.filter((c) => c.category === 'product').slice(0, 80),
    collections: categorized.filter((c) => c.category === 'collection').slice(0, 40),
    pages: categorized.filter((c) => c.category === 'page').slice(0, 30),
    blogs: categorized.filter((c) => c.category === 'blog').slice(0, 30),
  }
}

export function slugToKeyword(slug: string): string {
  const last = slug
    .split('/')
    .filter(Boolean)
    .pop()
    ?.replace(/\.[^.]+$/, '') ?? ''
  return last
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

export interface LiveKeywords {
  blogs: string[]
  products: string[]
}

export async function getLiveKeywords(sitemapUrl: string | null | undefined): Promise<LiveKeywords> {
  if (!sitemapUrl) return { blogs: [], products: [] }
  const pool = await getInternalLinkPool(sitemapUrl)
  const dedupe = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)))
  return {
    blogs: dedupe(pool.blogs.map((b) => slugToKeyword(b.slug))),
    products: dedupe(pool.products.map((p) => slugToKeyword(p.slug))),
  }
}
