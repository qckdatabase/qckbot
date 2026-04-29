import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'

export async function POST(req: Request) {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  let body: { keywords?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(body.keywords)) {
    return NextResponse.json({ error: 'keywords must be an array of strings' }, { status: 400 })
  }

  const cleaned = (body.keywords as unknown[])
    .filter((k): k is string => typeof k === 'string')
    .map((k) => k.trim())
    .filter((k) => k.length > 0 && k.length <= 200)

  const unique = Array.from(new Set(cleaned.map((k) => k.toLowerCase()))).slice(0, 100)
  if (unique.length === 0) {
    return NextResponse.json({ error: 'No valid keywords to import' }, { status: 400 })
  }

  const db = getDb()
  const rows = unique.map((keyword) => ({ tenant_id: auth.tenantId, keyword }))

  const { data, error } = await db
    .from('serp_tracked_keywords')
    .upsert(rows, { onConflict: 'tenant_id,keyword', ignoreDuplicates: true })
    .select('id, keyword, created_at') as {
      data: Array<{ id: string; keyword: string; created_at: string }> | null
      error: { message: string } | null
    }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    imported: data?.length ?? 0,
    requested: unique.length,
    keywords: data || [],
  })
}
