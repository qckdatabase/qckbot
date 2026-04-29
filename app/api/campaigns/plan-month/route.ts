import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'
import { planMonth, weekdaysInMonth } from '@/lib/ai-month-plan'
import { getLiveKeywords } from '@/lib/sitemap'

export const maxDuration = 90

interface PlanRequestBody {
  year?: number
  month?: number
  count?: number
}

export async function POST(request: Request) {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const body = (await request.json().catch(() => ({}))) as PlanRequestBody
  const today = new Date()
  let year = body.year ?? today.getUTCFullYear()
  let month = body.month ?? today.getUTCMonth() + 2 // default = next month
  if (month > 12) {
    month -= 12
    year += 1
  }

  const dates = weekdaysInMonth(year, month).slice(0, 20) // 5/wk × 4 wk
  if (dates.length === 0) {
    return NextResponse.json({ error: 'No weekdays in target month' }, { status: 400 })
  }
  const count = Math.min(body.count ?? 20, dates.length)

  const db = getDb()

  const { data: tenant } = await db
    .from('tenants')
    .select('domain, brand_voice, sitemap_url')
    .eq('id', auth.tenantId)
    .single() as {
      data: { domain: string | null; brand_voice: string | null; sitemap_url: string | null } | null
    }

  if (!tenant?.domain) {
    return NextResponse.json({ error: 'Tenant domain not configured' }, { status: 400 })
  }

  const { data: existing } = await db
    .from('campaigns')
    .select('primary_keyword')
    .eq('tenant_id', auth.tenantId) as {
      data: Array<{ primary_keyword: string | null }> | null
    }

  const takenKeywords = (existing || [])
    .map((c) => (c.primary_keyword || '').trim().toLowerCase())
    .filter(Boolean)

  const liveKeywords = await getLiveKeywords(tenant.sitemap_url)

  let items
  try {
    items = await planMonth({
      domain: tenant.domain,
      brandVoice: tenant.brand_voice,
      takenKeywords,
      liveBlogKeywords: liveKeywords.blogs,
      liveProductKeywords: liveKeywords.products,
      count,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Planning failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const rows = items.slice(0, dates.length).map((item, i) => ({
    tenant_id: auth.tenantId,
    title: item.title,
    content_type: item.content_type,
    primary_keyword: item.primary_keyword,
    status: 'pending' as const,
    scheduled_for: dates[i].toISOString().slice(0, 10),
  }))

  const { data: inserted, error } = await db.from('campaigns').insert(rows).select()
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    year,
    month,
    count: rows.length,
    campaigns: inserted || [],
  })
}
