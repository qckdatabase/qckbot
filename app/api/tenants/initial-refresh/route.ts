import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'
import { runFullRefresh } from '@/lib/data-refresh'

export const maxDuration = 300

export async function POST() {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: tenant } = await db
    .from('tenants')
    .select('refresh_in_flight, initial_refresh_done')
    .eq('id', auth.tenantId)
    .single() as {
      data: { refresh_in_flight: boolean | null; initial_refresh_done: boolean | null } | null
    }

  if (tenant?.refresh_in_flight) {
    return NextResponse.json({ skipped: true, reason: 'already_running' })
  }
  if (tenant?.initial_refresh_done) {
    return NextResponse.json({ skipped: true, reason: 'already_done' })
  }

  const result = await runFullRefresh(db, auth.tenantId)
  return NextResponse.json({
    skipped: false,
    outcomes: result.outcomes,
    any_ok: result.any_ok,
  })
}
