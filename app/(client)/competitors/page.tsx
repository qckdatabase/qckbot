'use client'

import { useEffect, useCallback, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useRefreshStatus } from '@/lib/use-refresh-status'
import styles from './page.module.css'

interface OrganicCompetitor {
  rank: number
  brand: string
  domain: string
  reason: string
  url: string
  shared_keywords: string[]
  domain_rating: number
}

interface CompetitorsResponse {
  store: string
  competitors: OrganicCompetitor[]
  generated_at: string
}

export default function CompetitorsPage() {
  const [data, setData] = useState<CompetitorsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const { status: refreshStatus, refetch: refetchRefreshStatus } = useRefreshStatus()

  const loadCached = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/competitors', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to load cached competitors')
      }
      if (json.data === null) {
        setData(null)
        return
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cached competitors')
    }
  }, [])

  const run = useCallback(async () => {
    setRunning(true)
    setError('')
    try {
      const res = await fetch('/api/competitors', { method: 'POST', cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to discover organic competitors')
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover organic competitors')
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
        <h1>Organic Competitors</h1>
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
        Live web search finds sites that rank in Google&rsquo;s organic results for the same keyword themes as your store.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      {loading && !data && (
        <Card>
          <div className={styles.empty}>Loading cached competitors...</div>
        </Card>
      )}

      {!loading && !data && !running && (
        <Card>
          <div className={styles.empty}>No cached competitors yet. Click &ldquo;Run&rdquo; to discover (30–90s).</div>
        </Card>
      )}

      {running && (
        <Card>
          <div className={styles.empty}>Searching the open web for overlapping SERPs... 30–90s.</div>
        </Card>
      )}

      {data && (
        <>
          <div className={styles.metaRow}>
            <span className={styles.metaText}>
              Target: <strong>{data.store}</strong>
            </span>
            <span className={styles.timestamp}>
              {new Date(data.generated_at).toLocaleString()}
            </span>
          </div>

          {(() => {
            const found = data.competitors.length
            const top = data.competitors.find((c) => c.rank === 1) || data.competitors[0]
            const drValues = data.competitors
              .map((c) => c.domain_rating)
              .filter((n): n is number => typeof n === 'number' && n > 0)
            const avgDr =
              drValues.length > 0
                ? Math.round(drValues.reduce((s, n) => s + n, 0) / drValues.length)
                : null
            const keywordCounts = new Map<string, number>()
            for (const c of data.competitors) {
              for (const kw of c.shared_keywords) {
                const norm = kw.trim().toLowerCase()
                if (!norm) continue
                keywordCounts.set(norm, (keywordCounts.get(norm) || 0) + 1)
              }
            }
            const commonKeywords = Array.from(keywordCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 20)

            return (
              <>
                <div className={styles.kpiGrid}>
                  <Card className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Competitors Found</div>
                    <div className={styles.kpiValue}>{found}</div>
                  </Card>
                  <Card className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Top Competitor</div>
                    <div className={styles.kpiValue}>{top ? top.brand : '—'}</div>
                    {top?.domain && (
                      <div className={styles.kpiSub}>{top.domain}</div>
                    )}
                  </Card>
                  <Card className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Avg. Domain Rating</div>
                    <div className={styles.kpiValue}>{avgDr ?? '—'}</div>
                    <div className={styles.kpiSub}>
                      {avgDr === null ? 'regenerate to populate' : 'est. from web search'}
                    </div>
                  </Card>
                </div>

                <Card>
                  <h3 className={styles.sectionTitle}>Common Keywords</h3>
                  {commonKeywords.length === 0 ? (
                    <div className={styles.empty}>No shared keywords surfaced.</div>
                  ) : (
                    <div className={styles.keywordCloud}>
                      {commonKeywords.map(([kw, count]) => (
                        <span key={kw} className={styles.keywordChip}>
                          <span>{kw}</span>
                          <span className={styles.keywordCount}>{count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              </>
            )
          })()}

          <Card>
            {data.competitors.length === 0 ? (
              <div className={styles.empty}>Web search returned no overlapping competitors.</div>
            ) : (
              <div className={styles.list}>
                {data.competitors.map((c) => (
                  <div key={`${c.rank}-${c.domain}`} className={styles.row}>
                    <div className={styles.rank}>{c.rank}</div>
                    <div className={styles.info}>
                      <div className={styles.name}>
                        {c.brand}
                        {typeof c.domain_rating === 'number' && c.domain_rating > 0 && (
                          <span className={styles.drPill} title="Estimated domain rating">
                            DR {c.domain_rating}
                          </span>
                        )}
                      </div>
                      {c.domain && (
                        <a
                          href={`https://${c.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.domain}
                        >
                          {c.domain}
                        </a>
                      )}
                      <div className={styles.reason}>{c.reason}</div>
                      {c.shared_keywords.length > 0 && (
                        <div className={styles.keywords}>
                          {c.shared_keywords.map((k, i) => (
                            <span key={`${k}-${i}`} className={styles.keyword}>
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noreferrer"
                          className={styles.sourceLink}
                        >
                          Source
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
