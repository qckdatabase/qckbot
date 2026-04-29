import { NextResponse } from 'next/server'
import { getDb } from '@/lib/auth/db'
import { runFullRefresh } from '@/lib/data-refresh'

export const maxDuration = 300

interface TenantRow {
  id: string
  domain: string | null
  ahrefs_target: string | null
  status: string | null
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
  const { data: tenants, error } = await db
    .from('tenants')
    .select('id, domain, ahrefs_target, status') as {
      data: TenantRow[] | null
      error: { message: string } | null
    }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const eligible = (tenants || []).filter(
    (t) => t.status !== 'deactivated' && (t.domain || t.ahrefs_target)
  )

  const summaries: Array<{
    tenant_id: string
    outcomes: Array<{ kind: string; ok: boolean; error?: string }>
  }> = []

  for (const tenant of eligible) {
    try {
      const result = await runFullRefresh(db, tenant.id)
      summaries.push({ tenant_id: tenant.id, outcomes: result.outcomes })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error'
      console.error(`[cron] weekly-refresh failed for tenant ${tenant.id}:`, message)
      summaries.push({
        tenant_id: tenant.id,
        outcomes: [{ kind: 'fatal', ok: false, error: message }],
      })
    }
  }

  return NextResponse.json({
    total: eligible.length,
    summaries,
  })
}
