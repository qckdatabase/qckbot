import { requireTenant } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'
import { getSiteMetrics, getKeywords, getBacklinks } from '@/lib/ahrefs'

interface SeoSnapshot {
  domain: string
  current: {
    domain_rating: number
    organic_keywords: number
    backlinks: number
    est_monthly_traffic: number
  }
  keywords: Array<{ keyword: string; position: number; volume: number; difficulty: number; url: string }>
  backlinks: Array<{ url: string; domain_rating: number; traffic: number }>
  historical: Array<{
    snapshot_date: string
    domain_rating: number | null
    organic_keywords: number | null
    backlinks: number | null
    est_monthly_traffic: number | null
  }>
}

async function loadHistorical(db: ReturnType<typeof getDb>, tenantId: string) {
  const { data } = await db
    .from('seo_metrics')
    .select('snapshot_date, domain_rating, organic_keywords, backlinks, est_monthly_traffic')
    .eq('tenant_id', tenantId)
    .order('snapshot_date', { ascending: true })
    .limit(12)
  return data || []
}

export async function GET() {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: latest } = await db
    .from('seo_metrics')
    .select('payload, snapshot_date')
    .eq('tenant_id', auth.tenantId)
    .not('payload', 'is', null)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { payload: SeoSnapshot; snapshot_date: string } | null }

  if (!latest?.payload) {
    return Response.json({ cached: false, data: null })
  }

  const historical = await loadHistorical(db, auth.tenantId)
  return Response.json({ ...latest.payload, historical, cached: true, snapshot_date: latest.snapshot_date })
}

export async function POST() {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: tenant } = await db
    .from('tenants')
    .select('domain, ahrefs_target')
    .eq('id', auth.tenantId)
    .single() as { data: { domain: string | null; ahrefs_target: string | null } | null }

  if (!tenant?.ahrefs_target) {
    return Response.json({ error: 'No Ahrefs target configured' }, { status: 400 })
  }

  const domain = tenant.domain || tenant.ahrefs_target

  try {
    const [metrics, keywords, backlinks] = await Promise.all([
      getSiteMetrics(domain),
      getKeywords(domain, 50),
      getBacklinks(domain, 50),
    ])

    const today = new Date().toISOString().split('T')[0]
    const historical = await loadHistorical(db, auth.tenantId)
    const payload: SeoSnapshot = {
      domain,
      current: metrics,
      keywords,
      backlinks,
      historical,
    }

    const { error: upsertErr } = await db.from('seo_metrics').upsert(
      {
        tenant_id: auth.tenantId,
        snapshot_date: today,
        domain_rating: metrics.domain_rating,
        organic_keywords: metrics.organic_keywords,
        backlinks: metrics.backlinks,
        est_monthly_traffic: metrics.est_monthly_traffic,
        payload,
      },
      { onConflict: 'tenant_id,snapshot_date' }
    )
    if (upsertErr) {
      console.error('seo_metrics upsert failed:', upsertErr)
    }

    const updatedHistorical = await loadHistorical(db, auth.tenantId)

    return Response.json({ ...payload, historical: updatedHistorical, cached: false })
  } catch (error) {
    console.error('Ahrefs API error:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch SEO data'
    return Response.json({ error: message }, { status: 500 })
  }
}
