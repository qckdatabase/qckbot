import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { AdminSidebar } from '@/components/admin/admin-sidebar'
import styles from './layout.module.css'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = await getSession()

  if (!session.user) {
    redirect('/login')
  }

  if (session.user.role !== 'admin') {
    redirect('/seo')
  }

  return (
    <div className={styles.layout}>
      <AdminSidebar email={session.user.email} />
      <main id="main" className={styles.main}>{children}</main>
    </div>
  )
}
