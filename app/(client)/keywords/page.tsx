'use client'

import { useEffect, useCallback, useState, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import styles from './page.module.css'

type Intent =
  | 'informational'
  | 'commercial'
  | 'transactional'
  | 'navigational'
  | 'unknown'

type Source = 'websearch' | 'campaign' | 'seo'

interface StoreKeyword {
  keyword: string
  intent: Intent
  page_url: string
  evidence: string
  sources: Source[]
}

interface KeywordsResponse {
  store: string
  keywords: StoreKeyword[]
  generated_at: string
}

const INTENTS: Intent[] = ['informational', 'commercial', 'transactional', 'navigational', 'unknown']
const SOURCES: Source[] = ['websearch', 'campaign', 'seo']

const intentClass: Record<Intent, string> = {
  informational: styles.intentInformational,
  commercial: styles.intentCommercial,
  transactional: styles.intentTransactional,
  navigational: styles.intentNavigational,
  unknown: styles.intentUnknown,
}

const sourceLabel: Record<Source, string> = {
  websearch: 'Web search',
  campaign: 'Draft',
  seo: 'Ahrefs',
}

const sourceClass: Record<Source, string> = {
  websearch: styles.sourceWebsearch,
  campaign: styles.sourceCampaign,
  seo: styles.sourceSeo,
}

export default function KeywordsPage() {
  const [data, setData] = useState<KeywordsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<Intent | 'all'>('all')
  const [sourceFilter, setSourceFilter] = useState<Source | 'all'>('all')
  const [search, setSearch] = useState('')

  const loadCached = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/keywords', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load cached keywords')
      if (json.data === null) {
        setData(null)
        return
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cached keywords')
    }
  }, [])

  const run = useCallback(async () => {
    setRunning(true)
    setError('')
    try {
      const res = await fetch('/api/keywords', { method: 'POST', cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to discover keywords')
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to discover keywords')
    } finally {
      setRunning(false)
    }
  }, [])

  useEffect(() => {
    loadCached().finally(() => setLoading(false))
  }, [loadCached])

  const sourceCounts = useMemo(() => {
    const c: Record<Source, number> = { websearch: 0, campaign: 0, seo: 0 }
    if (!data) return c
    for (const k of data.keywords) {
      for (const s of k.sources) c[s] = (c[s] || 0) + 1
    }
    return c
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.keywords.filter((k) => {
      if (filter !== 'all' && k.intent !== filter) return false
      if (sourceFilter !== 'all' && !k.sources.includes(sourceFilter)) return false
      if (q) {
        const haystack = `${k.keyword} ${k.evidence} ${k.page_url}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [data, filter, sourceFilter, search])

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Keyword Tracker</h1>
        <Button variant="secondary" size="sm" onClick={run} loading={running}>
          {data ? 'Regenerate' : 'Run'}
        </Button>
      </div>

      <p className={styles.subtitle}>
        Live web search inspects your store&rsquo;s pages and extracts the keywords you actively target across categories, products, and content.
      </p>

      {error && <p className={styles.error}>{error}</p>}

      {loading && !data && (
        <Card>
          <div className={styles.empty}>Loading cached keywords...</div>
        </Card>
      )}

      {!loading && !data && !running && (
        <Card>
          <div className={styles.empty}>No keywords audited yet. Click &ldquo;Run&rdquo; to discover (30–90s).</div>
        </Card>
      )}

      {running && (
        <Card>
          <div className={styles.empty}>Crawling your store via web search... 30–90s.</div>
        </Card>
      )}

      {data && (
        <>
          <div className={styles.metaRow}>
            <span className={styles.metaText}>
              Store: <strong>{data.store}</strong>
            </span>
            <span className={styles.timestamp}>
              {new Date(data.generated_at).toLocaleString()}
            </span>
          </div>

          <div className={styles.kpiGrid}>
            <Card className={styles.kpiCard}>
              <div className={styles.kpiLabel}>Total Keywords</div>
              <div className={styles.kpiValue}>{data.keywords.length}</div>
            </Card>
            <Card className={styles.kpiCard}>
              <div className={styles.kpiLabel}>From Web Search</div>
              <div className={styles.kpiValue}>{sourceCounts.websearch}</div>
            </Card>
            <Card className={styles.kpiCard}>
              <div className={styles.kpiLabel}>From Drafts</div>
              <div className={styles.kpiValue}>{sourceCounts.campaign}</div>
            </Card>
            <Card className={styles.kpiCard}>
              <div className={styles.kpiLabel}>From Ahrefs</div>
              <div className={styles.kpiValue}>{sourceCounts.seo}</div>
            </Card>
          </div>

          <div className={styles.searchRow}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search keywords, evidence, or page URL..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  className={styles.searchClear}
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <span className={styles.searchCount}>
              {filtered.length} of {data.keywords.length}
            </span>
          </div>

          <div className={styles.filterColumns}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Source</span>
              <div className={styles.filterRow}>
                <button
                  className={`${styles.filterChip} ${sourceFilter === 'all' ? styles.filterChipActive : ''}`}
                  onClick={() => setSourceFilter('all')}
                >
                  All
                </button>
                {SOURCES.map((s) => (
                  <button
                    key={s}
                    className={`${styles.filterChip} ${sourceFilter === s ? styles.filterChipActive : ''}`}
                    onClick={() => setSourceFilter(s)}
                  >
                    {sourceLabel[s]}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Intent</span>
              <div className={styles.filterRow}>
                <button
                  className={`${styles.filterChip} ${filter === 'all' ? styles.filterChipActive : ''}`}
                  onClick={() => setFilter('all')}
                >
                  All
                </button>
                {INTENTS.map((intent) => (
                  <button
                    key={intent}
                    className={`${styles.filterChip} ${filter === intent ? styles.filterChipActive : ''}`}
                    onClick={() => setFilter(intent)}
                  >
                    {intent}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Card>
            {filtered.length === 0 ? (
              <div className={styles.empty}>No keywords match this filter.</div>
            ) : (
              <div className={styles.list}>
                {filtered.map((k, i) => (
                  <div key={`${k.keyword}-${i}`} className={styles.row}>
                    <div>
                      <div className={styles.keyword}>{k.keyword}</div>
                      {k.sources.length > 0 && (
                        <div className={styles.sourceRow}>
                          {k.sources.map((s) => (
                            <span
                              key={s}
                              className={`${styles.sourcePill} ${sourceClass[s]}`}
                            >
                              {sourceLabel[s]}
                            </span>
                          ))}
                        </div>
                      )}
                      {k.evidence && <div className={styles.evidence}>{k.evidence}</div>}
                      {k.page_url && (
                        <a
                          className={styles.pageLink}
                          href={k.page_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {k.page_url}
                        </a>
                      )}
                    </div>
                    <span className={`${styles.intentBadge} ${intentClass[k.intent]}`}>
                      {k.intent}
                    </span>
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
