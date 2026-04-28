import styles from './layout.module.css'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoText}>Qckbot</span>
        </div>
        {children}
      </div>
    </div>
  )
}
