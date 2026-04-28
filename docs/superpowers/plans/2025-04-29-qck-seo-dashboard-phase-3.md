# QCK SEO Dashboard — Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the content management and AI chat system — guardrail templates, campaign list/detail pages, RAG-powered chat interface, and campaign generation flow.

**Architecture:** OpenAI for chat completions with RAG context (tenant SEO data, competitors, guardrails). Chat messages stored in Supabase. Campaign generation creates drafts following universal guardrail templates. Google Docs integration for content storage.

**Tech Stack:** Next.js 14, Supabase, OpenAI (GPT-4o), CSS Modules

---

## File Structure

```
/
├── app/api/
│   ├── chat/route.ts           # Send message, get history
│   ├── campaigns/route.ts      # List/create/update campaigns
│   └── guardrails/route.ts    # Get templates, get/set values
├── app/(client)/
│   ├── guardrails/
│   │   └── [type]/page.tsx    # Guardrail editor
│   ├── campaigns/
│   │   ├── page.tsx          # Campaign list
│   │   └── [id]/page.tsx     # Campaign detail
│   └── chat/page.tsx          # Chat interface
├── components/
│   ├── client/
│   │   ├── guardrail-editor.tsx
│   │   ├── campaign-list.tsx
│   │   ├── campaign-detail.tsx
│   │   └── chat-interface.tsx
│   └── ui/
│       └── toast.tsx
└── lib/
    ├── openai.ts              # OpenAI client + RAG context builder
    └── google-docs.ts         # Google Docs integration
```

---

## Task 1: OpenAI Client + RAG Context Builder

**Files:**
- Create: `lib/openai.ts`

- [ ] **Step 1: Create lib/openai.ts**

```typescript
import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

interface TenantContext {
  tenant_id: string
  domain: string
  ahrefs_target: string
  seo_metrics: {
    domain_rating: number
    organic_keywords: number
    backlinks: number
    est_monthly_traffic: number
  }
  competitors: Array<{
    name: string
    domain_rating: number
    traffic: number
  }>
  guardrails: Record<string, string>
  recent_campaigns: Array<{
    title: string
    content_type: string
    status: string
  }>
}

export function buildRAGContext(context: TenantContext): string {
  return `
You are an SEO strategist for ${context.domain}.

Current SEO Metrics:
- Domain Rating: ${context.seo_metrics.domain_rating}
- Organic Keywords: ${context.seo_metrics.organic_keywords}
- Backlinks: ${context.seo_metrics.backlinks}
- Est. Monthly Traffic: ${context.seo_metrics.est_monthly_traffic}

Competitors:
${context.competitors.map(c => `- ${c.name} (DR: ${c.domain_rating}, Traffic: ${c.traffic})`).join('\n')}

Content Guardrails (format templates):
${Object.entries(context.guardrails).map(([type, template]) => `${type}: ${template}`).join('\n')}

Recent Campaigns:
${context.recent_campaigns.map(c => `- ${c.title} (${c.content_type}, ${c.status})`).join('\n')}

IMPORTANT: You can ONLY answer questions about this client's SEO data, competitors, campaigns, and content. If asked anything else, respond: "I can only help with your SEO and content campaigns. Ask me about your rankings, competitors, or to generate a new campaign."
`
}

export async function chatWithContext(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  context: TenantContext
): Promise<string> {
  const systemMessage = {
    role: 'system' as const,
    content: buildRAGContext(context),
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [systemMessage, ...messages],
    max_tokens: 2000,
  })

  return response.choices[0]?.message?.content || ''
}

export async function generateCampaignContent(
  tenantContext: TenantContext,
  contentType: string,
  keyword: string,
  guardrailTemplate: string
): Promise<string> {
  const systemPrompt = `${buildRAGContext(tenantContext)}

Generate a ${contentType} for keyword: ${keyword}

Follow this format template:
${guardrailTemplate}

