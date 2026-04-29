import { NextResponse } from 'next/server'
import { requireUser, requireAdmin } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: templates, error } = await db
    .from('guardrail_templates')
    .select('content_type, field_name, template_content')
    .order('content_type', { ascending: true })
    .order('field_name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ templates: templates || [] })
}

export async function PUT(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const db = getDb()
  const body = await request.json()
  const { content_type, field_name, template_content } = body

  if (!content_type || !field_name || typeof template_content !== 'string') {
    return NextResponse.json(
      { error: 'content_type, field_name, and template_content required' },
      { status: 400 }
    )
  }

  const { error } = await db
    .from('guardrail_templates')
    .upsert(
      { content_type, field_name, template_content },
      { onConflict: 'content_type,field_name' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const content_type = searchParams.get('content_type')
  const field_name = searchParams.get('field_name')

  if (!content_type) {
    return NextResponse.json({ error: 'content_type required' }, { status: 400 })
  }

  const db = getDb()
  let query = db.from('guardrail_templates').delete().eq('content_type', content_type)
  if (field_name) {
    query = query.eq('field_name', field_name)
  }

  const { error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
