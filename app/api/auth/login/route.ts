import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/auth/db'
import { verifyPassword } from '@/lib/auth/password'
import { sessionConfig, type SessionData } from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const db = getDb()

    interface DbUser {
      id: string
      email: string
      password_hash: string
      role: string
      tenant_id: string | null
      needs_password_change: boolean
    }

    const { data: user, error } = await db
      .from('users')
      .select('id, email, password_hash, role, tenant_id, needs_password_change')
      .eq('email', email.toLowerCase().trim())
      .single() as { data: DbUser | null; error: unknown }

    if (error || !user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    if (user.role !== 'admin' && user.tenant_id) {
      const { data: tenant } = await db
        .from('tenants')
        .select('status')
        .eq('id', user.tenant_id)
        .single() as { data: { status: string } | null }

      if (tenant?.status === 'deactivated') {
        return NextResponse.json(
          { error: 'This account has been deactivated. Contact your administrator.' },
          { status: 403 }
        )
      }
    }

    let redirectTo = '/seo'
    if (user.needs_password_change) {
      redirectTo = '/change-password'
    } else if (user.role === 'admin') {
      redirectTo = '/clients'
    }

    const sessionData: SessionData = {
      userId: user.id,
      email: user.email,
      role: user.role as 'admin' | 'client',
      tenantId: user.tenant_id,
    }

    const sessionToken = Buffer.from(JSON.stringify(sessionData)).toString('base64')
    const { createHmac } = await import('crypto')
    const signature = createHmac('sha256', sessionConfig.password)
      .update(sessionToken)
      .digest('hex')
    const cookieValue = `${sessionToken}.${signature}`

    const response = NextResponse.redirect(new URL(redirectTo, request.url), 302)
    response.cookies.set(sessionConfig.cookieName, cookieValue, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('Login error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
