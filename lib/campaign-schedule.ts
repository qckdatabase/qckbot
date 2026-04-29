import type { SupabaseClient } from '@supabase/supabase-js'

const MAX_DAYS_AHEAD = 365

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export async function pickNextAvailableDate(
  db: SupabaseClient,
  tenantId: string,
  requestedIso?: string | null
): Promise<string> {
  const start = requestedIso
    ? new Date(`${requestedIso}T00:00:00Z`)
    : startOfTodayUtc()

  if (Number.isNaN(start.getTime())) {
    throw new Error(`Invalid requested date: ${requestedIso}`)
  }

  const cursor = new Date(start)
  for (let i = 0; i < MAX_DAYS_AHEAD; i++) {
    if (!isWeekend(cursor)) {
      const iso = toIso(cursor)
      const { data } = await db
        .from('campaigns')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('scheduled_for', iso)
        .limit(1)
        .maybeSingle()
      if (!data) return iso
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  throw new Error('No available weekday slot found within 365 days')
}

export async function findOccupiedDates(
  db: SupabaseClient,
  tenantId: string,
  candidates: string[]
): Promise<Set<string>> {
  if (candidates.length === 0) return new Set()
  const { data } = await db
    .from('campaigns')
    .select('scheduled_for')
    .eq('tenant_id', tenantId)
    .in('scheduled_for', candidates) as {
      data: Array<{ scheduled_for: string | null }> | null
    }
  return new Set((data || []).map((r) => r.scheduled_for).filter((s): s is string => !!s))
}
