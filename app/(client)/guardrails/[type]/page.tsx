'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import { Button } from '@/components/ui/button'
import { GuardrailEditor } from '@/components/client/guardrail-editor'
import styles from './page.module.css'

interface Revision {
  id: string
  content_type: string
  field_name: string
  value: string
  source: 'bot' | 'client'
  updated_at: string
  needs_review: boolean
}

export default function GuardrailTypePage({ params }: { params: Promise<{ type: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const contentType = resolvedParams.type.replace(/[-]/g, '_')

  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [values, setValues] = useState<Record<string, string>>({})
  const [revisions, setRevisions] = useState<Revision[]>([])

  useEffect(() => {
    fetchData()
  }, [contentType])

  async function fetchData() {
    const res = await fetch('/api/guardrails')
    const data = await res.json()

    const typeTemplates: Record<string, string> = {}
    const typeValues: Record<string, string> = {}
    const typeRevisions: Revision[] = []

    data.templates?.forEach((t: { content_type: string; field_name: string; template_content: string }) => {
      if (t.content_type === contentType) {
        typeTemplates[t.field_name] = t.template_content
      }
    })

    data.values?.forEach((v: Revision) => {
      if (v.content_type === contentType) {
        typeValues[v.field_name] = v.value
        typeRevisions.push(v)
      }
    })

    setTemplates(typeTemplates)
    setValues(typeValues)
    setRevisions(typeRevisions.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ))
  }

  async function handleSave(fieldName: string, value: string) {
    await fetch('/api/guardrails', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_type: contentType, field_name: fieldName, value }),
    })
    fetchData()
  }

  async function handleAcknowledge(revisionId: string) {
    await fetch('/api/guardrails', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_type: contentType,
        revision_id: revisionId,
        needs_review: false,
      }),
    })
    fetchData()
  }

  const displayName = contentType.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Button variant="ghost" onClick={() => router.push('/guardrails')}>
            Back
          </Button>
          <h1>{displayName} Guardrails</h1>
        </div>
      </div>

      <GuardrailEditor
        contentType={contentType}
        template={templates}
        values={values}
        revisions={revisions}
        onSave={handleSave}
        onAcknowledge={handleAcknowledge}
      />
    </div>
  )
}
