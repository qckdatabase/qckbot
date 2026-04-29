'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tenant } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { OnboardForm } from './onboard-form'
import styles from './client-table.module.css'

interface ClientTableProps {
  tenants: Tenant[]
}

async function safeJson(res: Response): Promise<{ error?: string; success?: boolean }> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { error: `Server returned ${res.status} (non-JSON). ${text.slice(0, 120)}` }
  }
}

export function ClientTable({ tenants }: ClientTableProps) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [onboardTenant, setOnboardTenant] = useState<Tenant | null>(null)

  async function toggleStatus(tenant: Tenant) {
    const next = tenant.status === 'active' ? 'deactivated' : 'active'
    setBusyId(tenant.id)
    setError('')
    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || 'Update failed')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  if (tenants.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No clients yet. Add your first client to get started.</p>
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      {error && <p className={styles.error}>{error}</p>}
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
          {tenants.map((tenant) => {
            const isActive = tenant.status === 'active'
            return (
              <tr key={tenant.id}>
                <td className={styles.name}>{tenant.name}</td>
                <td>{tenant.slug}</td>
                <td>{tenant.owner_email}</td>
                <td>
                  <Badge variant={isActive ? 'success' : 'error'}>
                    {isActive ? 'Active' : 'Deactivated'}
                  </Badge>
                </td>
                <td className={styles.actions}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleStatus(tenant)}
                    loading={busyId === tenant.id}
                  >
                    {isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setOnboardTenant(tenant)}
                  >
                    Onboard
                  </Button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <Modal
        isOpen={!!onboardTenant}
        onClose={() => setOnboardTenant(null)}
        title={onboardTenant ? `Onboard ${onboardTenant.name}` : ''}
        size="lg"
      >
        {onboardTenant && (
          <OnboardForm
            tenant={onboardTenant}
            onCancel={() => setOnboardTenant(null)}
            onSaved={() => setOnboardTenant(null)}
          />
        )}
      </Modal>
    </div>
  )
}
