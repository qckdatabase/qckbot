const AHREFS_API_TOKEN = process.env.AHREFS_API_TOKEN
const AHREFS_BASE_URL = 'https://api.ahrefs.com/v3'
const DEFAULT_COUNTRY = process.env.AHREFS_DEFAULT_COUNTRY || 'us'

interface AhrefsMetrics {
  domain_rating: number
  organic_keywords: number
  backlinks: number
  est_monthly_traffic: number
}

interface AhrefsKeyword {
  keyword: string
  position: number
  volume: number
  difficulty: number
  url: string
}

interface AhrefsBacklink {
  url: string
  domain_rating: number
  traffic: number
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

async function ahrefsGet<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!AHREFS_API_TOKEN) {
    throw new Error('AHREFS_API_TOKEN not configured')
  }

  const url = new URL(`${AHREFS_BASE_URL}${path}`)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${AHREFS_API_TOKEN}`,
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(
      `Ahrefs ${path} ${response.status} ${response.statusText}${body ? `: ${body.slice(0, 300)}` : ''}`
    )
  }

  return response.json() as Promise<T>
}

export async function getSiteMetrics(domain: string): Promise<AhrefsMetrics> {
  const date = todayISO()

  const [drRes, metricsRes, backlinksRes] = await Promise.all([
    ahrefsGet<{ domain_rating: { domain_rating: number | null } }>(
      '/site-explorer/domain-rating',
      { target: domain, date, protocol: 'both' }
    ),
    ahrefsGet<{ metrics: { org_keywords: number; org_traffic: number } }>(
      '/site-explorer/metrics',
      { target: domain, date, mode: 'subdomains', protocol: 'both' }
    ),
    ahrefsGet<{ metrics: { live: number; live_refdomains: number } }>(
      '/site-explorer/backlinks-stats',
      { target: domain, date }
    ),
  ])

  return {
    domain_rating: drRes.domain_rating?.domain_rating ?? 0,
    organic_keywords: metricsRes.metrics?.org_keywords ?? 0,
    backlinks: backlinksRes.metrics?.live_refdomains ?? 0,
    est_monthly_traffic: metricsRes.metrics?.org_traffic ?? 0,
  }
}

export async function getKeywords(domain: string, limit = 100): Promise<AhrefsKeyword[]> {
  const date = todayISO()
  const data = await ahrefsGet<{
    keywords: Array<{
      keyword: string
      best_position: number | null
      volume: number | null
      keyword_difficulty: number | null
      best_position_url: string | null
    }>
  }>('/site-explorer/organic-keywords', {
    target: domain,
    date,
    country: DEFAULT_COUNTRY,
    select: 'keyword,best_position,volume,keyword_difficulty,best_position_url',
    order_by: 'volume:desc',
    limit: String(limit),
    mode: 'subdomains',
    protocol: 'both',
  })

  return (data.keywords || []).map((k) => ({
    keyword: k.keyword,
    position: k.best_position ?? 0,
    volume: k.volume ?? 0,
    difficulty: k.keyword_difficulty ?? 0,
    url: k.best_position_url ?? '',
  }))
}

export async function getBacklinks(domain: string, limit = 100): Promise<AhrefsBacklink[]> {
  const data = await ahrefsGet<{
    backlinks: Array<{
      url_from: string
      domain_rating_source: number | null
      traffic_domain: number | null
    }>
  }>('/site-explorer/all-backlinks', {
    target: domain,
    select: 'url_from,domain_rating_source,traffic_domain',
    order_by: 'domain_rating_source:desc',
    limit: String(limit),
    mode: 'subdomains',
    protocol: 'both',
    aggregation: '1_per_domain',
    history: 'live',
  })

  return (data.backlinks || []).map((b) => ({
    url: b.url_from,
    domain_rating: b.domain_rating_source ?? 0,
    traffic: b.traffic_domain ?? 0,
  }))
}
