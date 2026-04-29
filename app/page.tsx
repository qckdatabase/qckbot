import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'

export default async function RootPage() {
  const { session } = await getSession()

  if (!session.user) {
    redirect('/login')
  }

  if (session.user.role === 'admin') {
    redirect('/clients')
  }

  redirect('/seo')
}
