import { createClient } from '@/lib/supabase/server'
import { ClientTable } from '@/components/admin/client-table'
import { AddClientModal } from '@/components/admin/add-client-modal'
import styles from './page.module.css'

export default async function ClientsPage() {
  const supabase = await createClient()

  const { data: tenants } = await supabase
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Clients</h1>
        <AddClientModal />
      </div>

      <ClientTable tenants={tenants || []} />
    </div>
  )
}
