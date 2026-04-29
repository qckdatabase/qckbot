import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'
import { findStoreKeywords, mergeKeywords, type ExternalKeyword } from '@/lib/ai-keywords'

export const maxDuration = 180

export async function GET() {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: latest } = await db
    .from('store_keywords')
    .select('payload, generated_at')
    .eq('tenant_id', auth.tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { payload: Record<string, unknown>; generated_at: string } | null }

  if (!latest?.payload) {
    return NextResponse.json({ cached: false, data: null })
  }

  return NextResponse.json({ ...latest.payload, cached: true, generated_at: latest.generated_at })
}

export async function POST() {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .select('domain, ahrefs_target, brand_voice')
    .eq('id', auth.tenantId)
    .single() as {
      data: { domain: string | null; ahrefs_target: string | null; brand_voice: string | null } | null
      error: { message: string } | null
    }

  if (tenantErr) {
    return NextResponse.json(
      { error: `Tenant query failed: ${tenantErr.message}` },
      { status: 500 }
    )
  }

  const store = tenant?.domain || tenant?.ahrefs_target
  if (!store) {
    return NextResponse.json(
      { error: 'Tenant domain not configured. Set domain or ahrefs_target in onboarding.' },
      { status: 400 }
    )
  }

  try {
    const [websearch, campaignsRes, seoRes] = await Promise.all([
      findStoreKeywords({
        store: store.toLowerCase(),
        brandContext: tenant?.brand_voice || undefined,
      }),
      db
        .from('campaigns')
        .select('primary_keyword, title, content_type, status')
        .eq('tenant_id', auth.tenantId),
      db
        .from('seo_metrics')
        .select('payload, snapshot_date')
        .eq('tenant_id', auth.tenantId)
        .not('payload', 'is', null)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const campaigns =
      (campaignsRes.data as Array<{
        primary_keyword: string | null
        title: string | null
        content_type: string | null
        status: string | null
      }> | null) || []

    const seoPayload = (seoRes.data as { payload: unknown } | null)?.payload as
      | { keywords?: Array<{ keyword: string; position?: number; volume?: number; url?: string }> }
      | null
      | undefined

    const external: ExternalKeyword[] = []
    for (const c of campaigns) {
      if (!c.primary_keyword) continue
      external.push({
        keyword: c.primary_keyword,
        source: 'campaign',
        evidence: `Campaign draft: "${c.title || 'untitled'}" (${c.content_type || 'unknown'}, ${c.status || 'unknown'})`,
      })
    }
    const seoKeywords = seoPayload?.keywords || []
    for (const k of seoKeywords) {
      if (!k.keyword) continue
      external.push({
        keyword: k.keyword,
        source: 'seo',
        page_url: k.url || '',
        evidence:
          typeof k.position === 'number'
            ? `Currently ranks #${k.position}${typeof k.volume === 'number' ? ` (volume ${k.volume})` : ''}`
            : 'Tracked in Ahrefs snapshot',
      })
    }

    const result = {
      store: websearch.store,
      keywords: mergeKeywords(websearch.keywords, external),
      generated_at: websearch.generated_at,
    }

    const { error: insertErr } = await db.from('store_keywords').insert({
      tenant_id: auth.tenantId,
      payload: result,
    })
    if (insertErr) {
      console.error('store_keywords insert failed:', insertErr)
      return NextResponse.json(
        {
          ...result,
          cached: false,
          cache_error: `Result computed but not cached: ${insertErr.message}. Run the migration in supabase/migrations/2026-04-29-add-store-keywords.sql.`,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ ...result, cached: false })
  } catch (error) {
    console.error('Store keywords error:', error)
    const message = error instanceof Error ? error.message : 'Failed to discover store keywords'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
