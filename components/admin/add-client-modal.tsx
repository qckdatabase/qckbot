'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import styles from './add-client-modal.module.css'

export function AddClientModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({ name, slug, owner_email: email })
        .select()
        .single()

      if (tenantError) {
        setError(tenantError.message)
        return
      }

      await supabase.from('users').insert({
        id: authUser.user!.id,
        tenant_id: tenant.id,
        email,
        role: 'client',
        needs_password_change: true,
      })

      const tempPw = Math.random().toString(36).slice(-8)
      await supabase.auth.admin.updateUserById(authUser.user!.id, {
        password: tempPw,
      })

      setTempPassword(tempPw)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setIsOpen(false)
    setName('')
    setEmail('')
    setTempPassword(null)
    setError('')
    router.refresh()
  }

  const copyPassword = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword)
    }
  }

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Add Client</Button>

      <Modal isOpen={isOpen} onClose={handleClose} title="Add Client">
        {!tempPassword ? (
          <form onSubmit={handleSubmit} className={styles.form}>
            {error && <div className={styles.error}>{error}</div>}

            <Input
              label="Tenant Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Store"
              required
            />

            <Input
              label="Owner Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@acme.com"
              required
            />

            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" loading={loading}>
                Create Client
              </Button>
            </div>
          </form>
        ) : (
          <div className={styles.tempPassword}>
            <p className={styles.tempLabel}>Temporary Password (send to client):</p>
            <div className={styles.passwordBox}>
              <code>{tempPassword}</code>
              <Button variant="secondary" size="sm" onClick={copyPassword}>
                Copy
              </Button>
            </div>
            <p className={styles.note}>
              Client will be asked to change password on first login.
            </p>
            <Button onClick={handleClose}>Done</Button>
          </div>
        )}
      </Modal>
    </>
  )
}
