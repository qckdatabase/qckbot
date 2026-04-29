'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import styles from './page.module.css'

interface Template {
  content_type: string
  field_name: string
  template_content: string
}

export default function AdminGuardrailTypePage({
  params,
}: {
  params: { type: string }
}) {
  const router = useRouter()
  const contentType = params.type.replace(/-/g, '_')

  const [fields, setFields] = useState<Template[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [savingField, setSavingField] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [savedField, setSavedField] = useState<string | null>(null)
  const [showAddField, setShowAddField] = useState(false)
  const [newField, setNewField] = useState({ field_name: '', template_content: '' })
  const [addingField, setAddingField] = useState(false)
  const [addError, setAddError] = useState('')
  const [deletingField, setDeletingField] = useState<string | null>(null)
  const [deleteFieldTarget, setDeleteFieldTarget] = useState<string | null>(null)
  const [deleteTypeConfirm, setDeleteTypeConfirm] = useState(false)
  const [deletingType, setDeletingType] = useState(false)

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/guardrails', { cache: 'no-store' })
    const data = await res.json()
    const matches: Template[] = (data.templates || []).filter(
      (t: Template) => t.content_type === contentType
    )
    setFields(matches)
    const initialDrafts: Record<string, string> = {}
    matches.forEach((t) => {
      initialDrafts[t.field_name] = t.template_content
    })
    setDrafts(initialDrafts)
  }, [contentType])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleSave(fieldName: string) {
    setError('')
    setSavingField(fieldName)
    try {
      const res = await fetch('/api/guardrails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: contentType,
          field_name: fieldName,
          template_content: drafts[fieldName],
        }),
      })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || 'Save failed')
      setSavedField(fieldName)
      setTimeout(() => setSavedField(null), 2000)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSavingField(null)
    }
  }

  const displayName = contentType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())

  function slugifyField(s: string): string {
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

  async function handleDeleteField() {
    if (!deleteFieldTarget) return
    setDeletingField(deleteFieldTarget)
    setError('')
    try {
      const params = new URLSearchParams({
        content_type: contentType,
        field_name: deleteFieldTarget,
      })
      const res = await fetch(`/api/guardrails?${params}`, { method: 'DELETE' })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || 'Delete failed')
      setDeleteFieldTarget(null)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeletingField(null)
    }
  }

  async function handleDeleteType() {
    setDeletingType(true)
    setError('')
    try {
      const params = new URLSearchParams({ content_type: contentType })
      const res = await fetch(`/api/guardrails?${params}`, { method: 'DELETE' })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || 'Delete failed')
      router.push('/guardrails')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeletingType(false)
    }
  }

  async function handleAddField(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    const field_name = slugifyField(newField.field_name)
    if (!field_name) {
      setAddError('Field name is required')
      return
    }
    if (fields.some((f) => f.field_name === field_name)) {
      setAddError(`Field "${field_name}" already exists`)
      return
    }
    setAddingField(true)
    try {
      const res = await fetch('/api/guardrails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: contentType,
          field_name,
          template_content: newField.template_content,
        }),
      })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || 'Save failed')
      setShowAddField(false)
      setNewField({ field_name: '', template_content: '' })
      fetchData()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setAddingField(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <Button variant="ghost" onClick={() => router.push('/guardrails')}>
          ← Back to Guardrails
        </Button>
        <div className={styles.headerRow}>
          <div>
            <h1>{displayName} Templates</h1>
            <p className={styles.subtitle}>
              Edits apply globally across all tenants. Used as the structure / metadata template by AI generation.
            </p>
          </div>
          <div className={styles.headerActions}>
            <Button onClick={() => setShowAddField(true)}>
              <Plus size={16} />
              Add Field
            </Button>
            <Button
              variant="danger"
              onClick={() => setDeleteTypeConfirm(true)}
              disabled={fields.length === 0}
            >
              <Trash2 size={16} />
              Delete Type
            </Button>
          </div>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {fields.length === 0 && (
        <Card>
          <p>No templates found for &ldquo;{displayName}&rdquo;.</p>
        </Card>
      )}

      <Modal
        isOpen={!!deleteFieldTarget}
        onClose={() => setDeleteFieldTarget(null)}
        title={deleteFieldTarget ? `Delete field "${deleteFieldTarget}"?` : ''}
      >
        {deleteFieldTarget && (
          <div className={styles.confirmBody}>
            <p>
              Removes the <code>{deleteFieldTarget}</code> template from <code>{contentType}</code> globally. AI generation for this content type will lose this field&apos;s rules.
            </p>
            <p className={styles.confirmWarning}>This cannot be undone.</p>
            <div className={styles.formActions}>
              <Button
                variant="ghost"
                onClick={() => setDeleteFieldTarget(null)}
                disabled={deletingField === deleteFieldTarget}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteField}
                loading={deletingField === deleteFieldTarget}
              >
                Delete field
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={deleteTypeConfirm}
        onClose={() => setDeleteTypeConfirm(false)}
        title={`Delete ${displayName} guardrails?`}
      >
        <div className={styles.confirmBody}>
          <p>
            This deletes ALL <strong>{fields.length}</strong> field templates for{' '}
            <code>{contentType}</code> globally. AI generation for this content type will lose its structure rules.
          </p>
          <p className={styles.confirmWarning}>This cannot be undone.</p>
          <div className={styles.formActions}>
            <Button
              variant="ghost"
              onClick={() => setDeleteTypeConfirm(false)}
              disabled={deletingType}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteType} loading={deletingType}>
              Delete {fields.length} fields
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showAddField}
        onClose={() => {
          setShowAddField(false)
          setAddError('')
        }}
        title={`Add Field to ${displayName}`}
      >
        <form onSubmit={handleAddField} className={styles.addForm}>
          <p className={styles.formHint}>
            Field name will be slugified (e.g. &ldquo;Title Tag&rdquo; → <code>title_tag</code>).
          </p>

          <label className={styles.formLabel}>
            Field name
            <input
              className={styles.formInput}
              placeholder="e.g. structure, metadata, tone"
              value={newField.field_name}
              onChange={(e) =>
                setNewField((p) => ({ ...p, field_name: e.target.value }))
              }
              required
            />
          </label>

          <label className={styles.formLabel}>
            Template content
            <textarea
              className={styles.formTextarea}
              placeholder="Markdown / structure template..."
              value={newField.template_content}
              onChange={(e) =>
                setNewField((p) => ({ ...p, template_content: e.target.value }))
              }
              rows={8}
            />
          </label>

          {addError && <p className={styles.formError}>{addError}</p>}

          <div className={styles.formActions}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAddField(false)}
              disabled={addingField}
            >
              Cancel
            </Button>
            <Button type="submit" loading={addingField}>
              Create Field
            </Button>
          </div>
        </form>
      </Modal>

      <div className={styles.fields}>
        {fields.map((t) => {
          const dirty = drafts[t.field_name] !== t.template_content
          return (
            <Card key={t.field_name} className={styles.fieldCard}>
              <div className={styles.fieldHeader}>
                <h3>{t.field_name}</h3>
                <div className={styles.fieldActions}>
                  {savedField === t.field_name && (
                    <span className={styles.saved}>Saved</span>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSave(t.field_name)}
                    disabled={!dirty}
                    loading={savingField === t.field_name}
                  >
                    Save
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteFieldTarget(t.field_name)}
                    loading={deletingField === t.field_name}
                    aria-label={`Delete ${t.field_name}`}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
              <textarea
                className={styles.textarea}
                value={drafts[t.field_name] ?? ''}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [t.field_name]: e.target.value }))
                }
                rows={Math.max(8, (drafts[t.field_name] ?? '').split('\n').length + 1)}
              />
            </Card>
          )
        })}
      </div>
    </div>
  )
}