Output ONLY the content in plain text with markdown formatting (## for H2, ### for H3, **bold**, - for lists). Start with metadata header: Title, Proposed URL, Title Tag, Meta Description, Content Intent, Target Keyword.
`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'system', content: systemPrompt }],
    max_tokens: 4000,
  })

  return response.choices[0]?.message?.content || ''
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/openai.ts
git commit -m "feat: add OpenAI client with RAG context builder"
```

---

## Task 2: API Routes

**Files:**
- Create: `app/api/chat/route.ts`
- Create: `app/api/campaigns/route.ts`
- Create: `app/api/guardrails/route.ts`

- [ ] **Step 1: Create app/api/guardrails/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!userData?.tenant_id) {
    return Response.json({ error: 'No tenant' }, { status: 400 })
  }

  const { data: templates } = await supabase
    .from('guardrail_templates')
    .select('*')

  const { data: values } = await supabase
    .from('guardrail_values')
    .select('*')
    .eq('tenant_id', userData.tenant_id)

  return Response.json({
    templates: templates || [],
    values: values || [],
  })
}

export async function PUT(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!userData?.tenant_id) {
    return Response.json({ error: 'No tenant' }, { status: 400 })
  }

  const body = await request.json()
  const { content_type, field_name, value } = body

  await supabase.from('guardrail_values').upsert({
    tenant_id: userData.tenant_id,
    content_type,
    field_name,
    value,
    source: 'client',
    needs_review: false,
    updated_at: new Date().toISOString(),
  })

  return Response.json({ success: true })
}
```

- [ ] **Step 2: Create app/api/campaigns/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!userData?.tenant_id) {
    return Response.json({ error: 'No tenant' }, { status: 400 })
  }

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .eq('tenant_id', userData.tenant_id)
    .order('created_at', { ascending: false })

  return Response.json({ campaigns: campaigns || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!userData?.tenant_id) {
    return Response.json({ error: 'No tenant' }, { status: 400 })
  }

  const body = await request.json()
  const { title, content_type, primary_keyword, generated_content } = body

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      tenant_id: userData.tenant_id,
      title,
      content_type,
      primary_keyword,
      generated_content,
      status: 'generated',
    })
    .select()
    .single()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ campaign })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, status, google_doc_url, live_url, generated_content } = body

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (status) updates.status = status
  if (google_doc_url) updates.google_doc_url = google_doc_url
  if (live_url) updates.live_url = live_url
  if (generated_content) updates.generated_content = generated_content

  const { error } = await supabase
    .from('campaigns')
    .update(updates)
    .eq('id', id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
```

- [ ] **Step 3: Create app/api/chat/route.ts**

```typescript
import { createClient } from '@/lib/supabase/server'
import { chatWithContext, generateCampaignContent } from '@/lib/openai'

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!userData?.tenant_id) {
    return Response.json({ error: 'No tenant' }, { status: 400 })
  }

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('tenant_id', userData.tenant_id)
    .order('created_at', { ascending: true })

  return Response.json({ messages: messages || [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single()

  if (!userData?.tenant_id) {
    return Response.json({ error: 'No tenant' }, { status: 400 })
  }

  const body = await request.json()
  const { content } = body

  await supabase.from('chat_messages').insert({
    tenant_id: userData.tenant_id,
    role: 'user',
    content,
  })

  const { data: tenant } = await supabase
    .from('tenants')
    .select('*')
    .eq('id', userData.tenant_id)
    .single()

  const { data: seoMetrics } = await supabase
    .from('seo_metrics')
    .select('*')
    .eq('tenant_id', userData.tenant_id)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  const { data: competitors } = await supabase
    .from('competitors')
    .select('name, domain_rating, traffic')
    .eq('tenant_id', userData.tenant_id)
    .limit(10)

  const { data: guardrailValues } = await supabase
    .from('guardrail_values')
    .select('content_type, field_name, value')
    .eq('tenant_id', userData.tenant_id)

  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('title, content_type, status')
    .eq('tenant_id', userData.tenant_id)
    .limit(10)

  const guardrailsMap: Record<string, string> = {}
  guardrailValues?.forEach(g => {
    if (!guardrailsMap[g.content_type]) {
      guardrailsMap[g.content_type] = ''
    }
    guardrailsMap[g.content_type] += `\n${g.field_name}: ${g.value}`
  })

  const context = {
    tenant_id: userData.tenant_id,
    domain: tenant?.domain || tenant?.ahrefs_target || '',
    ahrefs_target: tenant?.ahrefs_target || '',
    seo_metrics: seoMetrics ? {
      domain_rating: seoMetrics.domain_rating || 0,
      organic_keywords: seoMetrics.organic_keywords || 0,
      backlinks: seoMetrics.backlinks || 0,
      est_monthly_traffic: seoMetrics.est_monthly_traffic || 0,
    } : { domain_rating: 0, organic_keywords: 0, backlinks: 0, est_monthly_traffic: 0 },
    competitors: competitors || [],
    guardrails: guardrailsMap,
    recent_campaigns: campaigns || [],
  }

  const { data: history } = await supabase
    .from('chat_messages')
    .select('role, content')
    .eq('tenant_id', userData.tenant_id)
    .order('created_at', { ascending: true })
    .limit(20)

  const messages = (history || []).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const response = await chatWithContext(messages, context)

  await supabase.from('chat_messages').insert({
    tenant_id: userData.tenant_id,
    role: 'assistant',
    content: response,
  })

  return Response.json({ response })
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/chat/route.ts app/api/campaigns/route.ts app/api/guardrails/route.ts
git commit -m "feat: add API routes for chat, campaigns, guardrails"
```

