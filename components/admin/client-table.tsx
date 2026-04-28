'use client'

import { Tenant } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import styles from './client-table.module.css'

interface ClientTableProps {
  tenants: Tenant[]
}

export function ClientTable({ tenants }: ClientTableProps) {
  if (tenants.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No clients yet. Add your first client to get started.</p>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Client</th>
            <th>Slug</th>
            <th>Owner Email</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr key={tenant.id}>
              <td className={styles.name}>{tenant.name}</td>
              <td>{tenant.slug}</td>
              <td>{tenant.owner_email}</td>
              <td>
                <Badge variant={tenant.status === 'active' ? 'success' : 'error'}>
                  {tenant.status === 'active' ? 'Active' : 'Deactivated'}
                </Badge>
              </td>
              <td className={styles.actions}>
                {tenant.status === 'active' ? (
                  <Button variant="ghost" size="sm">
                    Deactivate
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm">
                    Reactivate
                  </Button>
                )}
                <Button variant="secondary" size="sm">
                  Onboard
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
