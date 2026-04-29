'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Tenant } from '@/lib/types'
import styles from './onboard-form.module.css'

interface OnboardFormProps {
  tenant: Tenant
  onSaved?: () => void
  onCancel?: () => void
}

type FormState = {
  name: string
  domain: string
  ahrefs_target: string
  sitemap_url: string
  brand_voice: string
  google_sheet_id: string
  google_docs_folder_id: string
  slack_channel_id: string
}

async function safeJson(res: Response): Promise<{ error?: string; success?: boolean }> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { error: `Server returned ${res.status} (non-JSON). ${text.slice(0, 120)}` }
  }
}

export function OnboardForm({ tenant, onSaved, onCancel }: OnboardFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({
    name: tenant.name || '',
    domain: tenant.domain || '',
    ahrefs_target: tenant.ahrefs_target || '',
    sitemap_url: tenant.sitemap_url || '',
    brand_voice: tenant.brand_voice || '',
    google_sheet_id: tenant.google_sheet_id || '',
    google_docs_folder_id: tenant.google_docs_folder_id || '',
    slack_channel_id: tenant.slack_channel_id || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const update = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
    setSaved(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaved(false)
    setLoading(true)

    if (!form.name.trim()) {
      setError('Tenant name is required.')
      setLoading(false)
      return
    }

    try {
      const payload: Record<string, string | null> = {}
      const REQUIRED = new Set(['name'])
      for (const [key, value] of Object.entries(form)) {
        const trimmed = value.trim()
        if (REQUIRED.has(key)) {
          payload[key] = trimmed
        } else {
          payload[key] = trimmed === '' ? null : trimmed
        }
      }

      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await safeJson(res)
      if (!res.ok) {
        setError(data.error || 'Failed to save')
        return
      }

      setSaved(true)
      router.refresh()
      onSaved?.()
    } catch {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <div className={styles.error}>{error}</div>}
      {saved && <div className={styles.success}>Saved.</div>}

      <Input
        label="Tenant Name"
        value={form.name}
        onChange={update('name')}
        required
      />

      <Input
        label="Domain"
        value={form.domain}
        onChange={update('domain')}
        placeholder="acme.com"
      />

      <Input
        label="Ahrefs Target"
        value={form.ahrefs_target}
        onChange={update('ahrefs_target')}
        placeholder="acme.com"
      />

      <Input
        label="Sitemap URL"
        value={form.sitemap_url}
        onChange={update('sitemap_url')}
        placeholder="https://acme.com/sitemap.xml"
      />

      <div className={styles.field}>
        <label className={styles.label}>Brand Voice</label>
        <textarea
          className={styles.textarea}
          value={form.brand_voice}
          onChange={update('brand_voice')}
          placeholder="Tone, voice, style guidelines..."
          rows={5}
        />
      </div>

      <Input
        label="Google Sheet ID"
        value={form.google_sheet_id}
        onChange={update('google_sheet_id')}
      />

      <Input
        label="Google Docs Folder ID"
        value={form.google_docs_folder_id}
        onChange={update('google_docs_folder_id')}
      />

      <Input
        label="Slack Channel ID"
        value={form.slack_channel_id}
        onChange={update('slack_channel_id')}
      />

      <div className={styles.actions}>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={loading}>
          Save
        </Button>
      </div>
    </form>
  )
}
