import { NextResponse } from 'next/server'
import { getDb } from '@/lib/auth/db'
import {
  findStoreKeywords,
  mergeKeywords,
  type ExternalKeyword,
} from '@/lib/ai-keywords'

export const maxDuration = 300

interface TenantRow {
  id: string
  domain: string | null
  ahrefs_target: string | null
  brand_voice: string | null
  status: string | null
}

interface RefreshOutcome {
  tenant_id: string
  store: string | null
  status: 'ok' | 'skipped' | 'error'
  keyword_count?: number
  error?: string
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') || ''
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getDb()
  const { data: tenants, error: tenantsErr } = await db
    .from('tenants')
    .select('id, domain, ahrefs_target, brand_voice, status') as {
      data: TenantRow[] | null
      error: { message: string } | null
    }

  if (tenantsErr) {
    return NextResponse.json({ error: tenantsErr.message }, { status: 500 })
  }

  const eligible = (tenants || []).filter(
    (t) => t.status !== 'deactivated' && (t.domain || t.ahrefs_target)
  )

  const outcomes: RefreshOutcome[] = []

  for (const tenant of eligible) {
    const store = (tenant.domain || tenant.ahrefs_target || '').toLowerCase()
    if (!store) {
      outcomes.push({ tenant_id: tenant.id, store: null, status: 'skipped' })
      continue
    }

    try {
      const [websearch, campaignsRes, seoRes] = await Promise.all([
        findStoreKeywords({
          store,
          brandContext: tenant.brand_voice || undefined,
        }),
        db
          .from('campaigns')
          .select('primary_keyword, title, content_type, status')
          .eq('tenant_id', tenant.id),
        db
          .from('seo_metrics')
          .select('payload, snapshot_date')
          .eq('tenant_id', tenant.id)
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
        | {
            keywords?: Array<{
              keyword: string
              position?: number
              volume?: number
              url?: string
            }>
          }
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
      for (const k of seoPayload?.keywords || []) {
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
        tenant_id: tenant.id,
        payload: result,
      })

      if (insertErr) {
        outcomes.push({
          tenant_id: tenant.id,
          store,
          status: 'error',
          error: `cache insert failed: ${insertErr.message}`,
        })
      } else {
        outcomes.push({
          tenant_id: tenant.id,
          store,
          status: 'ok',
          keyword_count: result.keywords.length,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      console.error(`[cron] refresh-keywords failed for tenant ${tenant.id}:`, message)
      outcomes.push({ tenant_id: tenant.id, store, status: 'error', error: message })
    }
  }

  const summary = {
    total: eligible.length,
    ok: outcomes.filter((o) => o.status === 'ok').length,
    skipped: outcomes.filter((o) => o.status === 'skipped').length,
    errored: outcomes.filter((o) => o.status === 'error').length,
  }

  return NextResponse.json({ summary, outcomes })
}
