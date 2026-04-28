'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import styles from './page.module.css'

type Metric = 'domain_rating' | 'traffic' | 'backlinks'

interface Competitor {
  id: string
  name: string
  domain: string
  domain_rating: number
  traffic: number
  backlinks: number
  is_client?: boolean
}

export default function RankingPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [clientDomain, setClientDomain] = useState('')
  const [activeMetric, setActiveMetric] = useState<Metric>('domain_rating')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRanking()
  }, [])

  async function fetchRanking() {
    try {
      const [seoRes, competitorsRes] = await Promise.all([
        fetch('/api/seo'),
        fetch('/api/competitors'),
      ])

      const seoData = await seoRes.json()
      const competitorsData = await competitorsRes.json()

      const clientEntry: Competitor = {
        id: 'client',
        name: 'Your Site',
        domain: seoData.current?.domain || 'your site',
        domain_rating: seoData.current?.domain_rating || 0,
        traffic: seoData.current?.est_monthly_traffic || 0,
        backlinks: seoData.current?.backlinks || 0,
        is_client: true,
      }

      const competitorEntries: Competitor[] = (competitorsData.competitors || []).map((c: Competitor) => ({
        ...c,
        is_client: false,
      }))

      const allCompetitors = [clientEntry, ...competitorEntries]
      setClientDomain(clientEntry.domain)

      const sorted = sortCompetitors(allCompetitors, activeMetric)
      setCompetitors(sorted)
    } catch (err) {
      console.error('Failed to fetch ranking:', err)
    } finally {
      setLoading(false)
    }
  }

  function sortCompetitors(list: Competitor[], metric: Metric): Competitor[] {
    return [...list].sort((a, b) => {
      if (metric === 'domain_rating') return b.domain_rating - a.domain_rating
      if (metric === 'traffic') return b.traffic - a.traffic
      return b.backlinks - a.backlinks
    })
  }

  function handleMetricChange(metric: Metric) {
    setActiveMetric(metric)
    setCompetitors(prev => sortCompetitors(prev, metric))
  }

  function formatNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return n.toString()
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <h1>Ranking</h1>
        <p className={styles.loading}>Loading ranking data...</p>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Ranking</h1>
        <div className={styles.toggles}>
          <button
            className={`${styles.toggle} ${activeMetric === 'domain_rating' ? styles.active : ''}`}
            onClick={() => handleMetricChange('domain_rating')}
          >
            DR
          </button>
          <button
            className={`${styles.toggle} ${activeMetric === 'traffic' ? styles.active : ''}`}
            onClick={() => handleMetricChange('traffic')}
          >
            Traffic
          </button>
          <button
            className={`${styles.toggle} ${activeMetric === 'backlinks' ? styles.active : ''}`}
            onClick={() => handleMetricChange('backlinks')}
          >
            Backlinks
          </button>
        </div>
      </div>

      <Card>
        <div className={styles.leaderboard}>
          {competitors.slice(0, 10).map((competitor, index) => (
            <div
              key={competitor.id}
              className={`${styles.row} ${competitor.is_client ? styles.clientRow : ''}`}
            >
              <div className={styles.rank}>
                {index + 1}
                {index < 3 && <span className={styles.medal}>🏆</span>}
              </div>
              <div className={styles.info}>
                <div className={styles.name}>
                  {competitor.name}
                  {competitor.is_client && <Badge variant="success">You</Badge>}
                </div>
                <div className={styles.domain}>{competitor.domain}</div>
              </div>
              <div className={styles.metrics}>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>{competitor.domain_rating}</span>
                  <span className={styles.metricLabel}>DR</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>{formatNumber(competitor.traffic)}</span>
                  <span className={styles.metricLabel}>Traffic</span>
                </div>
                <div className={styles.metric}>
                  <span className={styles.metricValue}>{formatNumber(competitor.backlinks)}</span>
                  <span className={styles.metricLabel}>Backlinks</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
