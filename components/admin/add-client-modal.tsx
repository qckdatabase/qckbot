'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import styles from './add-client-modal.module.css'

export function AddClientModal() {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const tempPw = Math.random().toString(36).slice(-8)

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, tempPassword: tempPw }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create client')
        return
      }

      setTempPassword(data.tempPassword)
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
    setCopied(false)
    router.refresh()
  }

  const copyPassword = async () => {
    if (!tempPassword) return
    try {
      await navigator.clipboard.writeText(tempPassword)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = tempPassword
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy') } catch {}
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
              <Button
                variant="secondary"
                size="sm"
                onClick={copyPassword}
                aria-label={copied ? 'Copied' : 'Copy password'}
              >
                {copied ? (
                  <>
                    <Check size={14} />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy
                  </>
                )}
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
