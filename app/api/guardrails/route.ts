import { createClient } from '@/lib/supabase/server'

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

  const { data: templates } = await supabase
    .from('guardrail_templates')
    .select('*')

  const { data: values } = await supabase
    .from('guardrail_values')
    .select('*')
    .eq('tenant_id', userData.tenant_id)

  return Response.json({
    templates: templates || [],
    values: values || [],
  })
}

export async function PUT(request: Request) {
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
  const { content_type, field_name, value } = body

  await supabase.from('guardrail_values').upsert({
    tenant_id: userData.tenant_id,
    content_type,
    field_name,
    value,
    source: 'client',
    needs_review: false,
    updated_at: new Date().toISOString(),
  })

  return Response.json({ success: true })
}
