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

interface ThemeResult {
  theme: string
  keyword: string
  category: string
  rankings: RankingEntry[]
  user_rank: number | null
}

interface RankingResponse {
  store: string
  themes: ThemeResult[]
  visibility_score: number
  avg_rank: number | null
  ranked_in_count: number
  total_themes: number
  generated_at: string
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export default function RankingPage() {
  const [data, setData] = useState<RankingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const { status: refreshStatus, refetch: refetchRefreshStatus } = useRefreshStatus()

  const loadCached = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/ranking', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load cached ranking')
      }
      if (json.data === null || !json.themes) {
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

  const toggle = (key: string) =>
    setExpanded((s) => ({ ...s, [key]: !s[key] }))

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
        We map your store&rsquo;s offering into 3-5 themes (products and services), then run live AI/web search on each. You see where shoppers find you and where you&rsquo;re invisible.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      {loading && !data && (
        <Card>
          <div className={styles.empty}>Loading cached ranking...</div>
        </Card>
      )}

      {!loading && !data && !running && (
        <Card>
          <div className={styles.empty}>No cached ranking yet. Click &ldquo;Run&rdquo; to generate (1-3 min — searches multiple themes).</div>
        </Card>
      )}

      {running && (
        <Card>
          <div className={styles.empty}>Mapping themes + running AI websearch on each... 1-3 min.</div>
        </Card>
      )}

      {data && (
        <>
          <div className={styles.scoreCard}>
            <div className={styles.scoreMain}>
              <div className={styles.scoreValue}>
                {Math.round(data.visibility_score * 100)}%
              </div>
              <div className={styles.scoreLabel}>AI Visibility</div>
            </div>
            <div className={styles.scoreStats}>
              <div className={styles.scoreStat}>
                <span className={styles.scoreStatValue}>
                  {data.ranked_in_count}/{data.total_themes}
                </span>
                <span className={styles.scoreStatLabel}>themes ranked</span>
              </div>
              <div className={styles.scoreStat}>
                <span className={styles.scoreStatValue}>
                  {data.avg_rank !== null ? `#${data.avg_rank.toFixed(1)}` : '—'}
                </span>
                <span className={styles.scoreStatLabel}>avg rank where present</span>
              </div>
              <div className={styles.scoreStat}>
                <span className={styles.scoreStatValue}>
                  {new Date(data.generated_at).toLocaleDateString()}
                </span>
                <span className={styles.scoreStatLabel}>generated</span>
              </div>
            </div>
          </div>

          <div className={styles.themeList}>
            {data.themes.map((t) => {
              const key = `${t.theme}-${t.keyword}`
              const isOpen = expanded[key]
              const ranked = t.user_rank !== null
              return (
                <Card key={key}>
                  <button
                    type="button"
                    className={styles.themeHeader}
                    onClick={() => toggle(key)}
                  >
                    <div className={styles.themeHeaderLeft}>
                      <div className={styles.themeName}>{t.theme}</div>
                      <div className={styles.themeMeta}>
                        <Badge variant="default">{t.category}</Badge>
                        <span className={styles.themeKeyword}>&ldquo;{t.keyword}&rdquo;</span>
                      </div>
                    </div>
                    <div className={styles.themeHeaderRight}>
                      {ranked ? (
                        <Badge variant="success">#{t.user_rank}</Badge>
                      ) : (
                        <Badge variant="warning">Not ranked</Badge>
                      )}
                      <span className={styles.chevron}>{isOpen ? '▾' : '▸'}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className={styles.leaderboard}>
                      {t.rankings.map((entry) => (
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
                  )}
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
