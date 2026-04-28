import { Card } from '@/components/ui/card'
import styles from './page.module.css'

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <h1>Dashboard</h1>
      <p className={styles.subtitle}>Welcome to your SEO dashboard.</p>

      <div className={styles.grid}>
        <Card>SEO Metrics</Card>
        <Card>Ranking</Card>
        <Card>Competitors</Card>
        <Card>Campaigns</Card>
      </div>
    </div>
  )
}
