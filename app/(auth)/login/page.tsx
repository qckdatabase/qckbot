'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import styles from './page.module.css'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('error') === 'deactivated') {
      setError('Your account has been deactivated. Contact your administrator.')
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (res.redirected) {
        router.push(res.url)
        router.refresh()
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Login failed')
        return
      }

      router.push(data.redirectTo || '/seo')
      router.refresh()
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.lockIcon}>
        <Lock size={18} />
      </div>

      <div className={styles.heading}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Enter your credentials to continue.</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.fields}>
        <label className={styles.label} htmlFor="email">
          <span className={styles.labelText}>Email</span>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={styles.input}
            required
          />
        </label>

        <label className={styles.label} htmlFor="password">
          <span className={styles.labelText}>Password</span>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            className={styles.input}
            required
          />
        </label>
      </div>

      <button type="submit" className={styles.button} disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className={styles.form}><div className={styles.lockIcon}><Lock size={18} /></div></div>}>
      <LoginForm />
    </Suspense>
  )
}