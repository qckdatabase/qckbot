'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import styles from './guardrail-editor.module.css'

interface Revision {
  id: string
  field_name: string
  value: string
  source: 'bot' | 'client'
  updated_at: string
  needs_review: boolean
}

interface GuardrailEditorProps {
  contentType: string
  template: Record<string, string>
  values: Record<string, string>
  revisions: Revision[]
  onSave: (fieldName: string, value: string) => Promise<void>
  onAcknowledge: (revisionId: string) => Promise<void>
}

export function GuardrailEditor({
  contentType,
  template,
  values,
  revisions,
  onSave,
  onAcknowledge,
}: GuardrailEditorProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit')
  const [editField, setEditField] = useState('')
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  const fields = Object.keys(template)

  function handleFieldClick(field: string) {
    setEditField(field)
    setEditValue(values[field] || template[field] || '')
    setActiveTab('edit')
  }

  async function handleSave() {
    if (!editField) return
    setSaving(true)
    try {
      await onSave(editField, editValue)
    } finally {
      setSaving(false)
    }
  }

  function handleAcknowledge(revision: Revision) {
    onAcknowledge(revision.id)
  }

  return (
    <div className={styles.editor}>
      <div className={styles.left}>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'edit' ? styles.active : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            Edit
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'preview' ? styles.active : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
        </div>

        {activeTab === 'edit' ? (
          <div className={styles.editArea}>
            <div className={styles.fields}>
              {fields.map(field => (
                <button
                  key={field}
                  className={`${styles.fieldButton} ${editField === field ? styles.active : ''}`}
                  onClick={() => handleFieldClick(field)}
                >
                  {field}
                  {revisions.some(r => r.field_name === field && r.needs_review) && (
                    <Badge variant="new">NEW</Badge>
                  )}
                </button>
              ))}
            </div>

            {editField && (
              <div className={styles.textareaWrapper}>
                <label className={styles.label}>{editField}</label>
                <textarea
                  className={styles.textarea}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={10}
                />
                <div className={styles.saveRow}>
                  <Button onClick={handleSave} loading={saving} size="sm">
                    Save
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.preview}>
            <pre className={styles.previewText}>{editValue || template[editField] || ''}</pre>
          </div>
        )}
      </div>

      <div className={styles.right}>
        <h3>Revision History</h3>
        <div className={styles.revisions}>
          {revisions.length === 0 ? (
            <p className={styles.noRevisions}>No revisions yet</p>
          ) : (
            revisions.map(rev => (
              <div key={rev.id} className={styles.revision}>
                <div className={styles.revisionHeader}>
                  <Badge variant={rev.source === 'bot' ? 'warning' : 'default'}>
                    {rev.source}
                  </Badge>
                  <span className={styles.revisionDate}>
                    {new Date(rev.updated_at).toLocaleDateString()}
                  </span>
                </div>
                <div className={styles.revisionField}>{rev.field_name}</div>
                <div className={styles.revisionValue}>{rev.value}</div>
                {rev.needs_review && rev.source === 'bot' && (
                  <Button size="sm" variant="secondary" onClick={() => handleAcknowledge(rev)}>
                    Acknowledge
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
