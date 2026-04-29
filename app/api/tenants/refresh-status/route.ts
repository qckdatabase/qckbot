import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'

export async function GET() {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: tenant } = await db
    .from('tenants')
    .select('refresh_in_flight, last_refreshed_at, initial_refresh_done')
    .eq('id', auth.tenantId)
    .single() as {
      data: {
        refresh_in_flight: boolean | null
        last_refreshed_at: string | null
        initial_refresh_done: boolean | null
      } | null
    }

  return NextResponse.json({
    refresh_in_flight: !!tenant?.refresh_in_flight,
    last_refreshed_at: tenant?.last_refreshed_at || null,
    initial_refresh_done: !!tenant?.initial_refresh_done,
  })
}
