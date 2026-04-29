'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Sparkles, Info, Trash2, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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
  google_doc_url: string | null
  live_url: string | null
  keyword_difficulty: number | null
  keyword_volume: number | null
}

function statusVariant(status: string): 'success' | 'warning' | 'default' | 'error' {
  if (status === 'published') return 'success'
  if (status === 'reviewing' || status === 'generated') return 'warning'
  if (status === 'failed') return 'error'
  return 'default'
}

async function safeJson(res: Response): Promise<{ error?: string; success?: boolean; cap_reached?: boolean }> {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { error: `Server returned ${res.status} (non-JSON). ${text.slice(0, 120)}` }
  }
}

function formatScheduledDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatCreatedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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

  function renderDraftCell(c: Campaign) {
    if (c.status === 'pending' || c.status === 'failed') {
      return (
        <Button
          size="sm"
          onClick={() => handleGenerate(c.id)}
          loading={generatingId === c.id}
        >
          <Sparkles size={14} />
          {c.status === 'failed' ? 'Retry' : 'Generate'}
        </Button>
      )
    }
    if (c.google_doc_url) {
      return (
        <a
          href={c.google_doc_url}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.linkCell}
        >
          Doc <ExternalLink size={12} />
        </a>
      )
    }
    return (
      <Link href={`/campaigns/${c.id}`} className={styles.linkCell}>
        Open
      </Link>
    )
  }

  function renderLiveCell(c: Campaign) {
    if (!c.live_url) return <span className={styles.muted}>—</span>
    return (
      <a
        href={c.live_url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.linkCell}
      >
        Live <ExternalLink size={12} />
      </a>
    )
  }

  function renderRow(c: Campaign, dateLabel: string) {
    return (
      <tr key={c.id} className={styles.tableRow}>
        <td className={styles.tableCell}>
          <span className={styles.dateText}>{dateLabel}</span>
        </td>
        <td className={styles.tableCell}>
          <span className={styles.typeText}>{c.content_type.replace(/_/g, ' ')}</span>
        </td>
        <td className={`${styles.tableCell} ${styles.titleCell}`}>
          <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
          <span className={styles.titleText}>{c.title}</span>
        </td>
        <td className={styles.tableCell}>{c.primary_keyword}</td>
        <td className={`${styles.tableCell} ${styles.numCell}`}>
          {c.keyword_difficulty != null ? (
            formatNumber(c.keyword_difficulty)
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </td>
        <td className={`${styles.tableCell} ${styles.numCell}`}>
          {c.keyword_volume != null ? (
            formatNumber(c.keyword_volume)
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </td>
        <td className={styles.tableCell}>{renderDraftCell(c)}</td>
        <td className={styles.tableCell}>{renderLiveCell(c)}</td>
        <td className={`${styles.tableCell} ${styles.actionCell}`}>
          <button
            type="button"
            className={styles.rowDeleteBtn}
            onClick={() => askDelete(c.id, c.title)}
            disabled={deletingId === c.id}
            aria-label="Delete campaign"
            title="Delete campaign"
          >
            <Trash2 size={14} />
          </button>
        </td>
      </tr>
    )
  }

  function renderTable(rows: Campaign[], dateFor: (c: Campaign) => string) {
    return (
      <table className={styles.campaignTable}>
        <thead>
          <tr>
            <th className={styles.tableHead}>Date</th>
            <th className={styles.tableHead}>Content Type</th>
            <th className={styles.tableHead}>Title</th>
            <th className={styles.tableHead}>Keyword</th>
            <th className={`${styles.tableHead} ${styles.numCell}`}>KD</th>
            <th className={`${styles.tableHead} ${styles.numCell}`}>Volume</th>
            <th className={styles.tableHead}>Draft Link</th>
            <th className={styles.tableHead}>Live Link</th>
            <th className={`${styles.tableHead} ${styles.actionCell}`} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>{rows.map((c) => renderRow(c, dateFor(c)))}</tbody>
      </table>
    )
  }

  const scheduled = campaigns.filter((c) => c.scheduled_for)
  const adhoc = campaigns.filter((c) => !c.scheduled_for)

  const byMonth = new Map<string, { year: number; month: number; items: Campaign[] }>()
  for (const c of scheduled) {
    if (!c.scheduled_for) continue
    const d = new Date(c.scheduled_for + 'T00:00:00Z')
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    const monthKey = `${y}-${String(m).padStart(2, '0')}`
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, { year: y, month: m, items: [] })
    byMonth.get(monthKey)!.items.push(c)
  }
  for (const entry of byMonth.values()) {
    entry.items.sort((a, b) => (a.scheduled_for || '').localeCompare(b.scheduled_for || ''))
  }
  const monthKeys = Array.from(byMonth.keys()).sort()

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Campaigns</h1>
          <p className={styles.subtitle}>
            Use <Link href="/chat" className={styles.noteLink}>chat</Link> with{' '}
            <code>/plan-next-month</code> to plan + auto-generate 20 drafts, or chat one-offs. Hard cap: 20 contents per calendar month — exceeding it risks Google flagging the domain.
          </p>
        </div>
      </div>

      <div className={styles.note}>
        <Info size={14} className={styles.noteIcon} />
        <span>
          Cannibalization guard reads four sources before suggesting keywords:
          existing drafts, live blog slugs, live product slugs, and the latest{' '}
          <Link href="/keywords" className={styles.noteLink}>Keyword Tracker</Link> snapshot.
          KD and Volume are matched from the latest SEO snapshot — &mdash; means no match yet.
        </span>
      </div>

      {error && <p className={styles.errorBar}>{error}</p>}
      {loading && <p className={styles.loading}>Loading...</p>}

      {!loading && campaigns.length === 0 && !error && (
        <Card>
          <div className={styles.empty}>
            <p>No campaigns yet.</p>
            <p>Click &ldquo;Plan Next Month&rdquo; to generate up to 20 contents, or chat with the bot for one-offs.</p>
          </div>
        </Card>
      )}

      {monthKeys.map((monthKey) => {
        const entry = byMonth.get(monthKey)!
        const monthLabel = new Date(Date.UTC(entry.year, entry.month - 1, 1)).toLocaleDateString(undefined, {
          month: 'long',
          year: 'numeric',
        })
        return (
          <section key={monthKey} className={styles.monthSection}>
            <h2 className={styles.monthHeader}>
              <span className={styles.monthLabel}>{monthLabel}</span>
              <span className={styles.itemCount}>
                {entry.items.length} / 20 contents
              </span>
              <button
                type="button"
                className={styles.monthClearBtn}
                onClick={() => askDeleteMonth(entry.year, entry.month)}
                disabled={deletingMonth}
                title={`Delete all campaigns in ${monthLabel}`}
              >
                <Trash2 size={12} />
                {deletingMonth ? 'Deleting...' : 'Clear month'}
              </button>
            </h2>
            <div className={styles.tableWrap}>
              {renderTable(entry.items, (c) =>
                c.scheduled_for ? formatScheduledDate(c.scheduled_for) : '—'
              )}
            </div>
          </section>
        )
      })}

      {adhoc.length > 0 && (
        <section className={styles.adhocSection}>
          <h2 className={styles.monthHeader}>
            <span className={styles.monthLabel}>Ad-hoc</span>
            <span className={styles.itemCount}>{adhoc.length} contents</span>
          </h2>
          <div className={styles.tableWrap}>
            {renderTable(adhoc, (c) => formatCreatedDate(c.created_at))}
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
