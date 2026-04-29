import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'
import { checkSerp } from '@/lib/ai-serp'

export const maxDuration = 180

interface KeywordRow {
  id: string
  keyword: string
  created_at: string
}

interface CheckRow {
  keyword_id: string
  position: number | null
  top_url: string | null
  checked_at: string
}

export async function GET() {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: keywords, error: kwErr } = await db
    .from('serp_tracked_keywords')
    .select('id, keyword, created_at')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false }) as {
      data: KeywordRow[] | null
      error: { message: string } | null
    }

  if (kwErr) {
    return NextResponse.json({ error: kwErr.message }, { status: 500 })
  }

  const list = keywords || []
  const ids = list.map((k) => k.id)

  let latestByKeyword = new Map<string, CheckRow>()
  if (ids.length > 0) {
    const { data: checks } = await db
      .from('serp_checks')
      .select('keyword_id, position, top_url, checked_at')
      .in('keyword_id', ids)
      .order('checked_at', { ascending: false }) as {
        data: CheckRow[] | null
        error: { message: string } | null
      }

    for (const row of checks || []) {
      if (!latestByKeyword.has(row.keyword_id)) {
        latestByKeyword.set(row.keyword_id, row)
      }
    }
  }

  return NextResponse.json({
    keywords: list.map((k) => {
      const latest = latestByKeyword.get(k.id)
      return {
        id: k.id,
        keyword: k.keyword,
        created_at: k.created_at,
        latest_position: latest?.position ?? null,
        latest_top_url: latest?.top_url ?? null,
        latest_checked_at: latest?.checked_at ?? null,
      }
    }),
  })
}

export async function POST(req: Request) {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  let body: { keyword?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const keyword = (body.keyword || '').trim()
  if (!keyword) {
    return NextResponse.json({ error: 'Keyword is required' }, { status: 400 })
  }
  if (keyword.length > 200) {
    return NextResponse.json({ error: 'Keyword too long (max 200 chars)' }, { status: 400 })
  }

  const db = getDb()
  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .select('domain, ahrefs_target')
    .eq('id', auth.tenantId)
    .single() as {
      data: { domain: string | null; ahrefs_target: string | null } | null
      error: { message: string } | null
    }

  if (tenantErr) {
    return NextResponse.json({ error: `Tenant query failed: ${tenantErr.message}` }, { status: 500 })
  }

  const targetDomain = tenant?.domain || tenant?.ahrefs_target
  if (!targetDomain) {
    return NextResponse.json(
      { error: 'Tenant domain not configured. Set domain or ahrefs_target in onboarding.' },
      { status: 400 }
    )
  }

  const { data: existing, error: upsertErr } = await db
    .from('serp_tracked_keywords')
    .upsert(
      { tenant_id: auth.tenantId, keyword },
      { onConflict: 'tenant_id,keyword', ignoreDuplicates: false }
    )
    .select('id, keyword, created_at')
    .single() as {
      data: KeywordRow | null
      error: { message: string } | null
    }

  if (upsertErr || !existing) {
    return NextResponse.json(
      { error: `Failed to register keyword: ${upsertErr?.message || 'unknown'}` },
      { status: 500 }
    )
  }

  try {
    const result = await checkSerp({ keyword, domain: targetDomain })
    const { error: insertErr } = await db.from('serp_checks').insert({
      keyword_id: existing.id,
      position: result.position,
      top_url: result.top_url,
      results: result.results,
    })
    if (insertErr) {
      console.error('serp_checks insert failed:', insertErr)
    }
    return NextResponse.json({
      id: existing.id,
      keyword: existing.keyword,
      created_at: existing.created_at,
      latest_position: result.position,
      latest_top_url: result.top_url,
      latest_checked_at: result.checked_at,
    })
  } catch (error) {
    console.error('SERP check error:', error)
    const message = error instanceof Error ? error.message : 'Failed to check SERP'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
