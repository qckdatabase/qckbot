'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  TrendingUp,
  Trophy,
  FileText,
  MessageSquare,
  Target,
  LineChart,
  Hash,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import styles from './sidebar.module.css'

interface SidebarProps {
  tenantName: string
}

const navGroups = [
  {
    label: 'Workspace',
    items: [
      { href: '/seo', label: 'SEO Metrics', icon: TrendingUp },
      { href: '/ranking', label: 'AI Ranking', icon: Trophy },
      { href: '/competitors', label: 'Organic Competitors', icon: Target },
      { href: '/campaigns', label: 'Campaigns', icon: FileText },
      { href: '/chat', label: 'Chat', icon: MessageSquare },
    ],
  },
  {
    label: 'Tools',
    items: [
      { href: '/serp', label: 'SERP Tracker', icon: LineChart },
      { href: '/keywords', label: 'Keyword Tracker', icon: Hash },
    ],
  },
]

export function Sidebar({ tenantName }: SidebarProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  return (
    <>
      <header className={styles.mobileBar}>
        <button
          className={styles.menuButton}
          onClick={() => setOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
        <div className={styles.mobileBrand}>
          <span className={styles.brandWrap}>
            <span className={styles.logoMark}>
              <img src="/logo.png" alt="QCK" />
            </span>
            <span className={styles.logo}>BOT</span>
          </span>
        </div>
      </header>

      {open && (
        <div
          className={styles.backdrop}
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside className={`${styles.sidebar} ${open ? styles.open : ''}`}>
        <div className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandWrap}>
              <span className={styles.logoMark}>
                <img src="/logo.png" alt="QCK" />
              </span>
              <span className={styles.logo}>BOT</span>
            </div>
            <button
              className={styles.closeButton}
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>
          <div className={styles.tenantPill} title={tenantName}>
            <span className={styles.tenantDot} aria-hidden />
            <span className={styles.tenantName}>{tenantName}</span>
          </div>
        </div>

        <nav className={styles.nav}>
          {navGroups.map((group) => (
            <div key={group.label} className={styles.navGroup}>
              <div className={styles.navLabel}>{group.label}</div>
              {group.items.map((item) => {
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
            </div>
          ))}
        </nav>

        <div className={styles.footer}>
          <button
            className={styles.logout}
            onClick={handleLogout}
            aria-label="Log out"
          >
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  )
}
