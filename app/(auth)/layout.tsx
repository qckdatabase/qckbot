import styles from './layout.module.css'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.root}>
      <div className={styles.brandPanel}>
        <div className={styles.brandGlow} aria-hidden />
        <div className={styles.brandHeader}>
          <span className={styles.brandLogoChip}>
            <img src="/qck-light-logo.png" alt="QCK" />
          </span>
          <span className={styles.brandBadge}>/ Admin</span>
        </div>
        <div className={styles.brandBody}>
          <p className={styles.brandEyebrow}>Client SEO platform</p>
          <h2 className={styles.brandHeadline}>
            Search intelligence — track your clients across every ranking signal.
          </h2>
          <p className={styles.brandSub}>
            Monitor keywords, backlinks, competitors, and campaigns from one dashboard.
          </p>
        </div>
        <p className={styles.brandFooter}>v1.0 · all systems normal</p>
      </div>

      <div className={styles.formPanel}>
        {children}
      </div>
    </div>
  )
}