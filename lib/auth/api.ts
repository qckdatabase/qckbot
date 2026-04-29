import { NextResponse } from 'next/server'
import { getSession, type SessionData } from './session'
import { getDb } from './db'

export type ApiAuthResult =
  | { ok: true; user: SessionData }
  | { ok: false; response: NextResponse }

export async function requireUser(): Promise<ApiAuthResult> {
  const { session } = await getSession()
  if (!session.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }
  return { ok: true, user: session.user }
}

export type ApiTenantResult =
  | { ok: true; user: SessionData; tenantId: string }
  | { ok: false; response: NextResponse }

export async function requireTenant(): Promise<ApiTenantResult> {
  const auth = await requireUser()
  if (!auth.ok) return auth
  if (!auth.user.tenantId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'No tenant' }, { status: 400 }),
    }
  }

  const db = getDb()
  const { data: tenant } = await db
    .from('tenants')
    .select('status')
    .eq('id', auth.user.tenantId)
    .single() as { data: { status: string } | null }

  if (tenant?.status === 'deactivated') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Tenant deactivated. Contact your administrator.' },
        { status: 403 }
      ),
    }
  }

  return { ok: true, user: auth.user, tenantId: auth.user.tenantId }
}

export async function requireAdmin(): Promise<ApiAuthResult> {
  const auth = await requireUser()
  if (!auth.ok) return auth
  if (auth.user.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }
  return { ok: true, user: auth.user }
}
