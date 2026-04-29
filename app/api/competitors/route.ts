import { NextResponse } from 'next/server'
import { requireTenant } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'
import { findOrganicCompetitors } from '@/lib/ai-competitors'

export const maxDuration = 180

export async function GET() {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: latest } = await db
    .from('organic_competitors')
    .select('payload, generated_at')
    .eq('tenant_id', auth.tenantId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle() as { data: { payload: Record<string, unknown>; generated_at: string } | null }

  if (!latest?.payload) {
    return NextResponse.json({ cached: false, data: null })
  }

  return NextResponse.json({ ...latest.payload, cached: true, generated_at: latest.generated_at })
}

export async function POST() {
  const auth = await requireTenant()
  if (!auth.ok) return auth.response

  const db = getDb()
  const { data: tenant, error: tenantErr } = await db
    .from('tenants')
    .select('domain, ahrefs_target, brand_voice')
    .eq('id', auth.tenantId)
    .single() as {
      data: { domain: string | null; ahrefs_target: string | null; brand_voice: string | null } | null
      error: { message: string } | null
    }

  if (tenantErr) {
    return NextResponse.json(
      { error: `Tenant query failed: ${tenantErr.message}` },
      { status: 500 }
    )
  }

  const store = tenant?.domain || tenant?.ahrefs_target
  if (!store) {
    return NextResponse.json(
      { error: 'Tenant domain not configured. Set domain or ahrefs_target in onboarding.' },
      { status: 400 }
    )
  }

  try {
    const result = await findOrganicCompetitors({
      store: store.toLowerCase(),
      brandContext: tenant?.brand_voice || undefined,
    })

    const { error: insertErr } = await db.from('organic_competitors').insert({
      tenant_id: auth.tenantId,
      payload: result,
    })
    if (insertErr) {
      console.error('organic_competitors insert failed:', insertErr)
      return NextResponse.json(
        {
          ...result,
          cached: false,
          cache_error: `Result computed but not cached: ${insertErr.message}. Run the migration in supabase/migrations/2026-04-29-add-organic-competitors.sql.`,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ ...result, cached: false })
  } catch (error) {
    console.error('Organic competitors error:', error)
    const message = error instanceof Error ? error.message : 'Failed to discover organic competitors'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
