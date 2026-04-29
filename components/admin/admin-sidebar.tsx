'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Shield, LogOut } from 'lucide-react'
import styles from './admin-sidebar.module.css'

interface AdminSidebarProps {
  email: string
}

const navItems = [
  { href: '/clients', label: 'Clients', icon: Users },
  { href: '/guardrails', label: 'Guardrails', icon: Shield },
]

export function AdminSidebar({ email }: AdminSidebarProps) {
  const pathname = usePathname()

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandWrap}>
            <span className={styles.logoMark}>
              <img src="/logo.png" alt="QCK" />
            </span>
            <span className={styles.logo}>BOT</span>
          </div>
          <span className={styles.tag}>Admin</span>
        </div>
      </div>

      <div className={styles.navLabel}>Manage</div>
      <nav className={styles.nav}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className={styles.footer}>
        <div className={styles.userPill} title={email}>
          <span className={styles.userDot} aria-hidden />
          <span className={styles.userEmail}>{email}</span>
        </div>
        <button className={styles.logout} onClick={handleLogout} aria-label="Log out">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
