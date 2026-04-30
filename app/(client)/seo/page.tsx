'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  TrendingUp,
  Search as SearchIcon,
  Link as LinkIcon,
  BarChart3,
  RefreshCw,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Table } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Pagination, paginate } from '@/components/ui/pagination'
import { useRefreshStatus } from '@/lib/use-refresh-status'
import styles from './page.module.css'

const PAGE_SIZE = 10

interface Metrics {
  domain_rating: number
  organic_keywords: number
  backlinks: number
  est_monthly_traffic: number
}

interface Keyword {
  keyword: string
  position: number
  volume: number
  difficulty: number
  url: string
}

interface Backlink {
  url: string
  domain_rating: number
  traffic: number
}

interface HistoricalRow {
  snapshot_date: string
  domain_rating: number | null
  organic_keywords: number | null
  backlinks: number | null
  est_monthly_traffic: number | null
}

interface SeoResponse {
  current: Metrics
  keywords: Keyword[]
  backlinks: Backlink[]
  historical: HistoricalRow[]
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

export default function SEOPage() {
  const [data, setData] = useState<SeoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [keywordsPage, setKeywordsPage] = useState(1)
  const [backlinksPage, setBacklinksPage] = useState(1)
  const { status: refreshStatus, refetch: refetchRefreshStatus } = useRefreshStatus()

  const loadCached = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/seo', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to load SEO data')
        return
      }
      if (json.data === null) {
        setData(null)
        return
      }
      setData(json)
    } catch {
      setError('Failed to connect to server')
    }
  }, [])

  useEffect(() => {
    loadCached().finally(() => setLoading(false))
  }, [loadCached])

  useEffect(() => {
    if (!refreshStatus.refresh_in_flight) {
      loadCached()
    }
  }, [refreshStatus.refresh_in_flight, loadCached])

  const handleRefresh = async () => {
    setRefreshing(true)
    setError('')
    try {
      const res = await fetch('/api/seo', { method: 'POST', cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to refresh SEO data')
      } else {
        setData(json)
      }
    } catch {
      setError('Failed to connect to server')
    } finally {
      setRefreshing(false)
      refetchRefreshStatus()
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <h1>SEO Metrics</h1>
        <p className={styles.loading}>Loading...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={styles.page}>
        <h1>SEO Metrics</h1>
        <p className={styles.error}>{error}</p>
        <button className={styles.retryButton} onClick={handleRefresh}>
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <div className={styles.headerRow}>
          <h1>SEO Metrics</h1>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            loading={refreshing || refreshStatus.refresh_in_flight}
            disabled={refreshStatus.refresh_in_flight}
          >
            {refreshStatus.refresh_in_flight ? 'Refreshing...' : 'Fetch from Ahrefs'}
          </Button>
        </div>
        <p className={styles.loading}>No cached SEO data yet. Click &ldquo;Fetch from Ahrefs&rdquo; to load.</p>
      </div>
    )
  }

  const { current, keywords, backlinks, historical } = data
  const previous = historical && historical.length > 1 ? historical[1] : null

  function delta(curr: number, prev: number | null | undefined) {
    if (prev === null || prev === undefined || prev === 0) return null
    const d = curr - prev
    if (d === 0) return null
    const pct = (d / prev) * 100
    return { value: d, pct, positive: d > 0 }
  }

  const drDelta = delta(current.domain_rating, previous?.domain_rating)
  const kwDelta = delta(current.organic_keywords, previous?.organic_keywords)
  const blDelta = delta(current.backlinks, previous?.backlinks)
  const trDelta = delta(current.est_monthly_traffic, previous?.est_monthly_traffic)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>SEO Metrics</h1>
          <p className={styles.subtitle}>
            Latest snapshot pulled from Ahrefs — domain authority, organic keyword footprint, and backlink profile.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          loading={refreshing || refreshStatus.refresh_in_flight}
          disabled={refreshStatus.refresh_in_flight}
        >
          <RefreshCw size={14} />
          {refreshStatus.refresh_in_flight ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <div className={styles.kpiGrid}>
        <Card className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Domain Rating</span>
            <TrendingUp size={14} className={styles.kpiIcon} />
          </div>
          <div className={styles.kpiValue}>{current.domain_rating}</div>
          {drDelta && (
            <div className={`${styles.kpiDelta} ${drDelta.positive ? styles.up : styles.down}`}>
              {drDelta.positive ? '+' : ''}{drDelta.value} ({drDelta.pct.toFixed(1)}%)
            </div>
          )}
        </Card>
        <Card className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Organic Keywords</span>
            <SearchIcon size={14} className={styles.kpiIcon} />
          </div>
          <div className={styles.kpiValue}>{formatNumber(current.organic_keywords)}</div>
          {kwDelta && (
            <div className={`${styles.kpiDelta} ${kwDelta.positive ? styles.up : styles.down}`}>
              {kwDelta.positive ? '+' : ''}{formatNumber(Math.abs(kwDelta.value))} ({kwDelta.pct.toFixed(1)}%)
            </div>
          )}
        </Card>
        <Card className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Backlinks</span>
            <LinkIcon size={14} className={styles.kpiIcon} />
          </div>
          <div className={styles.kpiValue}>{formatNumber(current.backlinks)}</div>
          {blDelta && (
            <div className={`${styles.kpiDelta} ${blDelta.positive ? styles.up : styles.down}`}>
              {blDelta.positive ? '+' : ''}{formatNumber(Math.abs(blDelta.value))} ({blDelta.pct.toFixed(1)}%)
            </div>
          )}
        </Card>
        <Card className={styles.kpiCard}>
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>Est. Monthly Traffic</span>
            <BarChart3 size={14} className={styles.kpiIcon} />
          </div>
          <div className={styles.kpiValue}>{formatNumber(current.est_monthly_traffic)}</div>
          {trDelta && (
            <div className={`${styles.kpiDelta} ${trDelta.positive ? styles.up : styles.down}`}>
              {trDelta.positive ? '+' : ''}{formatNumber(Math.abs(trDelta.value))} ({trDelta.pct.toFixed(1)}%)
            </div>
          )}
        </Card>
      </div>

      <div className={styles.tablesGrid}>
        <Card>
          <div className={styles.tableHeader}>
            <h3>Top Keywords</h3>
            <span className={styles.countBadge}>{keywords.length}</span>
          </div>
          {keywords.length === 0 ? (
            <p className={styles.empty}>No keyword data.</p>
          ) : (
            <>
              <Table headers={['Keyword', 'Pos', 'Volume', 'KD']}>
                {paginate(keywords, keywordsPage, PAGE_SIZE).map((k, i) => (
                  <tr key={`${k.keyword}-${i}`}>
                    <td className={styles.keywordCell} title={k.keyword}>
                      <span className={styles.truncateText}>{k.keyword}</span>
                    </td>
                    <td>
                      <span className={styles.positionPill}>#{k.position}</span>
                    </td>
                    <td>{formatNumber(k.volume)}</td>
                    <td>{k.difficulty}</td>
                  </tr>
                ))}
              </Table>
              <Pagination
                page={keywordsPage}
                pageSize={PAGE_SIZE}
                total={keywords.length}
                onPageChange={setKeywordsPage}
              />
            </>
          )}
        </Card>

        <Card>
          <div className={styles.tableHeader}>
            <h3>Top Backlinks</h3>
            <span className={styles.countBadge}>{backlinks.length}</span>
          </div>
          {backlinks.length === 0 ? (
            <p className={styles.empty}>No backlink data.</p>
          ) : (
            <>
              <Table headers={['Source', 'DR', 'Traffic']}>
                {paginate(backlinks, backlinksPage, PAGE_SIZE).map((b, i) => (
                  <tr key={`${b.url}-${i}`}>
                    <td className={styles.urlCell} title={b.url}>
                      <a href={b.url} target="_blank" rel="noreferrer">
                        {b.url}
                      </a>
                    </td>
                    <td>{b.domain_rating}</td>
                    <td>{formatNumber(b.traffic)}</td>
                  </tr>
                ))}
              </Table>
              <Pagination
                page={backlinksPage}
                pageSize={PAGE_SIZE}
                total={backlinks.length}
                onPageChange={setBacklinksPage}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
