'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Users, Shield, LogOut, Menu, X } from 'lucide-react'
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
              <img src="/qck-light-logo.png" alt="QCK" />
            </span>
          </span>
          <span className={styles.tag}>Admin</span>
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
                <img src="/qck-light-logo.png" alt="QCK" />
              </span>
            </div>
            <span className={styles.tag}>Admin</span>
            <button
              className={styles.closeButton}
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
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
