'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { CalendarPlus, Sparkles } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import styles from './page.module.css'

interface Campaign {
  id: string
  title: string
  content_type: string
  primary_keyword: string
  status: string
  created_at: string
  scheduled_for: string | null
}

function statusVariant(status: string): 'success' | 'warning' | 'default' | 'error' {
  if (status === 'published') return 'success'
  if (status === 'reviewing' || status === 'generated') return 'warning'
  if (status === 'failed') return 'error'
  return 'default'
}

async function safeJson(res: Response): Promise<{ error?: string; success?: boolean }> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { error: `Server returned ${res.status} (non-JSON). ${text.slice(0, 120)}` }
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function weekKey(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const day = d.getUTCDay()
  const diffToMon = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diffToMon)
  return monday.toISOString().slice(0, 10)
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [planning, setPlanning] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/campaigns', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load campaigns')
      setCampaigns(json.campaigns || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handlePlanMonth() {
    setPlanning(true)
    setError('')
    try {
      const res = await fetch('/api/campaigns/plan-month', { method: 'POST' })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || 'Plan failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Plan failed')
    } finally {
      setPlanning(false)
    }
  }

  async function handleGenerate(id: string) {
    setGeneratingId(id)
    setError('')
    try {
      const res = await fetch(`/api/campaigns/${id}/generate`, { method: 'POST' })
      const json = await safeJson(res)
      if (!res.ok) throw new Error(json.error || 'Generation failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGeneratingId(null)
    }
  }

  const scheduled = campaigns.filter((c) => c.scheduled_for)
  const adhoc = campaigns.filter((c) => !c.scheduled_for)

  const byWeek = new Map<string, Campaign[]>()
  for (const c of scheduled) {
    if (!c.scheduled_for) continue
    const wk = weekKey(c.scheduled_for)
    if (!byWeek.has(wk)) byWeek.set(wk, [])
    byWeek.get(wk)!.push(c)
  }
  for (const list of byWeek.values()) {
    list.sort((a, b) => (a.scheduled_for || '').localeCompare(b.scheduled_for || ''))
  }
  const weekKeys = Array.from(byWeek.keys()).sort()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Campaigns</h1>
          <p className={styles.subtitle}>
            Plan an entire month at once (5 contents/week, Mon–Fri) or chat with the bot for one-offs.
          </p>
        </div>
        <Button onClick={handlePlanMonth} loading={planning}>
          <CalendarPlus size={16} />
          Plan Next Month
        </Button>
      </div>

      {error && <p className={styles.errorBar}>{error}</p>}
      {loading && <p className={styles.loading}>Loading...</p>}

      {!loading && campaigns.length === 0 && !error && (
        <Card>
          <div className={styles.empty}>
            <p>No campaigns yet.</p>
            <p>Click &ldquo;Plan Next Month&rdquo; to generate a 20-content calendar, or chat with the bot for one-offs.</p>
          </div>
        </Card>
      )}

      {weekKeys.map((wk) => (
        <section key={wk} className={styles.weekSection}>
          <h2 className={styles.weekHeader}>
            Week of {formatDate(wk)}
            <span className={styles.weekCount}>{byWeek.get(wk)!.length} contents</span>
          </h2>
          <div className={styles.weekGrid}>
            {byWeek.get(wk)!.map((c) => (
              <Card key={c.id} className={styles.scheduleCard}>
                <div className={styles.scheduleHeader}>
                  <span className={styles.scheduleDate}>
                    {c.scheduled_for ? formatDate(c.scheduled_for) : ''}
                  </span>
                  <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                </div>
                <h3 className={styles.scheduleTitle}>{c.title}</h3>
                <div className={styles.keyword}>{c.primary_keyword}</div>
                <div className={styles.type}>{c.content_type.replace(/_/g, ' ')}</div>
                <div className={styles.scheduleActions}>
                  {c.status === 'pending' || c.status === 'failed' ? (
                    <Button
                      size="sm"
                      onClick={() => handleGenerate(c.id)}
                      loading={generatingId === c.id}
                    >
                      <Sparkles size={14} />
                      {c.status === 'failed' ? 'Retry' : 'Generate'}
                    </Button>
                  ) : (
                    <Link href={`/campaigns/${c.id}`}>
                      <Button size="sm" variant="secondary">
                        Open Draft
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {adhoc.length > 0 && (
        <section className={styles.adhocSection}>
          <h2 className={styles.weekHeader}>Ad-hoc</h2>
          <div className={styles.grid}>
            {adhoc.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`}>
                <Card className={styles.card}>
                  <div className={styles.cardHeader}>
                    <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                    <span className={styles.date}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <h3>{c.title}</h3>
                  <div className={styles.keyword}>{c.primary_keyword}</div>
                  <div className={styles.type}>{c.content_type.replace(/_/g, ' ')}</div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
