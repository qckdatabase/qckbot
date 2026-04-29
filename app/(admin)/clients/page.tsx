import { getDb } from '@/lib/auth/db'
import { ClientTable } from '@/components/admin/client-table'
import { AddClientModal } from '@/components/admin/add-client-modal'
import type { Tenant } from '@/lib/types'
import styles from './page.module.css'

export default async function ClientsPage() {
  const db = getDb()

  const { data: tenants } = await db
    .from('tenants')
    .select('*')
    .order('created_at', { ascending: false }) as { data: Tenant[] | null }

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
