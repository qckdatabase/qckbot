import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/api'
import { getDb } from '@/lib/auth/db'
import { hashPassword } from '@/lib/auth/password'

export async function POST(request: Request) {
  const auth = await requireUser()
  if (!auth.ok) return auth.response

  const { password } = await request.json()

  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 }
    )
  }

  const passwordHash = await hashPassword(password)
  const db = getDb()

  const { error } = await db
    .from('users')
    .update({
      password_hash: passwordHash,
      needs_password_change: false,
    })
    .eq('id', auth.user.userId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
