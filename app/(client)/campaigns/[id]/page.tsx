'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import styles from './page.module.css'

interface Campaign {
  id: string
  title: string
  content_type: string
  primary_keyword: string
  status: string
  generated_content: string
  google_doc_url: string | null
  live_url: string | null
  created_at: string
  updated_at: string
}

const META_KEYS = [
  'Title',
  'Proposed URL',
  'Title Tag',
  'Meta Description',
  'Content Intent',
  'Target Keyword',
] as const

type MetaKey = (typeof META_KEYS)[number]

interface ParsedDraft {
  meta: Partial<Record<MetaKey, string>>
  bodyMarkdown: string
}

function stripMd(s: string): string {
  return s.replace(/\*\*/g, '').replace(/__/g, '').trim()
}

function parseDraft(raw: string): ParsedDraft {
  const meta: Partial<Record<MetaKey, string>> = {}
  const lines = raw.split('\n')
  let lastMetaIdx = -1
  const scanLimit = Math.min(30, lines.length)

  for (let i = 0; i < scanLimit; i++) {
    const stripped = stripMd(lines[i])
    if (!stripped) continue

    if (Object.keys(meta).length > 0 && (stripped.startsWith('## ') || stripped.startsWith('# '))) {
      break
    }

    const matched = META_KEYS.find((k) =>
      stripped.toLowerCase().startsWith(`${k.toLowerCase()}:`)
    )
    if (matched) {
      const colonIdx = stripped.indexOf(':')
      meta[matched] = stripped.slice(colonIdx + 1).trim()
      lastMetaIdx = i
    }
  }

  let bodyStart = lastMetaIdx + 1
  while (bodyStart < lines.length && lines[bodyStart].trim() === '') bodyStart++

  const bodyMarkdown =
    lastMetaIdx === -1 ? raw.trim() : lines.slice(bodyStart).join('\n').trim()
  return { meta, bodyMarkdown }
}

export default function CampaignDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchCampaign = useCallback(async () => {
    const res = await fetch('/api/campaigns', { cache: 'no-store' })
    const data = await res.json()
    const found = (data.campaigns || []).find((c: Campaign) => c.id === params.id)
    setCampaign(found || null)
  }, [params.id])

  useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  async function updateStatus(status: string) {
    setSaving(true)
    await fetch('/api/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: params.id, status }),
    })
    fetchCampaign()
    setSaving(false)
  }

  if (!campaign) {
    return <div className={styles.loading}>Loading...</div>
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <Button variant="ghost" onClick={() => router.push('/campaigns')}>
            Back
          </Button>
          <h1>{campaign.title}</h1>
          <Badge variant={campaign.status === 'generated' ? 'success' : campaign.status === 'reviewing' ? 'warning' : 'default'}>{campaign.status}</Badge>
        </div>
        <div className={styles.actions}>
          {campaign.status === 'generated' && (
            <Button variant="secondary" onClick={() => updateStatus('reviewing')} loading={saving}>
              Mark for Review
            </Button>
          )}
          {campaign.status === 'reviewing' && (
            <Button variant="secondary" onClick={() => updateStatus('published')} loading={saving}>
              Mark Published
            </Button>
          )}
        </div>
      </div>

      <div className={styles.meta}>
        <div><strong>Keyword:</strong> {campaign.primary_keyword}</div>
        <div><strong>Type:</strong> {campaign.content_type}</div>
        <div><strong>Created:</strong> {new Date(campaign.created_at).toLocaleDateString()}</div>
      </div>

      {(() => {
        const { meta, bodyMarkdown } = parseDraft(campaign.generated_content || '')
        const hasMeta = Object.keys(meta).length > 0
        return (
          <>
            {hasMeta && (
              <div className={styles.draftMeta}>
                <h2>SEO Metadata</h2>
                <dl>
                  {META_KEYS.filter((k) => meta[k]).map((k) => (
                    <div key={k} className={styles.draftMetaRow}>
                      <dt>{k}</dt>
                      <dd>{meta[k]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className={styles.content}>
              <div className={styles.contentHeader}>
                <h2>Draft</h2>
                {campaign.google_doc_url && (
                  <a href={campaign.google_doc_url} target="_blank" rel="noopener">
                    <Button variant="secondary" size="sm">Open Google Doc</Button>
                  </a>
                )}
              </div>
              <article className={styles.prose}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {bodyMarkdown || campaign.generated_content || ''}
                </ReactMarkdown>
              </article>
            </div>
          </>
        )
      })()}

      {(campaign.live_url || campaign.google_doc_url) && (
        <div className={styles.links}>
          {campaign.google_doc_url && (
            <div>
              <strong>Google Doc:</strong>{' '}
              <a href={campaign.google_doc_url} target="_blank" rel="noopener">
                {campaign.google_doc_url}
              </a>
            </div>
          )}
          {campaign.live_url && (
            <div>
              <strong>Live URL:</strong>{' '}
              <a href={campaign.live_url} target="_blank" rel="noopener">
                {campaign.live_url}
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
