import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/ui/sidebar'
import styles from './layout.module.css'

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single()

  if (userData?.role === 'admin') {
    redirect('/admin/clients')
  }

  const { data: tenantData } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', userData?.tenant_id)
    .single()

  return (
    <div className={styles.layout}>
      <Sidebar tenantName={tenantData?.name || 'Client'} />
      <main className={styles.main}>{children}</main>
    </div>
  )
}
