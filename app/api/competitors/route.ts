import { createClient } from '@/lib/supabase/server'
import { getCompetitors } from '@/lib/ahrefs'

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

  const { data: competitors } = await supabase
    .from('competitors')
    .select('*')
    .eq('tenant_id', userData.tenant_id)
    .order('domain_rating', { ascending: false })

  return Response.json({ competitors: competitors || [] })
}

export async function POST() {
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
    .select('ahrefs_target')
    .eq('id', userData.tenant_id)
    .single()

  if (!tenant?.ahrefs_target) {
    return Response.json({ error: 'No Ahrefs target configured' }, { status: 400 })
  }

  try {
    const competitors = await getCompetitors(tenant.ahrefs_target)

    const competitorRows = competitors.map(c => ({
      tenant_id: userData.tenant_id,
      name: c.domain,
      domain: c.domain,
      domain_rating: c.domain_rating,
      traffic: c.traffic,
      backlinks: c.backlinks,
      last_fetched: new Date().toISOString(),
    }))

    await supabase.from('competitors').delete().eq('tenant_id', userData.tenant_id)
    await supabase.from('competitors').insert(competitorRows)

    return Response.json({ success: true, count: competitorRows.length })
  } catch (error) {
    console.error('Ahrefs API error:', error)
    return Response.json({ error: 'Failed to refresh competitors' }, { status: 500 })
  }
}
