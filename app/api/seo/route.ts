import { createClient } from '@/lib/supabase/server'
import { getSiteMetrics, getKeywords, getBacklinks } from '@/lib/ahrefs'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!userData?.tenant_id) {
    return Response.json({ error: 'No tenant' }, { status: 400 })
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('domain, ahrefs_target')
    .eq('id', userData.tenant_id)
    .single()

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

    await supabase.from('seo_metrics').upsert({
      tenant_id: userData.tenant_id,
      snapshot_date: today,
      domain_rating: metrics.domain_rating,
      organic_keywords: metrics.organic_keywords,
      backlinks: metrics.backlinks,
      est_monthly_traffic: metrics.est_monthly_traffic,
    })

    const { data: historicalMetrics } = await supabase
      .from('seo_metrics')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .order('snapshot_date', { ascending: true })
      .limit(12)

    return Response.json({
      current: metrics,
      keywords: keywords.slice(0, 20),
      backlinks: backlinks.slice(0, 20),
      historical: historicalMetrics || [],
    })
  } catch (error) {
    console.error('Ahrefs API error:', error)
    return Response.json({ error: 'Failed to fetch SEO data' }, { status: 500 })
  }
}