---

## Task 3: Guardrail Editor

**Files:**
- Create: `components/client/guardrail-editor.tsx`
- Modify: `app/(client)/guardrails/[type]/page.tsx`
- Create: `app/(client)/guardrails/[type]/page.module.css`

- [ ] **Step 1: Create components/client/guardrail-editor.tsx**

```tsx
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
```

- [ ] **Step 2: Create components/client/guardrail-editor.module.css**

```css
.editor {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: var(--space-6);
  height: calc(100vh - 200px);
}

@media (max-width: 1024px) {
  .editor {
    grid-template-columns: 1fr;
  }
}

.left {
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
}

.tab {
  flex: 1;
  padding: var(--space-3);
  border: none;
  background: transparent;
  font-size: 14px;
  cursor: pointer;
  color: var(--color-text-muted);
}

.tab.active {
  color: var(--color-text);
  box-shadow: inset 0 -2px 0 var(--color-accent-dark);
}

.editArea {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.fields {
  width: 200px;
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  padding: var(--space-2);
}

.fieldButton {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  border: none;
  background: transparent;
  text-align: left;
  font-size: 14px;
  cursor: pointer;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.fieldButton:hover {
  background: var(--color-surface);
}

.fieldButton.active {
  background: var(--color-accent-dark);
  color: white;
}

.textareaWrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-4);
  overflow-y: auto;
}

.label {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: var(--space-2);
}

.textarea {
  flex: 1;
  width: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-family: monospace;
  font-size: 13px;
  resize: none;
}

.textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.saveRow {
  margin-top: var(--space-3);
  display: flex;
  justify-content: flex-end;
}

.preview {
  flex: 1;
  padding: var(--space-4);
  overflow-y: auto;
}

.previewText {
  white-space: pre-wrap;
  font-size: 14px;
  line-height: 1.6;
}

.right {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  overflow-y: auto;
}

.right h3 {
  font-size: 14px;
  margin-bottom: var(--space-4);
}

.revisions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.noRevisions {
  color: var(--color-text-muted);
  font-size: 14px;
}

.revision {
  padding: var(--space-3);
  background: var(--color-surface);
  border-radius: var(--radius-md);
}

.revisionHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
}

.revisionDate {
  font-size: 11px;
  color: var(--color-text-muted);
}

.revisionField {
  font-weight: 500;
  font-size: 13px;
  margin-bottom: var(--space-1);
}

.revisionValue {
  font-size: 12px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 3: Create app/(client)/guardrails/[type]/page.tsx**

```tsx
'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { GuardrailEditor } from '@/components/client/guardrail-editor'
import styles from './page.module.css'

interface Revision {
  id: string
  field_name: string
  value: string
  source: 'bot' | 'client'
  updated_at: string
  needs_review: boolean
}

