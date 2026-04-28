import { createClient } from '@/lib/supabase/server'
import { chatWithContext } from '@/lib/openai'

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

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('tenant_id', userData.tenant_id)
    .order('created_at', { ascending: true })

  return Response.json({ messages: messages || [] })
}

export async function POST(request: Request) {
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

  const body = await request.json()
  const { content } = body

  await supabase.from('chat_messages').insert({
    tenant_id: userData.tenant_id,
    role: 'user',
    content,
  })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', userData.tenant_id)
    .single()

  const { data: seoMetrics } = await supabase
    .from('seo_metrics')
    .select('*')
    .eq('tenant_id', userData.tenant_id)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  const { data: competitors } = await supabase
    .from('competitors')
    .select('name, domain_rating, traffic')
    .eq('tenant_id', userData.tenant_id)
    .limit(10)

  const { data: guardrailValues } = await supabase
    .from('guardrail_values')
    .select('content_type, field_name, value')
    .eq('tenant_id', userData.tenant_id)

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('title, content_type, status')
    .eq('tenant_id', userData.tenant_id)
    .limit(10)

  const guardrailsMap: Record<string, string> = {}
  guardrailValues?.forEach((g: { content_type: string; field_name: string; value: string }) => {
    if (!guardrailsMap[g.content_type]) {
      guardrailsMap[g.content_type] = ''
    }
    guardrailsMap[g.content_type] += `\n${g.field_name}: ${g.value}`
  })

  const context = {
    tenant_id: userData.tenant_id,
    domain: tenant?.domain || tenant?.ahrefs_target || '',
    ahrefs_target: tenant?.ahrefs_target || '',
    seo_metrics: seoMetrics ? {
      domain_rating: seoMetrics.domain_rating || 0,
      organic_keywords: seoMetrics.organic_keywords || 0,
      backlinks: seoMetrics.backlinks || 0,
      est_monthly_traffic: seoMetrics.est_monthly_traffic || 0,
    } : { domain_rating: 0, organic_keywords: 0, backlinks: 0, est_monthly_traffic: 0 },
    competitors: competitors || [],
    guardrails: guardrailsMap,
    recent_campaigns: campaigns || [],
  }

  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('tenant_id', userData.tenant_id)
    .order('created_at', { ascending: true })
    .limit(20)

  const messages = (history || []).map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const response = await chatWithContext(messages, context)

  await supabase.from('chat_messages').insert({
    tenant_id: userData.tenant_id,
    role: 'assistant',
    content: response,
  })

  return Response.json({ response })
}
