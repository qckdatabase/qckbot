import { NextResponse } from 'next/server'
import { sessionConfig } from '@/lib/auth/session'
import { cookies } from 'next/headers'

export async function POST() {
  const cookieStore = await cookies()
  cookieStore.delete(sessionConfig.cookieName)
  return NextResponse.json({ success: true })
}
