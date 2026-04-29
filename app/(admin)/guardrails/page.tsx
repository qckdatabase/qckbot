'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import styles from './page.module.css'

interface Template {
  content_type: string
  field_name: string
  template_content: string
}

interface TypeSummary {
  type: string
  fields: string[]
}

function prettifyType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AdminGuardrailsPage() {
  const [summary, setSummary] = useState<TypeSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({
    content_type: '',
    field_name: '',
    template_content: '',
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<TypeSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/guardrails', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load guardrails')

      const templates: Template[] = json.templates || []
      const byType = new Map<string, TypeSummary>()
      for (const t of templates) {
        if (!byType.has(t.content_type)) {
          byType.set(t.content_type, { type: t.content_type, fields: [] })
        }
        byType.get(t.content_type)!.fields.push(t.field_name)
      }
      setSummary(Array.from(byType.values()).sort((a, b) => a.type.localeCompare(b.type)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guardrails')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function slugifyType(s: string): string {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
  }

  async function safeJson(res: Response): Promise<{ error?: string; success?: boolean }> {
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch {
      return { error: `Server returned ${res.status} (non-JSON). ${text.slice(0, 120)}` }
    }
  }

  async function handleDeleteType() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const params = new URLSearchParams({ content_type: deleteTarget.type })
      const res = await fetch(`/api/guardrails?${params}`, { method: 'DELETE' })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || 'Delete failed')
      setDeleteTarget(null)
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const content_type = slugifyType(form.content_type)
    const field_name = slugifyType(form.field_name)
    if (!content_type || !field_name) {
      setFormError('content_type and field_name are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/guardrails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type,
          field_name,
          template_content: form.template_content,
        }),
      })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || 'Save failed')
      setShowAdd(false)
      setForm({ content_type: '', field_name: '', template_content: '' })
      load()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h1>Guardrails</h1>
            <p className={styles.subtitle}>
              Global content templates per content type. Edits apply to ALL tenants. Used by the AI campaign generator.
            </p>
          </div>
          <Button onClick={() => setShowAdd(true)}>
            <Plus size={16} />
            Add Guardrail
          </Button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading && <p className={styles.loading}>Loading...</p>}

      {!loading && summary.length === 0 && !error && (
        <Card>
          <p>No guardrail templates seeded. Insert rows into <code>guardrail_templates</code> table.</p>
        </Card>
      )}

      <div className={styles.grid}>
        {summary.map((entry) => {
          const slug = entry.type.replace(/_/g, '-')
          return (
            <div key={entry.type} className={styles.cardWrap}>
              <Link href={`/guardrails/${slug}`}>
                <Card interactive className={styles.card}>
                  <h3>{prettifyType(entry.type)}</h3>
                  <p className={styles.fieldCount}>{entry.fields.length} fields</p>
                  <div className={styles.fieldList}>
                    {entry.fields.slice(0, 5).map((f) => (
                      <span key={f} className={styles.field}>
                        {f}
                      </span>
                    ))}
                    {entry.fields.length > 5 && (
                      <span className={styles.more}>+{entry.fields.length - 5} more</span>
                    )}
                  </div>
                </Card>
              </Link>
              <button
                className={styles.cardDelete}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setDeleteTarget(entry)
                }}
                aria-label={`Delete ${prettifyType(entry.type)}`}
                title="Delete content type"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )
        })}
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={deleteTarget ? `Delete ${prettifyType(deleteTarget.type)}?` : ''}
      >
        {deleteTarget && (
          <div className={styles.confirmBody}>
            <p>
              Deletes ALL <strong>{deleteTarget.fields.length}</strong> field templates
              for <code>{deleteTarget.type}</code> globally. AI generation for this content type will lose its structure rules.
            </p>
            <p className={styles.confirmWarning}>This cannot be undone.</p>
            <div className={styles.formActions}>
              <Button
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteType} loading={deleting}>
                Delete {deleteTarget.fields.length} fields
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showAdd}
        onClose={() => {
          setShowAdd(false)
          setFormError('')
        }}
        title="Add Guardrail"
      >
        <form onSubmit={handleCreate} className={styles.form}>
          <p className={styles.formHint}>
            Add a new content type or extend an existing one with another field. Field name will be slugified (e.g. &ldquo;Title Tag&rdquo; → <code>title_tag</code>).
          </p>

          <label className={styles.formLabel}>
            Content type
            <input
              className={styles.formInput}
              placeholder="e.g. landing_page or new content type"
              value={form.content_type}
              onChange={(e) => setForm((p) => ({ ...p, content_type: e.target.value }))}
              required
              list="existing-types"
            />
            <datalist id="existing-types">
              {summary.map((s) => (
                <option key={s.type} value={s.type} />
              ))}
            </datalist>
          </label>

          <label className={styles.formLabel}>
            Field name
            <input
              className={styles.formInput}
              placeholder="e.g. structure, metadata, tone"
              value={form.field_name}
              onChange={(e) => setForm((p) => ({ ...p, field_name: e.target.value }))}
              required
            />
          </label>

          <label className={styles.formLabel}>
            Template content
            <textarea
              className={styles.formTextarea}
              placeholder="Markdown / structure template..."
              value={form.template_content}
              onChange={(e) =>
                setForm((p) => ({ ...p, template_content: e.target.value }))
              }
              rows={8}
            />
          </label>

          {formError && <p className={styles.formError}>{formError}</p>}

          <div className={styles.formActions}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAdd(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
