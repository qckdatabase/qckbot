export interface SessionData {
  userId: string
  email: string
  role: 'admin' | 'client'
  tenantId: string | null
}

export interface IronSessionConfig {
  password: string
  cookieName: string
  cookieOptions: {
    secure: boolean
    httpOnly: boolean
    sameSite: 'lax' | 'strict' | 'none'
    maxAge: number
    path: string
  }
}

const SESSION_PASSWORD = process.env.SESSION_PASSWORD || 'qck-seo-dashboard-session-secret-key-32chars'

export const sessionConfig: IronSessionConfig = {
  password: SESSION_PASSWORD,
  cookieName: 'qck_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  },
}

export async function getSession(): Promise<{ session: { user: SessionData | null } }> {
  const { cookies } = await import('next/headers')
  const { createHmac } = await import('crypto')

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(sessionConfig.cookieName)?.value

  if (!sessionCookie) {
    return { session: { user: null } }
  }

  try {
    const parts = sessionCookie.split('.')
    if (parts.length !== 2) return { session: { user: null } }

    const [token, signature] = parts
    const expectedSignature = createHmac('sha256', SESSION_PASSWORD)
      .update(token)
      .digest('hex')

    if (signature !== expectedSignature) return { session: { user: null } }

    const sessionData = JSON.parse(Buffer.from(token, 'base64').toString()) as SessionData
    return { session: { user: sessionData } }
  } catch {
    return { session: { user: null } }
  }
}