export default function GuardrailTypePage({ params }: { params: Promise<{ type: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const contentType = resolvedParams.type.replace('-', '_')

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

  const displayName = contentType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Button variant="ghost" onClick={() => router.push('/guardrails')}>
            ← Back
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
```

- [ ] **Step 4: Create app/(client)/guardrails/[type]/page.module.css**

```css
.page {
  max-width: 1400px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-6);
}

.header h1 {
  font-size: 24px;
  margin-top: var(--space-2);
}
```

- [ ] **Step 5: Commit**

```bash
git add components/client/guardrail-editor.tsx components/client/guardrail-editor.module.css
git add app/\(client\)/guardrails/\[type\]/
git commit -m "feat: add guardrail editor with revision history"
```

---

## Task 4: Campaign List + Detail Pages

**Files:**
- Create: `components/client/campaign-list.tsx`
- Create: `components/client/campaign-detail.tsx`
- Modify: `app/(client)/campaigns/page.tsx`
- Create: `app/(client)/campaigns/[id]/page.tsx`

- [ ] **Step 1: Create components/client/campaign-list.tsx**

```tsx
'use client'

import Link from 'next/link'
import { Campaign } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import styles from './campaign-list.module.css'

interface CampaignListProps {
  campaigns: Campaign[]
}

const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'error' | 'new'> = {
  generating: 'warning',
  generated: 'default',
  revising: 'warning',
  approved: 'success',
  posted: 'default',
  failed: 'error',
}

export function CampaignList({ campaigns }: CampaignListProps) {
  if (campaigns.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No campaigns yet.</p>
        <p className={styles.hint}>Use the Chat to generate your first campaign.</p>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {campaigns.map(campaign => (
        <Link
          key={campaign.id}
          href={`/campaigns/${campaign.id}`}
          className={styles.item}
        >
          <div className={styles.info}>
            <div className={styles.title}>{campaign.title}</div>
            <div className={styles.meta}>
              {campaign.content_type.replace('_', ' ')} • {campaign.primary_keyword}
            </div>
          </div>
          <Badge variant={statusVariants[campaign.status] || 'default'}>
            {campaign.status}
          </Badge>
        </Link>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create components/client/campaign-list.module.css**

```css
.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all 150ms ease;
}

.item:hover {
  background: var(--color-surface);
  border-color: var(--color-accent);
}

.info {
  min-width: 0;
}

.title {
  font-weight: 600;
  margin-bottom: var(--space-1);
}

.meta {
  font-size: 13px;
  color: var(--color-text-muted);
  text-transform: capitalize;
}

.empty {
  text-align: center;
  padding: var(--space-10);
  color: var(--color-text-muted);
}

.hint {
  font-size: 14px;
  margin-top: var(--space-2);
}
```

- [ ] **Step 3: Create components/client/campaign-detail.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Campaign } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import styles from './campaign-detail.module.css'

interface CampaignDetailProps {
  campaign: Campaign
}

export function CampaignDetail({ campaign }: CampaignDetailProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState(campaign.generated_content || '')

  const statusVariants: Record<string, 'default' | 'success' | 'warning' | 'error'> = {
    generating: 'warning',
    generated: 'default',
    revising: 'warning',
    approved: 'success',
    posted: 'default',
    failed: 'error',
  }

  async function handleApprove() {
    setLoading(true)
    try {
      await fetch('/api/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: campaign.id, status: 'approved' }),
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.detail}>
      <div className={styles.header}>
        <div>
          <h1>{campaign.title}</h1>
          <div className={styles.meta}>
            <Badge variant={statusVariants[campaign.status]}>
              {campaign.status}
            </Badge>
            <span>{campaign.content_type.replace('_', ' ')}</span>
            <span>•</span>
            <span>{campaign.primary_keyword}</span>
          </div>
        </div>
        <div className={styles.actions}>
          {campaign.google_doc_url && (
            <Button
              variant="secondary"
              onClick={() => window.open(campaign.google_doc_url!, '_blank')}
            >
              Open Google Doc
            </Button>
          )}
          {campaign.status === 'generated' && (
            <Button onClick={handleApprove} loading={loading}>
              Approve
            </Button>
          )}
        </div>
      </div>

      <div className={styles.content}>
        <h3>Generated Content</h3>
        <pre className={styles.pre}>{content || 'No content generated yet.'}</pre>
      </div>

      <div className={styles.chat}>
        <h3>Request Revisions</h3>
        <p className={styles.chatHint}>
          Ask for changes like "Make the intro shorter" or "Add more product mentions"
        </p>
        <Button variant="secondary" onClick={() => router.push('/chat')}>
          Go to Chat
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create campaign-detail.module.css**

```css
.detail {
  max-width: 900px;
}

.header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-6);
  gap: var(--space-4);
  flex-wrap: wrap;
}

.header h1 {
  font-size: 24px;
  margin-bottom: var(--space-2);
}

.meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--color-text-muted);
  font-size: 14px;
}

.actions {
  display: flex;
  gap: var(--space-2);
}

.content {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
}

.content h3 {
  font-size: 14px;
  margin-bottom: var(--space-3);
}

.pre {
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.7;
  max-height: 500px;
  overflow-y: auto;
}

.chat {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}

.chat h3 {
  font-size: 14px;
  margin-bottom: var(--space-2);
}

.chatHint {
  font-size: 14px;
  color: var(--color-text-muted);
  margin-bottom: var(--space-4);
}
```

- [ ] **Step 5: Update app/(client)/campaigns/page.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Campaign } from '@/lib/types'
import { CampaignList } from '@/components/client/campaign-list'
import styles from './page.module.css'

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  useEffect(() => {
    fetchCampaigns()
  }, [])

  async function fetchCampaigns() {
    const res = await fetch('/api/campaigns')
    const data = await res.json()
    setCampaigns(data.campaigns || [])
  }

  return (
    <div className={styles.page}>
      <h1>Campaigns</h1>
      <CampaignList campaigns={campaigns} />
    </div>
  )
}
```

- [ ] **Step 6: Create app/(client)/campaigns/[id]/page.tsx**

```tsx
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CampaignDetail } from '@/components/client/campaign-detail'

export default async function CampaignDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!campaign) {
    notFound()
  }

  return <CampaignDetail campaign={campaign} />
}
```

- [ ] **Step 7: Commit**

```bash
git add components/client/campaign-list.tsx components/client/campaign-list.module.css
git add components/client/campaign-detail.tsx components/client/campaign-detail.module.css
git add app/\(client\)/campaigns/
git commit -m "feat: add campaign list and detail pages"
```

---

## Task 5: Chat Interface

**Files:**
- Create: `components/client/chat-interface.tsx`
- Modify: `app/(client)/chat/page.tsx`
- Create: `app/(client)/chat/page.module.css`

- [ ] **Step 1: Create components/client/chat-interface.tsx**

```tsx
'use client'

import { useEffect, useState, useRef } from 'react'
import { ChatMessage } from '@/lib/types'
import { Button } from '@/components/ui/button'
import styles from './chat-interface.module.css'

interface ChatInterfaceProps {
  initialMessages?: ChatMessage[]
}

export function ChatInterface({ initialMessages = [] }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim()) return

    const userMessage = input.trim()
    setInput('')
    setError('')

    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      tenant_id: '',
      role: 'user',
      content: userMessage,
      action_type: null,
      action_meta: null,
      created_at: new Date().toISOString(),
    }])

    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: userMessage }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to get response')
      }

      const data = await res.json()

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        tenant_id: '',
        role: 'assistant',
        content: data.response,
        action_type: null,
        action_meta: null,
        created_at: new Date().toISOString(),
      }])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={styles.interface}>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.empty}>
            <p>Ask me to generate a campaign or about your SEO data.</p>
            <p className={styles.examples}>
              Try: "Generate a campaign for June" or "What keywords should I target?"
            </p>
          </div>
        )}

        {messages.map(message => (
          <div
            key={message.id}
            className={`${styles.message} ${message.role === 'user' ? styles.user : styles.assistant}`}
          >
            <div className={styles.role}>{message.role === 'user' ? 'You' : 'Qckbot'}</div>
            <div className={styles.content}>{message.content}</div>
          </div>
        ))}

        {loading && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.role}>Qckbot</div>
            <div className={styles.content}>Thinking...</div>
          </div>
        )}

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <textarea
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your SEO or request a campaign..."
          rows={2}
        />
        <Button onClick={handleSend} loading={loading} disabled={!input.trim()}>
          Send
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create components/client/chat-interface.module.css**

