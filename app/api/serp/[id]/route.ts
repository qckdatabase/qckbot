import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'
import { checkSerp } from '@/lib/ai-serp'

export const maxDuration = 180

interface KeywordRow {
  id: string
  tenant_id: string
  keyword: string
  created_at: string
}

async function loadKeyword(id: string, tenantId: string) {
  const db = getDb()
  const { data, error } = await db
    .from('serp_tracked_keywords')
    .select('id, tenant_id, keyword, created_at')
    .eq('id', id)
    .single() as { data: KeywordRow | null; error: { message: string } | null }

  if (error || !data) return null
  if (data.tenant_id !== tenantId) return null
  return data
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  const kw = await loadKeyword(id, auth.tenantId)
  if (!kw) return NextResponse.json({ error: 'Keyword not found' }, { status: 404 })

  const db = getDb()
  const { data: tenant } = await db
    .from('tenants')
    .select('domain, ahrefs_target')
    .eq('id', auth.tenantId)
    .single() as {
      data: { domain: string | null; ahrefs_target: string | null } | null
    }

  const targetDomain = tenant?.domain || tenant?.ahrefs_target
  if (!targetDomain) {
    return NextResponse.json({ error: 'Tenant domain not configured.' }, { status: 400 })
  }

  try {
    const result = await checkSerp({ keyword: kw.keyword, domain: targetDomain })
    const { error: insertErr } = await db.from('serp_checks').insert({
      keyword_id: kw.id,
      position: result.position,
      top_url: result.top_url,
      results: result.results,
    })
    if (insertErr) {
      console.error('serp_checks insert failed:', insertErr)
    }
    return NextResponse.json({
      id: kw.id,
      keyword: kw.keyword,
      created_at: kw.created_at,
      latest_position: result.position,
      latest_top_url: result.top_url,
      latest_checked_at: result.checked_at,
    })
  } catch (error) {
    console.error('SERP recheck error:', error)
    const message = error instanceof Error ? error.message : 'Failed to recheck SERP'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const { id } = await ctx.params
  const kw = await loadKeyword(id, auth.tenantId)
  if (!kw) return NextResponse.json({ error: 'Keyword not found' }, { status: 404 })

  const db = getDb()
  const { error } = await db.from('serp_tracked_keywords').delete().eq('id', kw.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
