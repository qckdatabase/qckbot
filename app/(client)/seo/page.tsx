'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Table } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Pagination, paginate } from '@/components/ui/pagination'
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
          <Button variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing}>
            Fetch from Ahrefs
          </Button>
        </div>
        <p className={styles.loading}>No cached SEO data yet. Click &ldquo;Fetch from Ahrefs&rdquo; to load.</p>
      </div>
    )
  }

  const { current, keywords, backlinks } = data

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h1>SEO Metrics</h1>
        <Button variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing}>
          Refresh
        </Button>
      </div>

      <div className={styles.kpiGrid}>
        <Card className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Domain Rating</div>
          <div className={styles.kpiValue}>{current.domain_rating}</div>
        </Card>
        <Card className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Organic Keywords</div>
          <div className={styles.kpiValue}>{formatNumber(current.organic_keywords)}</div>
        </Card>
        <Card className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Backlinks</div>
          <div className={styles.kpiValue}>{formatNumber(current.backlinks)}</div>
        </Card>
        <Card className={styles.kpiCard}>
          <div className={styles.kpiLabel}>Est. Monthly Traffic</div>
          <div className={styles.kpiValue}>{formatNumber(current.est_monthly_traffic)}</div>
        </Card>
      </div>

      <div className={styles.tablesGrid}>
        <Card>
          <h3>Top Keywords</h3>
          {keywords.length === 0 ? (
            <p className={styles.empty}>No keyword data.</p>
          ) : (
            <>
              <Table headers={['Keyword', 'Pos', 'Volume', 'KD']}>
                {paginate(keywords, keywordsPage, PAGE_SIZE).map((k, i) => (
                  <tr key={`${k.keyword}-${i}`}>
                    <td>{k.keyword}</td>
                    <td>{k.position}</td>
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
          <h3>Top Backlinks</h3>
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
