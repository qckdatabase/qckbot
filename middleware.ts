import { NextRequest, NextResponse } from 'next/server'
import { sessionConfig, type SessionData } from '@/lib/auth/session'

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function base64Decode(input: string): string {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4)
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad)
  const binary = typeof atob === 'function'
    ? atob(b64)
    : Buffer.from(b64, 'base64').toString('binary')
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

async function verifySessionCookie(cookieValue: string): Promise<SessionData | null> {
  try {
    const parts = cookieValue.split('.')
    if (parts.length !== 2) return null

    const [token, signature] = parts
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(sessionConfig.password),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sigBytes = await crypto.subtle.sign('HMAC', key, enc.encode(token))
    const expectedSignature = bytesToHex(new Uint8Array(sigBytes))

    if (signature !== expectedSignature) return null

    const decoded = base64Decode(token)
    const sessionData = JSON.parse(decoded) as SessionData
    return sessionData
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const adminRoutes = ['/clients', '/guardrails']
  const clientRoutes = [
    '/seo',
    '/ranking',
    '/campaigns',
    '/chat',
  ]

  const isAdminRoute = adminRoutes.some(r => pathname.startsWith(r))
  const isClientRoute = clientRoutes.some(r => pathname.startsWith(r))

  const sessionCookie = request.cookies.get(sessionConfig.cookieName)?.value
  let user: SessionData | null = null

  if (sessionCookie) {
    user = await verifySessionCookie(sessionCookie)
  }

  if (!user && (isAdminRoute || isClientRoute)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAdminRoute && user.role !== 'admin') {
    return NextResponse.redirect(new URL('/seo', request.url))
  }

  if (user && isClientRoute && user.role !== 'client') {
    return NextResponse.redirect(new URL('/clients', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
