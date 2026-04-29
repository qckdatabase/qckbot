import { requireTenant, requireUser } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'

export async function GET() {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: campaigns } = await db
    .from('campaigns')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })

  return Response.json({ campaigns: campaigns || [] })
}

export async function POST(request: Request) {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const body = await request.json()
  const { title, content_type, primary_keyword, generated_content } = body

  const { data: campaign, error } = await db
    .from('campaigns')
    .insert({
      tenant_id: auth.tenantId,
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
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const db = getDb()
  const body = await request.json()
  const { id, status, google_doc_url, live_url, generated_content } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) updates.status = status
  if (google_doc_url) updates.google_doc_url = google_doc_url
  if (live_url) updates.live_url = live_url
  if (generated_content) updates.generated_content = generated_content

  const { error } = await db
    .from('campaigns')
    .update(updates)
    .eq('id', id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
