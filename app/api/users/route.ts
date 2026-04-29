import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/auth/db'
import { getSession } from '@/lib/auth/session'
import { hashPassword } from '@/lib/auth/password'

export async function POST(request: NextRequest) {
  try {
    const { session } = await getSession()

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email, name, tempPassword } = await request.json()

    if (!email || !name || !tempPassword) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const db = getDb()

    const { data: existingUser } = await db
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 })
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')

    interface TenantRow { id: string; name: string; slug: string }
    interface UserRow { id: string; email: string; tenant_id: string }

    const { data: tenant, error: tenantError } = await db
      .from('tenants')
      .insert({ name, slug, owner_email: email } as any)
      .select()
      .single() as { data: TenantRow | null; error: unknown }

    if (tenantError || !tenant) {
      return NextResponse.json({ error: (tenantError as Error)?.message || 'Failed to create tenant' }, { status: 500 })
    }

    const passwordHash = await hashPassword(tempPassword)

    const { data: user, error: userError } = await db
      .from('users')
      .insert({
        email: email.toLowerCase().trim(),
        password_hash: passwordHash,
        role: 'client',
        tenant_id: tenant.id,
        needs_password_change: true,
      } as any)
      .select()
      .single() as { data: UserRow | null; error: unknown }

    if (userError || !user) {
      await db.from('tenants').delete().eq('id', tenant.id)
      return NextResponse.json({ error: (userError as Error)?.message || 'Failed to create user' }, { status: 500 })
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email, tenant_id: tenant.id },
      tempPassword,
    })
  } catch (err) {
    console.error('Create user error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
