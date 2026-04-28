'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import styles from './page.module.css'

export default function ChangePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const [supabase] = useState(() =>
    typeof window !== 'undefined' ? createClient() : null
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      const { data: { user }, error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setError(updateError.message)
        return
      }

      if (user) {
        await supabase
          .from('users')
          .update({ needs_password_change: false })
          .eq('id', user.id)

        router.push('/dashboard')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h1 className={styles.title}>Change Password</h1>
      <p className={styles.subtitle}>You must change your password before continuing.</p>

      {error && <div className={styles.error}>{error}</div>}

      <Input
        label="New Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Min 8 characters"
        required
      />

      <Input
        label="Confirm Password"
        type="password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="Confirm password"
        required
      />

      <Button type="submit" loading={loading}>
        Update Password
      </Button>
    </form>
  )
}
