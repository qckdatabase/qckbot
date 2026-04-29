'use client'

import { useEffect, useCallback, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRefreshStatus } from '@/lib/use-refresh-status'
import styles from './page.module.css'

interface RankingEntry {
  rank: number
  brand: string
  domain: string
  reason: string
  url: string
  isUser: boolean
  domain_rating: number
  traffic: number
  backlinks: number
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

interface RankingResponse {
  keyword: string
  store: string
  category: string
  rankings: RankingEntry[]
  user_rank: number | null
  generated_at: string
}

export default function RankingPage() {
  const [data, setData] = useState<RankingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const { status: refreshStatus, refetch: refetchRefreshStatus } = useRefreshStatus()

  const loadCached = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/ranking', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load cached ranking')
      }
      if (json.data === null) {
        setData(null)
        return
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cached ranking')
    }
  }, [])

  const run = useCallback(async () => {
    setRunning(true)
    setError('')
    try {
      const res = await fetch('/api/ranking', { method: 'POST', cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to compute AI ranking')
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compute AI ranking')
    } finally {
      setRunning(false)
      refetchRefreshStatus()
    }
  }, [refetchRefreshStatus])

  useEffect(() => {
    loadCached().finally(() => setLoading(false))
  }, [loadCached])

  useEffect(() => {
    if (!refreshStatus.refresh_in_flight) {
      loadCached()
    }
  }, [refreshStatus.refresh_in_flight, loadCached])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>AI Ranking</h1>
        <Button
          variant="secondary"
          size="sm"
          onClick={run}
          loading={running || refreshStatus.refresh_in_flight}
          disabled={refreshStatus.refresh_in_flight}
        >
          {refreshStatus.refresh_in_flight
            ? 'Refreshing...'
            : data
              ? 'Regenerate'
              : 'Run'}
        </Button>
      </div>

      <p className={styles.subtitle}>
        AI infers your category keyword, runs live web search, and ranks the top 10 stores a shopper would be recommended.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      {loading && !data && (
        <Card>
          <div className={styles.empty}>Loading cached ranking...</div>
        </Card>
      )}

      {!loading && !data && !running && (
        <Card>
          <div className={styles.empty}>No cached ranking yet. Click &ldquo;Run&rdquo; to generate (30–90s).</div>
        </Card>
      )}

      {running && (
        <Card>
          <div className={styles.empty}>Inferring keyword + running 2-stage AI websearch... 30–90s.</div>
        </Card>
      )}

      {data && (
        <>
          <div className={styles.metaRow}>
            <Badge variant="default">{data.category}</Badge>
            <span className={styles.metaText}>
              Keyword: <strong>{data.keyword}</strong>
            </span>
            <span className={styles.metaText}>
              Your rank:{' '}
              <strong>{data.user_rank ? `#${data.user_rank}` : 'Not in top 10'}</strong>
            </span>
            <span className={styles.timestamp}>
              {new Date(data.generated_at).toLocaleString()}
            </span>
          </div>

          <Card>
            <div className={styles.leaderboard}>
              {data.rankings.map((entry) => (
                <div
                  key={`${entry.rank}-${entry.brand}`}
                  className={`${styles.row} ${entry.isUser ? styles.clientRow : ''}`}
                >
                  <div className={styles.rank}>
                    {entry.rank}
                    {entry.rank <= 3 && <span className={styles.medal}>🏆</span>}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.name}>
                      {entry.brand}
                      {entry.isUser && <Badge variant="success">You</Badge>}
                    </div>
                    {entry.domain && (
                      <div className={styles.domain}>{entry.domain}</div>
                    )}
                    <div className={styles.rationale}>{entry.reason}</div>
                    {entry.url && (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.sourceLink}
                      >
                        Source
                      </a>
                    )}
                  </div>
                  <div className={styles.metrics}>
                    <div className={styles.metric}>
                      <span className={styles.metricValue}>{entry.domain_rating}</span>
                      <span className={styles.metricLabel}>DR</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricValue}>{formatNumber(entry.traffic)}</span>
                      <span className={styles.metricLabel}>Traffic</span>
                    </div>
                    <div className={styles.metric}>
                      <span className={styles.metricValue}>{formatNumber(entry.backlinks)}</span>
                      <span className={styles.metricLabel}>Backlinks</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
