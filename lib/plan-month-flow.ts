import type { SupabaseClient } from '@supabase/supabase-js'
import { planMonth, weekdaysInMonth } from '@/lib/ai-month-plan'
import { getLiveKeywords } from '@/lib/sitemap'
import {
  MONTHLY_CAMPAIGN_CAP,
  MONTHLY_CAP_MESSAGE,
  countCampaignsInMonth,
  getMonthBounds,
} from '@/lib/campaign-cap'
import { getLatestSeoSnapshot, matchKeywordMetric } from '@/lib/keyword-metrics'
import { findOccupiedDates } from '@/lib/campaign-schedule'

export interface PlanMonthArgs {
  tenantId: string
  year?: number
  month?: number
  count?: number
}

export interface PlanMonthInsertedRow {
  id: string
  title: string
  content_type: string
  primary_keyword: string
  scheduled_for: string
}

export type PlanMonthResult =
  | { ok: true; year: number; month: number; campaigns: PlanMonthInsertedRow[] }
  | {
      ok: false
      status: number
      error: string
      code?: 'no_weekdays' | 'cap_reached' | 'all_slots_taken' | 'no_domain' | 'planning_failed' | 'insert_failed'
      year?: number
      month?: number
    }

export async function runMonthPlan(
  db: SupabaseClient,
  args: PlanMonthArgs
): Promise<PlanMonthResult> {
  const today = new Date()
  let year = args.year ?? today.getUTCFullYear()
  let month = args.month ?? today.getUTCMonth() + 2
  if (month > 12) {
    month -= 12
    year += 1
  }

  const allWeekdayDates = weekdaysInMonth(year, month)
  if (allWeekdayDates.length === 0) {
    return {
      ok: false,
      status: 400,
      error: 'No weekdays in target month',
      code: 'no_weekdays',
      year,
      month,
    }
  }

  const targetBounds = getMonthBounds(new Date(Date.UTC(year, month - 1, 1)))
  const totalForMonth = await countCampaignsInMonth(db, args.tenantId, targetBounds)
  const remaining = MONTHLY_CAMPAIGN_CAP - totalForMonth
  if (remaining <= 0) {
    return {
      ok: false,
      status: 429,
      error: MONTHLY_CAP_MESSAGE,
      code: 'cap_reached',
      year,
      month,
    }
  }

  const candidateIsoList = allWeekdayDates.map((d) => d.toISOString().slice(0, 10))
  const occupied = await findOccupiedDates(db, args.tenantId, candidateIsoList)
  const dates = allWeekdayDates.filter((d) => !occupied.has(d.toISOString().slice(0, 10)))
  if (dates.length === 0) {
    return {
      ok: false,
      status: 409,
      error: 'All weekdays in target month already have a scheduled campaign.',
      code: 'all_slots_taken',
      year,
      month,
    }
  }

  const count = Math.min(args.count ?? MONTHLY_CAMPAIGN_CAP, remaining, dates.length)

  const { data: tenant } = await db
    .from('tenants')
    .select('domain, brand_voice, sitemap_url')
    .eq('id', args.tenantId)
    .single() as {
      data: { domain: string | null; brand_voice: string | null; sitemap_url: string | null } | null
    }

  if (!tenant?.domain) {
    return {
      ok: false,
      status: 400,
      error: 'Tenant domain not configured',
      code: 'no_domain',
      year,
      month,
    }
  }

  const { data: existing } = await db
    .from('campaigns')
    .select('primary_keyword')
    .eq('tenant_id', args.tenantId) as {
      data: Array<{ primary_keyword: string | null }> | null
    }

  const takenKeywords = (existing || [])
    .map((c) => (c.primary_keyword || '').trim().toLowerCase())
    .filter(Boolean)

  const liveKeywords = await getLiveKeywords(tenant.sitemap_url)

  const { data: trackedRow } = await db
    .from('store_keywords')
    .select('payload')
    .eq('tenant_id', args.tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle() as {
      data: { payload: { keywords?: Array<{ keyword: string }> } | null } | null
    }

  const trackedKeywords = (trackedRow?.payload?.keywords || [])
    .map((k) => (k.keyword || '').trim().toLowerCase())
    .filter(Boolean)

  let items
  try {
    items = await planMonth({
      domain: tenant.domain,
      brandVoice: tenant.brand_voice,
      takenKeywords,
      liveBlogKeywords: liveKeywords.blogs,
      liveProductKeywords: liveKeywords.products,
      trackedKeywords,
      count,
    })
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'Planning failed',
      code: 'planning_failed',
      year,
      month,
    }
  }

  const snapshot = await getLatestSeoSnapshot(db, args.tenantId)

  const rows = items.slice(0, dates.length).map((item, i) => {
    const metric = matchKeywordMetric(item.primary_keyword, snapshot)
    return {
      tenant_id: args.tenantId,
      title: item.title,
      content_type: item.content_type,
      primary_keyword: item.primary_keyword,
      status: 'pending' as const,
      scheduled_for: dates[i].toISOString().slice(0, 10),
      keyword_difficulty: metric.kd,
      keyword_volume: metric.volume,
    }
  })

  const { data: inserted, error } = await db
    .from('campaigns')
    .insert(rows)
    .select('id, title, content_type, primary_keyword, scheduled_for') as {
      data: PlanMonthInsertedRow[] | null
      error: { message: string } | null
    }

  if (error) {
    return {
      ok: false,
      status: 500,
      error: error.message,
      code: 'insert_failed',
      year,
      month,
    }
  }

  return { ok: true, year, month, campaigns: inserted || [] }
}
