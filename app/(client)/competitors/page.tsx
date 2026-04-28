'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Table } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import styles from './page.module.css'

interface Competitor {
  id: string
  name: string
  domain: string
  domain_rating: number
  traffic: number
  backlinks: number
  last_fetched: string | null
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchCompetitors()
  }, [])

  async function fetchCompetitors() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/competitors')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to load competitors')
      }
      const data = await res.json()
      setCompetitors(data.competitors || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    setError('')

    try {
      const res = await fetch('/api/competitors', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to refresh competitors')
      }
      await fetchCompetitors()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setRefreshing(false)
    }
  }

  function formatNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <h1>Competitors</h1>
        <p className={styles.loading}>Loading competitors...</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Competitors</h1>
        <Button onClick={handleRefresh} loading={refreshing}>
          {refreshing ? 'Refreshing...' : 'Refresh Competitors'}
        </Button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {competitors.length > 0 ? (
        <Card>
          <Table headers={['Name', 'Domain', 'DR', 'Traffic', 'Backlinks', 'Last Fetched']}>
            {competitors.map((competitor) => (
              <tr key={competitor.id}>
                <td className={styles.name}>{competitor.name}</td>
                <td className={styles.domain}>{competitor.domain}</td>
                <td>{competitor.domain_rating || 0}</td>
                <td>{formatNumber(competitor.traffic || 0)}</td>
                <td>{formatNumber(competitor.backlinks || 0)}</td>
                <td className={styles.date}>{formatDate(competitor.last_fetched)}</td>
              </tr>
            ))}
          </Table>
        </Card>
      ) : (
        <Card>
          <div className={styles.empty}>
            <p>No competitors found.</p>
            <p className={styles.emptyHint}>
              Click &ldquo;Refresh Competitors&rdquo; to discover competitors from Ahrefs.
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}
