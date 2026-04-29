import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth/session'
import { getDb } from '@/lib/auth/db'
import { Sidebar } from '@/components/ui/sidebar'
import { RefreshBoot } from '@/components/refresh-boot'
import styles from './layout.module.css'

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = await getSession()

  if (!session.user) {
    redirect('/login')
  }

  if (session.user.role === 'admin') {
    redirect('/clients')
  }

  let tenantName = 'Client'
  if (session.user.tenantId) {
    const db = getDb()
    const { data: tenant } = await db
      .from('tenants')
      .select('name, status')
      .eq('id', session.user.tenantId)
      .single() as { data: { name: string; status: string } | null }

    if (tenant?.status === 'deactivated') {
      redirect('/login?error=deactivated')
    }
    if (tenant?.name) tenantName = tenant.name
  }

  return (
    <div className={styles.layout}>
      <Sidebar tenantName={tenantName} />
      <main className={styles.main}>{children}</main>
      <RefreshBoot />
    </div>
  )
}
