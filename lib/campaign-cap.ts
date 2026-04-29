import type { SupabaseClient } from '@supabase/supabase-js'

export const MONTHLY_CAMPAIGN_CAP = 20

export const MONTHLY_CAP_MESSAGE =
  `Cannot generate. Monthly cap is ${MONTHLY_CAMPAIGN_CAP} contents — exceeding it risks Google flagging the domain for low-quality bulk publishing. Wait until next month or delete an existing draft.`

export interface MonthBounds {
  start: string
  end: string
  year: number
  month: number
}

export function getMonthBounds(ref: Date = new Date()): MonthBounds {
  const year = ref.getUTCFullYear()
  const month = ref.getUTCMonth() + 1
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
  return { start, end, year, month }
}

export async function countCampaignsInMonth(
  db: SupabaseClient,
  tenantId: string,
  bounds: MonthBounds = getMonthBounds()
): Promise<number> {
  const { count: scheduledCount } = await db
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('scheduled_for', bounds.start)
    .lt('scheduled_for', bounds.end)

  const { count: adhocCount } = await db
    .from('campaigns')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .is('scheduled_for', null)
    .gte('created_at', `${bounds.start}T00:00:00.000Z`)
    .lt('created_at', `${bounds.end}T00:00:00.000Z`)

  return (scheduledCount || 0) + (adhocCount || 0)
}

export async function isMonthCapReached(
  db: SupabaseClient,
  tenantId: string,
  bounds?: MonthBounds
): Promise<boolean> {
  const total = await countCampaignsInMonth(db, tenantId, bounds)
  return total >= MONTHLY_CAMPAIGN_CAP
}
