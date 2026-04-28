'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
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

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCampaign()
  }, [resolvedParams.id])

  async function fetchCampaign() {
    const res = await fetch('/api/campaigns')
    const data = await res.json()
    const found = (data.campaigns || []).find((c: Campaign) => c.id === resolvedParams.id)
    setCampaign(found || null)
  }

  async function updateStatus(status: string) {
    setSaving(true)
    await fetch('/api/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resolvedParams.id, status }),
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

      <div className={styles.content}>
        <div className={styles.contentHeader}>
          <h2>Generated Content</h2>
          {campaign.google_doc_url && (
            <a href={campaign.google_doc_url} target="_blank" rel="noopener">
              <Button variant="secondary" size="sm">Open Google Doc</Button>
            </a>
          )}
        </div>
        <div className={styles.markdown}>
          {campaign.generated_content?.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h1 key={i}>{line.slice(2)}</h1>
            if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>
            if (line.startsWith('### ')) return <h3 key={i}>{line.slice(4)}</h3>
            if (line.startsWith('- ')) return <li key={i}>{line.slice(2)}</li>
            if (line.startsWith('**') && line.endsWith('**')) return <p key={i}><strong>{line.slice(2, -2)}</strong></p>
            if (line.trim() === '') return <br key={i} />
            return <p key={i}>{line}</p>
          })}
        </div>
      </div>

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
