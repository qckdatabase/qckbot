const AHFREFS_API_KEY = process.env.AHFREFS_API_KEY
const AHFREFS_BASE_URL = 'https://api.ahrefs.com/v3'

interface AhrefsMetrics {
  domain_rating: number
  organic_keywords: number
  backlinks: number
  est_monthly_traffic: number
}

interface AhrefsCompetitor {
  domain: string
  domain_rating: number
  traffic: number
  backlinks: number
}

interface AhrefsKeyword {
  keyword: string
  position: number
  volume: number
  difficulty: number
  url: string
}

export async function getSiteMetrics(domain: string): Promise<AhrefsMetrics> {
  const url = new URL(`${AHFREFS_BASE_URL}/site-explorer/overview`)
  url.searchParams.set('target', domain)
  url.searchParams.set('mode', 'domain')

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${AHFREFS_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Ahrefs API error: ${response.statusText}`)
  }

  const data = await response.json()

  return {
    domain_rating: data.domain_rating || 0,
    organic_keywords: data.organic_keywords || 0,
    backlinks: data.refdomains || 0,
    est_monthly_traffic: data.organic_traffic || 0,
  }
}

export async function getCompetitors(domain: string): Promise<AhrefsCompetitor[]> {
  const url = new URL(`${AHFREFS_BASE_URL}/site-explorer/competitors`)
  url.searchParams.set('target', domain)
  url.searchParams.set('mode', 'domain')

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${AHFREFS_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Ahrefs API error: ${response.statusText}`)
  }

  const data = await response.json()

  return (data.competitors || []).map((c: AhrefsCompetitor) => ({
    domain: c.domain,
    domain_rating: c.domain_rating || 0,
    traffic: c.traffic || 0,
    backlinks: c.backlinks || 0,
  }))
}

export async function getKeywords(domain: string, limit = 100): Promise<AhrefsKeyword[]> {
  const url = new URL(`${AHFREFS_BASE_URL}/site-explorer/keywords`)
  url.searchParams.set('target', domain)
  url.searchParams.set('mode', 'domain')
  url.searchParams.set('limit', limit.toString())

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${AHFREFS_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Ahrefs API error: ${response.statusText}`)
  }

  const data = await response.json()

  return (data.keywords || []).map((k: AhrefsKeyword) => ({
    keyword: k.keyword,
    position: k.position || 0,
    volume: k.volume || 0,
    difficulty: k.difficulty || 0,
    url: k.url || '',
  }))
}

export async function getBacklinks(domain: string, limit = 100): Promise<Array<{
  url: string
  domain_rating: number
  traffic: number
}>> {
  const url = new URL(`${AHFREFS_BASE_URL}/site-explorer/backlinks`)
  url.searchParams.set('target', domain)
  url.searchParams.set('mode', 'domain')
  url.searchParams.set('limit', limit.toString())

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${AHFREFS_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Ahrefs API error: ${response.statusText}`)
  }

  const data = await response.json()

  return (data.backlinks || []).map((b: { url: string; domain_rating: number; traffic: number }) => ({
    url: b.url,
    domain_rating: b.domain_rating || 0,
    traffic: b.traffic || 0,
  }))
}
