import type { SupabaseClient } from '@supabase/supabase-js'
import { getSiteMetrics, getKeywords, getBacklinks } from '@/lib/ahrefs'
import { rankAuto } from '@/lib/ai-ranking'
import { findOrganicCompetitors } from '@/lib/ai-competitors'
import {
  findStoreKeywords,
  mergeKeywords,
  type ExternalKeyword,
} from '@/lib/ai-keywords'

export type RefreshKind = 'seo' | 'ranking' | 'competitors' | 'keywords'

export interface RefreshOutcome {
  kind: RefreshKind
  ok: boolean
  error?: string
}

interface TenantContext {
  id: string
  domain: string | null
  ahrefs_target: string | null
  brand_voice: string | null
}

async function loadTenant(db: SupabaseClient, tenantId: string): Promise<TenantContext | null> {
  const { data } = await db
    .from('tenants')
    .select('id, domain, ahrefs_target, brand_voice')
    .eq('id', tenantId)
    .single() as { data: TenantContext | null }
  return data
}

function resolveStore(t: TenantContext): string | null {
  const raw = t.domain || t.ahrefs_target
  return raw ? raw.toLowerCase() : null
}

export async function refreshSeoMetrics(
  db: SupabaseClient,
  tenantId: string,
  preloadedTenant?: TenantContext | null
): Promise<RefreshOutcome> {
  try {
    const tenant = preloadedTenant ?? (await loadTenant(db, tenantId))
    if (!tenant?.ahrefs_target) {
      return { kind: 'seo', ok: false, error: 'No Ahrefs target configured' }
    }
    const domain = tenant.domain || tenant.ahrefs_target
    const [metrics, keywords, backlinks] = await Promise.all([
      getSiteMetrics(domain),
      getKeywords(domain, 50),
      getBacklinks(domain, 50),
    ])
    const today = new Date().toISOString().split('T')[0]

    const { data: historicalRows } = await db
      .from('seo_metrics')
      .select('snapshot_date, domain_rating, organic_keywords, backlinks, est_monthly_traffic')
      .eq('tenant_id', tenantId)
      .order('snapshot_date', { ascending: true })
      .limit(12)

    const payload = {
      domain,
      current: metrics,
      keywords,
      backlinks,
      historical: historicalRows || [],
    }

    const { error } = await db.from('seo_metrics').upsert(
      {
        tenant_id: tenantId,
        snapshot_date: today,
        domain_rating: metrics.domain_rating,
        organic_keywords: metrics.organic_keywords,
        backlinks: metrics.backlinks,
        est_monthly_traffic: metrics.est_monthly_traffic,
        payload,
      },
      { onConflict: 'tenant_id,snapshot_date' }
    )
    if (error) return { kind: 'seo', ok: false, error: error.message }
    return { kind: 'seo', ok: true }
  } catch (err) {
    return {
      kind: 'seo',
      ok: false,
      error: err instanceof Error ? err.message : 'SEO refresh failed',
    }
  }
}

export async function refreshAiRanking(
  db: SupabaseClient,
  tenantId: string,
  preloadedTenant?: TenantContext | null
): Promise<RefreshOutcome> {
  try {
    const tenant = preloadedTenant ?? (await loadTenant(db, tenantId))
    if (!tenant) return { kind: 'ranking', ok: false, error: 'Tenant not found' }
    const store = resolveStore(tenant)
    if (!store) return { kind: 'ranking', ok: false, error: 'Tenant domain not configured' }

    const result = await rankAuto({
      store,
      brandContext: tenant.brand_voice || undefined,
    })
    const { error } = await db.from('ai_rankings').insert({
      tenant_id: tenantId,
      payload: result,
    })
    if (error) return { kind: 'ranking', ok: false, error: error.message }
    return { kind: 'ranking', ok: true }
  } catch (err) {
    return {
      kind: 'ranking',
      ok: false,
      error: err instanceof Error ? err.message : 'AI ranking refresh failed',
    }
  }
}

export async function refreshOrganicCompetitors(
  db: SupabaseClient,
  tenantId: string,
  preloadedTenant?: TenantContext | null
): Promise<RefreshOutcome> {
  try {
    const tenant = preloadedTenant ?? (await loadTenant(db, tenantId))
    if (!tenant) return { kind: 'competitors', ok: false, error: 'Tenant not found' }
    const store = resolveStore(tenant)
    if (!store) {
      return { kind: 'competitors', ok: false, error: 'Tenant domain not configured' }
    }

    const result = await findOrganicCompetitors({
      store,
      brandContext: tenant.brand_voice || undefined,
    })
    const { error } = await db.from('organic_competitors').insert({
      tenant_id: tenantId,
      payload: result,
    })
    if (error) return { kind: 'competitors', ok: false, error: error.message }
    return { kind: 'competitors', ok: true }
  } catch (err) {
    return {
      kind: 'competitors',
      ok: false,
      error: err instanceof Error ? err.message : 'Organic competitors refresh failed',
    }
  }
}

export async function refreshStoreKeywords(
  db: SupabaseClient,
  tenantId: string,
  preloadedTenant?: TenantContext | null
): Promise<RefreshOutcome> {
  try {
    const tenant = preloadedTenant ?? (await loadTenant(db, tenantId))
    if (!tenant) return { kind: 'keywords', ok: false, error: 'Tenant not found' }
    const store = resolveStore(tenant)
    if (!store) {
      return { kind: 'keywords', ok: false, error: 'Tenant domain not configured' }
    }

    const [websearch, campaignsRes, seoRes] = await Promise.all([
      findStoreKeywords({
        store,
        brandContext: tenant.brand_voice || undefined,
      }),
      db
        .from('campaigns')
        .select('primary_keyword, title, content_type, status')
        .eq('tenant_id', tenantId),
      db
        .from('seo_metrics')
        .select('payload, snapshot_date')
        .eq('tenant_id', tenantId)
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

    const { error } = await db.from('store_keywords').insert({
      tenant_id: tenantId,
      payload: result,
    })
    if (error) return { kind: 'keywords', ok: false, error: error.message }
    return { kind: 'keywords', ok: true }
  } catch (err) {
    return {
      kind: 'keywords',
      ok: false,
      error: err instanceof Error ? err.message : 'Store keywords refresh failed',
    }
  }
}

export interface FullRefreshResult {
  outcomes: RefreshOutcome[]
  any_ok: boolean
}

export async function runFullRefresh(
  db: SupabaseClient,
  tenantId: string
): Promise<FullRefreshResult> {
  const tenant = await loadTenant(db, tenantId)

  await db
    .from('tenants')
    .update({ refresh_in_flight: true })
    .eq('id', tenantId)

  try {
    const seo = await refreshSeoMetrics(db, tenantId, tenant)

    const [ranking, competitors, keywords] = await Promise.all([
      refreshAiRanking(db, tenantId, tenant),
      refreshOrganicCompetitors(db, tenantId, tenant),
      refreshStoreKeywords(db, tenantId, tenant),
    ])

    const outcomes: RefreshOutcome[] = [seo, ranking, competitors, keywords]
    const any_ok = outcomes.some((o) => o.ok)

    const updates: Record<string, unknown> = { refresh_in_flight: false }
    if (any_ok) {
      updates.last_refreshed_at = new Date().toISOString()
      updates.initial_refresh_done = true
    }
    await db.from('tenants').update(updates).eq('id', tenantId)

    return { outcomes, any_ok }
  } catch (err) {
    await db
      .from('tenants')
      .update({ refresh_in_flight: false })
      .eq('id', tenantId)
    throw err
  }
}
