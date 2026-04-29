'use client'

import { useEffect, useCallback, useState } from 'react'
import { RefreshCw, Trash2, Download, Search, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table } from '@/components/ui/table'
import { Pagination, paginate } from '@/components/ui/pagination'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Modal } from '@/components/ui/modal'
import styles from './page.module.css'

const PAGE_SIZE = 10

interface TrackedKeyword {
  id: string
  keyword: string
  created_at: string
  latest_position: number | null
  latest_top_url: string | null
  latest_checked_at: string | null
}

interface ListResponse {
  keywords: TrackedKeyword[]
}

interface TrackerKeyword {
  keyword: string
  intent: string
  sources: string[]
}

interface KeywordsPayload {
  keywords?: TrackerKeyword[]
}

export default function SerpTrackerPage() {
  const [keywords, setKeywords] = useState<TrackedKeyword[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<TrackedKeyword | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importSubmitting, setImportSubmitting] = useState(false)
  const [importError, setImportError] = useState('')
  const [trackerKeywords, setTrackerKeywords] = useState<TrackerKeyword[]>([])
  const [importSelected, setImportSelected] = useState<Set<string>>(new Set())
  const [importSearch, setImportSearch] = useState('')
  const [search, setSearch] = useState('')

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev)
      if (busy) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/serp', { cache: 'no-store' })
      const json = (await res.json()) as ListResponse | { error: string }
      if (!res.ok) throw new Error('error' in json ? json.error : 'Failed to load')
      if ('keywords' in json) setKeywords(json.keywords)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }, [])

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [load])

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(keywords.length / PAGE_SIZE))
    if (page > totalPages) setPage(totalPages)
  }, [keywords, page])

  useEffect(() => {
    setPage(1)
  }, [search])

  const addKeyword = async (e: React.FormEvent) => {
    e.preventDefault()
    const keyword = input.trim()
    if (!keyword || adding) return
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/serp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to add keyword')
      setInput('')
      setPage(1)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add keyword')
    } finally {
      setAdding(false)
    }
  }

  const recheck = async (id: string) => {
    setBusy(id, true)
    setError('')
    try {
      const res = await fetch(`/api/serp/${id}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to recheck')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recheck')
    } finally {
      setBusy(id, false)
    }
  }

  const askRemove = (k: TrackedKeyword) => {
    setPendingDelete(k)
  }

  const confirmRemove = async () => {
    if (!pendingDelete) return
    const id = pendingDelete.id
    setConfirmLoading(true)
    setBusy(id, true)
    setError('')
    try {
      const res = await fetch(`/api/serp/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete')
      setKeywords((prev) => prev.filter((k) => k.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setBusy(id, false)
      setConfirmLoading(false)
      setPendingDelete(null)
    }
  }

  const cancelRemove = () => {
    if (confirmLoading) return
    setPendingDelete(null)
  }

  const openImport = async () => {
    setImportOpen(true)
    setImportError('')
    setImportSelected(new Set())
    setImportSearch('')
    setImportLoading(true)
    try {
      const res = await fetch('/api/keywords', { cache: 'no-store' })
      const json = (await res.json()) as KeywordsPayload | { data: null; error?: string }
      if (!res.ok) {
        const msg = (json as { error?: string }).error || 'Failed to load Keyword Tracker'
        throw new Error(msg)
      }
      const list = (json as KeywordsPayload).keywords || []
      setTrackerKeywords(list)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to load Keyword Tracker')
      setTrackerKeywords([])
    } finally {
      setImportLoading(false)
    }
  }

  const closeImport = () => {
    if (importSubmitting) return
    setImportOpen(false)
  }

  const toggleImport = (keyword: string) => {
    setImportSelected((prev) => {
      const next = new Set(prev)
      if (next.has(keyword)) next.delete(keyword)
      else next.add(keyword)
      return next
    })
  }

  const submitImport = async () => {
    if (importSelected.size === 0) return
    setImportSubmitting(true)
    setImportError('')
    try {
      const res = await fetch('/api/serp/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: Array.from(importSelected) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Import failed')
      setImportOpen(false)
      await load()
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImportSubmitting(false)
    }
  }

  const filteredKeywords = (() => {
    const q = search.trim().toLowerCase()
    if (!q) return keywords
    return keywords.filter((k) => {
      const haystack = `${k.keyword} ${k.latest_top_url || ''}`.toLowerCase()
      return haystack.includes(q)
    })
  })()

  const pageItems = paginate(filteredKeywords, page, PAGE_SIZE)

  const trackedSet = new Set(keywords.map((k) => k.keyword.toLowerCase()))
  const importableAll = trackerKeywords
    .map((k) => ({ ...k, keyword: k.keyword.trim().toLowerCase() }))
    .filter((k) => k.keyword && !trackedSet.has(k.keyword))
  const seen = new Set<string>()
  const importable = importableAll.filter((k) => {
    if (seen.has(k.keyword)) return false
    seen.add(k.keyword)
    return true
  })
  const importableFiltered = importSearch.trim()
    ? importable.filter((k) =>
        k.keyword.toLowerCase().includes(importSearch.trim().toLowerCase())
      )
    : importable
  const allSelected =
    importableFiltered.length > 0 &&
    importableFiltered.every((k) => importSelected.has(k.keyword))

  return (
    <div className={styles.page}>
      <h1>SERP Tracker</h1>
      <p className={styles.subtitle}>
        Track your domain&rsquo;s organic position for keywords. Each check runs a live web search and finds your domain in the top 20 results.
      </p>

      <form className={styles.addRow} onSubmit={addKeyword}>
        <input
          type="text"
          className={styles.input}
          placeholder="Add a keyword to track (e.g. organic dog food)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={adding}
          maxLength={200}
        />
        <Button type="submit" loading={adding} disabled={!input.trim()}>
          Track
        </Button>
        <Button type="button" variant="secondary" onClick={openImport}>
          <Download size={14} />
          Import from Keyword Tracker
        </Button>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <Card>
          <div className={styles.empty}>Loading...</div>
        </Card>
      ) : keywords.length === 0 ? (
        <Card>
          <div className={styles.empty}>
            No tracked keywords yet. Add one above to begin tracking.
          </div>
        </Card>
      ) : (
        <Card>
          <div className={styles.searchRow}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search keywords or URLs..."
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
              {filteredKeywords.length} of {keywords.length}
            </span>
          </div>

          {filteredKeywords.length === 0 ? (
            <div className={styles.empty}>No keywords match this search.</div>
          ) : (
          <>
          <Table headers={['Keyword', 'Position', 'Top URL', 'Last Checked', '']}>
            {pageItems.map((k) => {
              const busy = busyIds.has(k.id)
              return (
                <tr key={k.id}>
                  <td className={styles.cellKeyword}>{k.keyword}</td>
                  <td>
                    {k.latest_position !== null ? (
                      <span className={styles.positionPill}>#{k.latest_position}</span>
                    ) : (
                      <span className={styles.positionMissing}>
                        {k.latest_checked_at ? 'Not in top 20' : 'Pending'}
                      </span>
                    )}
                  </td>
                  <td className={styles.cellUrl}>
                    {k.latest_top_url ? (
                      <a
                        href={k.latest_top_url}
                        target="_blank"
                        rel="noreferrer"
                        title={k.latest_top_url}
                      >
                        {k.latest_top_url}
                      </a>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td className={styles.cellDate}>
                    {k.latest_checked_at ? (
                      <span title={new Date(k.latest_checked_at).toLocaleString()}>
                        {new Date(k.latest_checked_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year:
                            new Date(k.latest_checked_at).getFullYear() !==
                            new Date().getFullYear()
                              ? 'numeric'
                              : undefined,
                        })}
                      </span>
                    ) : (
                      <span className={styles.muted}>Never</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.iconBtn}
                        onClick={() => recheck(k.id)}
                        disabled={busy}
                        aria-label="Recheck"
                        title="Recheck"
                      >
                        <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />
                      </button>
                      <button
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        onClick={() => askRemove(k)}
                        disabled={busy}
                        aria-label="Remove"
                        title="Stop tracking"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </Table>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={filteredKeywords.length}
            onPageChange={setPage}
          />
          </>
          )}
        </Card>
      )}

      <Modal
        isOpen={importOpen}
        onClose={closeImport}
        title="Import from Keyword Tracker"
        size="md"
      >
        <p className={styles.importSubtitle}>
          Pick keywords from your store&rsquo;s tracked list to add to SERP tracking. Imported
          keywords start as <strong>Pending</strong> — click recheck on any row to run the first
          SERP check (each check uses one web search call).
        </p>

        {importError && <p className={styles.error}>{importError}</p>}

        {importLoading ? (
          <div className={styles.empty}>Loading Keyword Tracker...</div>
        ) : importable.length === 0 ? (
          <div className={styles.empty}>
            No untracked keywords available. Either everything from Keyword Tracker is already in
            this list, or Keyword Tracker has not been run yet.
          </div>
        ) : (
          <>
            <div className={styles.importToolbar}>
              <div className={styles.importSearchWrap}>
                <Search size={14} className={styles.importSearchIcon} />
                <input
                  type="text"
                  className={styles.importSearchInput}
                  placeholder="Filter keywords..."
                  value={importSearch}
                  onChange={(e) => setImportSearch(e.target.value)}
                />
              </div>
              <button
                type="button"
                className={styles.importSelectAll}
                onClick={() => {
                  if (allSelected) {
                    setImportSelected((prev) => {
                      const next = new Set(prev)
                      for (const k of importableFiltered) next.delete(k.keyword)
                      return next
                    })
                  } else {
                    setImportSelected((prev) => {
                      const next = new Set(prev)
                      for (const k of importableFiltered) next.add(k.keyword)
                      return next
                    })
                  }
                }}
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div className={styles.importList}>
              {importableFiltered.length === 0 ? (
                <div className={styles.empty}>No keywords match this filter.</div>
              ) : (
                importableFiltered.map((k) => (
                  <label key={k.keyword} className={styles.importItem}>
                    <input
                      type="checkbox"
                      checked={importSelected.has(k.keyword)}
                      onChange={() => toggleImport(k.keyword)}
                    />
                    <div className={styles.importItemBody}>
                      <span className={styles.importKeyword}>{k.keyword}</span>
                      <div className={styles.importMeta}>
                        {k.intent && k.intent !== 'unknown' && (
                          <span className={styles.importTag}>{k.intent}</span>
                        )}
                        {k.sources.map((s) => (
                          <span key={s} className={styles.importTag}>
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className={styles.importFooter}>
              <span className={styles.importCount}>
                {importSelected.size} of {importable.length} selected
              </span>
              <div className={styles.importActions}>
                <Button variant="secondary" onClick={closeImport} disabled={importSubmitting}>
                  Cancel
                </Button>
                <Button
                  onClick={submitImport}
                  loading={importSubmitting}
                  disabled={importSelected.size === 0}
                >
                  Import {importSelected.size > 0 ? `(${importSelected.size})` : ''}
                </Button>
              </div>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!pendingDelete}
        title="Stop tracking this keyword?"
        message={
          pendingDelete
            ? `"${pendingDelete.keyword}" and its check history will be permanently removed. This cannot be undone.`
            : ''
        }
        confirmLabel="Stop tracking"
        variant="danger"
        loading={confirmLoading}
        onConfirm={confirmRemove}
        onCancel={cancelRemove}
      />
    </div>
  )
}
