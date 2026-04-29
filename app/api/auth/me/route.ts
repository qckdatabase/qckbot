import { NextResponse } from 'next/server'
import { sessionConfig, type SessionData } from '@/lib/auth/session'
import { cookies } from 'next/headers'

async function verifySessionCookie(cookieValue: string): Promise<SessionData | null> {
  try {
    const parts = cookieValue.split('.')
    if (parts.length !== 2) return null

    const [token, signature] = parts
    const { createHmac } = await import('crypto')
    const expectedSignature = createHmac('sha256', sessionConfig.password)
      .update(token)
      .digest('hex')

    if (signature !== expectedSignature) return null

    const sessionData = JSON.parse(Buffer.from(token, 'base64').toString()) as SessionData
    return sessionData
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(sessionConfig.cookieName)?.value

    if (!sessionCookie) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    const user = await verifySessionCookie(sessionCookie)
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({ user })
  } catch (err) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
}
