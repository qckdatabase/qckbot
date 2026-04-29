import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'

const ALLOWED_FIELDS = [
  'name',
  'domain',
  'ahrefs_target',
  'sitemap_url',
  'brand_voice',
  'google_sheet_id',
  'google_docs_folder_id',
  'slack_channel_id',
  'competitor_domains',
  'status',
] as const

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireUser()
    if (!auth.ok) return auth.response
    if (auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    for (const field of ALLOWED_FIELDS) {
      if (field in body) {
        updates[field] = body[field]
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const db = getDb()
    const { error } = await db
      .from('tenants')
      .update(updates)
      .eq('id', params.id)

    if (error) {
      console.error('[tenants PATCH] db error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[tenants PATCH] unhandled:', err)
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
