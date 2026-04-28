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

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('tenant_id', userData.tenant_id)
    .order('created_at', { ascending: false })

  return Response.json({ campaigns: campaigns || [] })
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
  const { title, content_type, primary_keyword, generated_content } = body

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      tenant_id: userData.tenant_id,
      title,
      content_type,
      primary_keyword,
      generated_content,
      status: 'generated',
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ campaign })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, status, google_doc_url, live_url, generated_content } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) updates.status = status
  if (google_doc_url) updates.google_doc_url = google_doc_url
  if (live_url) updates.live_url = live_url
  if (generated_content) updates.generated_content = generated_content

  const { error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
