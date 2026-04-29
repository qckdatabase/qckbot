'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { CalendarPlus, Sparkles, Info, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingMonth, setDeletingMonth] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    open: boolean
    title: string
    message: string
    confirmLabel: string
    variant: 'danger' | 'primary'
    action: () => Promise<void>
  } | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  const closeConfirm = () => {
    if (confirmLoading) return
    setConfirmState(null)
  }

  const runConfirm = async () => {
    if (!confirmState) return
    setConfirmLoading(true)
    try {
      await confirmState.action()
    } finally {
      setConfirmLoading(false)
      setConfirmState(null)
    }
  }

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

  function askDelete(id: string, title: string) {
    setConfirmState({
      open: true,
      title: 'Delete campaign?',
      message: `"${title}" will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      action: async () => {
        setDeletingId(id)
        setError('')
        try {
          const res = await fetch(`/api/campaigns/${id}`, { method: 'DELETE' })
          const json = await safeJson(res)
          if (!res.ok) throw new Error(json.error || 'Delete failed')
          setCampaigns((prev) => prev.filter((c) => c.id !== id))
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Delete failed')
        } finally {
          setDeletingId(null)
        }
      },
    })
  }

  function askDeleteWeek(weekKeyIso: string) {
    const weekCampaigns = campaigns.filter(
      (c) => c.scheduled_for && weekKey(c.scheduled_for) === weekKeyIso
    )
    const ids = weekCampaigns.map((c) => c.id)
    if (ids.length === 0) return
    const weekLabel = formatDate(weekKeyIso)
    setConfirmState({
      open: true,
      title: 'Clear this week?',
      message: `All ${ids.length} campaigns in the week of ${weekLabel} will be permanently removed. This cannot be undone.`,
      confirmLabel: `Delete ${ids.length}`,
      variant: 'danger',
      action: async () => {
        setDeletingMonth(true)
        setError('')
        try {
          const results = await Promise.allSettled(
            ids.map((id) => fetch(`/api/campaigns/${id}`, { method: 'DELETE' }))
          )
          const failed = results.filter(
            (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
          ).length
          if (failed > 0) {
            setError(`${failed} of ${ids.length} deletions failed`)
          }
          await load()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Bulk delete failed')
        } finally {
          setDeletingMonth(false)
        }
      },
    })
  }

  function askDeleteMonth(year: number, month: number) {
    const ids = campaigns
      .filter((c) => {
        if (!c.scheduled_for) return false
        const d = new Date(c.scheduled_for + 'T00:00:00Z')
        return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month
      })
      .map((c) => c.id)
    if (ids.length === 0) return
    const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    })
    setConfirmState({
      open: true,
      title: 'Clear month?',
      message: `All ${ids.length} campaigns scheduled in ${monthLabel} will be permanently removed. This cannot be undone.`,
      confirmLabel: `Delete ${ids.length}`,
      variant: 'danger',
      action: async () => {
        setDeletingMonth(true)
        setError('')
        try {
          const results = await Promise.allSettled(
            ids.map((id) => fetch(`/api/campaigns/${id}`, { method: 'DELETE' }))
          )
          const failed = results.filter(
            (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)
          ).length
          if (failed > 0) {
            setError(`${failed} of ${ids.length} deletions failed`)
          }
          await load()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Bulk delete failed')
        } finally {
          setDeletingMonth(false)
        }
      },
    })
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

  const byMonth = new Map<string, { year: number; month: number; weeks: Map<string, Campaign[]> }>()
  for (const c of scheduled) {
    if (!c.scheduled_for) continue
    const d = new Date(c.scheduled_for + 'T00:00:00Z')
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const monthKey = `${y}-${String(m).padStart(2, '0')}`
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, { year: y, month: m, weeks: new Map() })
    const monthEntry = byMonth.get(monthKey)!
    const wk = weekKey(c.scheduled_for)
    if (!monthEntry.weeks.has(wk)) monthEntry.weeks.set(wk, [])
    monthEntry.weeks.get(wk)!.push(c)
  }
  for (const monthEntry of byMonth.values()) {
    for (const list of monthEntry.weeks.values()) {
      list.sort((a, b) => (a.scheduled_for || '').localeCompare(b.scheduled_for || ''))
    }
  }
  const monthKeys = Array.from(byMonth.keys()).sort()

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

      <div className={styles.note}>
        <Info size={14} className={styles.noteIcon} />
        <span>
          Cannibalization guard reads four sources before suggesting keywords:
          existing drafts, live blog slugs, live product slugs, and the latest{' '}
          <Link href="/keywords" className={styles.noteLink}>Keyword Tracker</Link> snapshot.
          Drafts and sitemap data are pulled live each run; the tracker snapshot
          refreshes weekly via cron. If you published new content recently,
          click <strong>Regenerate</strong> on the Keyword Tracker page before
          planning to avoid duplicate keywords.
        </span>
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

      {monthKeys.map((monthKey) => {
        const monthEntry = byMonth.get(monthKey)!
        const monthLabel = new Date(Date.UTC(monthEntry.year, monthEntry.month - 1, 1)).toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })
        const weekKeys = Array.from(monthEntry.weeks.keys()).sort()
        const monthCount = Array.from(monthEntry.weeks.values()).reduce((s, l) => s + l.length, 0)
        return (
          <section key={monthKey} className={styles.monthSection}>
            <h2 className={styles.monthHeader}>
              <span className={styles.monthLabel}>{monthLabel}</span>
              <span className={styles.weekCount}>{monthCount} contents</span>
              <button
                type="button"
                className={styles.weekDeleteBtn}
                onClick={() => askDeleteMonth(monthEntry.year, monthEntry.month)}
                disabled={deletingMonth}
                title={`Delete all campaigns in ${monthLabel}`}
              >
                <Trash2 size={12} />
                {deletingMonth ? 'Deleting...' : 'Clear month'}
              </button>
            </h2>
            {weekKeys.map((wk) => (
        <section key={`${monthKey}-${wk}`} className={styles.weekSection}>
          <h3 className={styles.weekHeader}>
            Week of {formatDate(wk)}
            <span className={styles.weekCount}>{monthEntry.weeks.get(wk)!.length} contents</span>
            <button
              type="button"
              className={styles.weekDeleteBtn}
              onClick={() => askDeleteWeek(wk)}
              disabled={deletingMonth}
              title="Delete all campaigns in this week"
            >
              <Trash2 size={12} />
              Clear week
            </button>
          </h3>
          <div className={styles.weekGrid}>
            {monthEntry.weeks.get(wk)!.map((c) => (
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
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => askDelete(c.id, c.title)}
                    disabled={deletingId === c.id}
                    aria-label="Delete campaign"
                    title="Delete campaign"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </section>
            ))}
          </section>
        )
      })}

      {adhoc.length > 0 && (
        <section className={styles.adhocSection}>
          <h2 className={styles.weekHeader}>Ad-hoc</h2>
          <div className={styles.grid}>
            {adhoc.map((c) => (
              <div key={c.id} className={styles.adhocItem}>
                <Link href={`/campaigns/${c.id}`} className={styles.adhocLink}>
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
                <button
                  type="button"
                  className={styles.adhocDeleteBtn}
                  onClick={() => askDelete(c.id, c.title)}
                  disabled={deletingId === c.id}
                  aria-label="Delete campaign"
                  title="Delete campaign"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        isOpen={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant}
        loading={confirmLoading}
        onConfirm={runConfirm}
        onCancel={closeConfirm}
      />
    </div>
  )
}
