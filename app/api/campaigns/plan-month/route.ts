import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'
import { runMonthPlan } from '@/lib/plan-month-flow'

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
  const db = getDb()

  const result = await runMonthPlan(db, {
    tenantId: auth.tenantId,
    year: body.year,
    month: body.month,
    count: body.count,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        ...(result.code === 'cap_reached' ? { cap_reached: true } : {}),
        ...(result.code === 'all_slots_taken' ? { all_slots_taken: true } : {}),
        year: result.year,
        month: result.month,
      },
      { status: result.status }
    )
  }

  return NextResponse.json({
    year: result.year,
    month: result.month,
    count: result.campaigns.length,
    campaigns: result.campaigns,
  })
}