```css
.interface {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 150px);
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.empty {
  text-align: center;
  padding: var(--space-10);
  color: var(--color-text-muted);
}

.examples {
  font-size: 14px;
  margin-top: var(--space-2);
}

.message {
  max-width: 80%;
}

.user {
  align-self: flex-end;
}

.assistant {
  align-self: flex-start;
}

.role {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: var(--space-1);
  text-transform: uppercase;
}

.user .role {
  text-align: right;
}

.content {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.user .content {
  background: var(--color-accent-dark);
  color: white;
  border-bottom-right-radius: 4px;
}

.assistant .content {
  background: var(--color-surface);
  border-bottom-left-radius: 4px;
}

.error {
  padding: var(--space-3);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--color-error);
  color: var(--color-error);
  border-radius: var(--radius-md);
  font-size: 14px;
}

.inputArea {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-4);
  border-top: 1px solid var(--color-border);
}

.input {
  flex: 1;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: 14px;
  resize: none;
}

.input:focus {
  outline: none;
  border-color: var(--color-accent);
}
```

- [ ] **Step 3: Update app/(client)/chat/page.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { ChatMessage } from '@/lib/types'
import { ChatInterface } from '@/components/client/chat-interface'
import styles from './page.module.css'

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  useEffect(() => {
    fetchHistory()
  }, [])

  async function fetchHistory() {
    const res = await fetch('/api/chat')
    const data = await res.json()
    setMessages(data.messages || [])
  }

  return (
    <div className={styles.page}>
      <h1>Chat</h1>
      <ChatInterface initialMessages={messages} />
    </div>
  )
}
```

- [ ] **Step 4: Create app/(client)/chat/page.module.css**

```css
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page h1 {
  font-size: 24px;
  margin-bottom: var(--space-4);
}
```

- [ ] **Step 5: Commit**

```bash
git add components/client/chat-interface.tsx components/client/chat-interface.module.css
git add app/\(client\)/chat/
git commit -m "feat: add chat interface with RAG context"
```

---

## Task 6: Guardrails Grid Page Update

**Files:**
- Modify: `app/(client)/guardrails/page.tsx`

- [ ] **Step 1: Update app/(client)/guardrails/page.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import styles from './page.module.css'

interface GuardrailTemplate {
  id: string
  content_type: string
  field_name: string
}

export default function GuardrailsPage() {
  const [templates, setTemplates] = useState<GuardrailTemplate[]>([])
  const [needsReviewCount, setNeedsReviewCount] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const res = await fetch('/api/guardrails')
    const data = await res.json()

    const contentTypes = [...new Set(data.templates?.map((t: GuardrailTemplate) => t.content_type) || [])]
    setTemplates(contentTypes.map(ct => ({
      id: ct,
      content_type: ct,
      field_name: ct,
    })))

    const reviewCount = data.values?.filter((v: { needs_review: boolean }) => v.needs_review).length || 0
    setNeedsReviewCount(reviewCount)
  }

  const contentTypes = [
    { id: 'blog', label: 'Blog Post' },
    { id: 'blog_refresh', label: 'Blog Post Refresh' },
    { id: 'shoppable', label: 'Shoppable Article' },
    { id: 'collection_refresh', label: 'Collection Page Refresh' },
    { id: 'listicle', label: 'Listicle' },
    { id: 'html_listicle', label: 'HTML Listicle' },
    { id: 'location_page', label: 'Location Page' },
    { id: 'landing_page', label: 'New Landing Page' },
    { id: 'llm', label: 'LLM Page' },
    { id: 'knowledge_center', label: 'Knowledge Center' },
    { id: 'service_page', label: 'Service Page' },
    { id: 'faq_guide', label: 'FAQ Guide' },
  ]

  return (
    <div className={styles.page}>
      <h1>Guardrails</h1>

      {needsReviewCount > 0 && (
        <div className={styles.alert}>
          <Badge variant="new">{needsReviewCount}</Badge>
          <span>bot changes need your review</span>
        </div>
      )}

      <div className={styles.grid}>
        {contentTypes.map(ct => (
          <Link key={ct.id} href={`/guardrails/${ct.id}`}>
            <Card className={styles.card}>
              <div className={styles.cardTitle}>{ct.label}</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update app/(client)/guardrails/page.module.css**

```css
.page {
  max-width: 1200px;
}

.page h1 {
  font-size: 24px;
  margin-bottom: var(--space-6);
}

.alert {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-6);
  font-size: 14px;
  color: var(--color-error);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--space-4);
}

.card {
  cursor: pointer;
  transition: all 150ms ease;
}

.card:hover {
  border-color: var(--color-accent);
}

.cardTitle {
  font-weight: 600;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(client\)/guardrails/
git commit -m "feat: update guardrails page with content type grid"
```

---

## Summary

Phase 3 builds:
1. OpenAI client with RAG context builder
2. API routes (chat, campaigns, guardrails)
3. Guardrail editor with revision history
4. Campaign list + detail pages
5. Chat interface with full RAG
6. Guardrails grid page

**Total: 6 tasks, ~20 steps**

---

**Plan complete.** Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
