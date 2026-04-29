import { requireTenant, requireUser } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'
import {
  MONTHLY_CAMPAIGN_CAP,
  MONTHLY_CAP_MESSAGE,
  countCampaignsInMonth,
  getMonthBounds,
} from '@/lib/campaign-cap'
import { getLatestSeoSnapshot, matchKeywordMetric } from '@/lib/keyword-metrics'
import { pickNextAvailableDate } from '@/lib/campaign-schedule'

interface CampaignRow {
  id: string
  primary_keyword: string | null
  keyword_difficulty: number | null
  keyword_volume: number | null
  [key: string]: unknown
}

export async function GET() {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: campaignsRaw } = await db
    .from('campaigns')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false })

  const list = (campaignsRaw || []) as CampaignRow[]

  const needsBackfill = list.some(
    (c) =>
      c.primary_keyword &&
      (c.keyword_difficulty === null || c.keyword_volume === null)
  )

  let snapshot: Awaited<ReturnType<typeof getLatestSeoSnapshot>> = []
  if (needsBackfill) {
    snapshot = await getLatestSeoSnapshot(db, auth.tenantId)
  }

  const enriched = list.map((c) => {
    if (
      c.keyword_difficulty !== null &&
      c.keyword_volume !== null
    ) {
      return c
    }
    if (!c.primary_keyword || snapshot.length === 0) return c
    const metric = matchKeywordMetric(c.primary_keyword, snapshot)
    return {
      ...c,
      keyword_difficulty:
        c.keyword_difficulty !== null ? c.keyword_difficulty : metric.kd,
      keyword_volume:
        c.keyword_volume !== null ? c.keyword_volume : metric.volume,
    }
  })

  return Response.json({ campaigns: enriched })
}

export async function POST(request: Request) {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()

  const body = await request.json()
  const { title, content_type, primary_keyword, generated_content, scheduled_for } = body

  const requestedIso =
    typeof scheduled_for === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(scheduled_for)
      ? scheduled_for
      : null

  const chosenDate = await pickNextAvailableDate(db, auth.tenantId, requestedIso)
  const targetBounds = getMonthBounds(new Date(`${chosenDate}T00:00:00Z`))
  const total = await countCampaignsInMonth(db, auth.tenantId, targetBounds)
  if (total >= MONTHLY_CAMPAIGN_CAP) {
    return Response.json(
      {
        error: MONTHLY_CAP_MESSAGE,
        cap_reached: true,
        cap: MONTHLY_CAMPAIGN_CAP,
        current: total,
      },
      { status: 429 }
    )
  }

  let kd: number | null = null
  let volume: number | null = null
  if (primary_keyword) {
    const snapshot = await getLatestSeoSnapshot(db, auth.tenantId)
    const metric = matchKeywordMetric(primary_keyword, snapshot)
    kd = metric.kd
    volume = metric.volume
  }

  const { data: campaign, error } = await db
    .from('campaigns')
    .insert({
      tenant_id: auth.tenantId,
      title,
      content_type,
      primary_keyword,
      generated_content,
      status: 'generated',
      scheduled_for: chosenDate,
      keyword_difficulty: kd,
      keyword_volume: volume,
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ campaign })
}

export async function PATCH(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const db = getDb()
  const body = await request.json()
  const { id, status, google_doc_url, live_url, generated_content } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) updates.status = status
  if (google_doc_url) updates.google_doc_url = google_doc_url
  if (live_url) updates.live_url = live_url
  if (generated_content) updates.generated_content = generated_content

  const { error } = await db
    .from('campaigns')
    .update(updates)
    .eq('id', id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
