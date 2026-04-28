'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, BarChart3, Users, FileText, Shield, MessageSquare, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './sidebar.module.css'

interface SidebarProps {
  tenantName: string
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/seo', label: 'SEO Metrics', icon: BarChart3 },
  { href: '/ranking', label: 'Ranking', icon: BarChart3 },
  { href: '/competitors', label: 'Competitors', icon: Users },
  { href: '/campaigns', label: 'Campaigns', icon: FileText },
  { href: '/guardrails', label: 'Guardrails', icon: Shield },
  { href: '/chat', label: 'Chat', icon: MessageSquare },
]

export function Sidebar({ tenantName }: SidebarProps) {
  const pathname = usePathname()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <span className={styles.logo}>Qckbot</span>
        <span className={styles.tenant}>{tenantName}</span>
      </div>

      <nav className={styles.nav}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className={styles.footer}>
        <button className={styles.logout} onClick={handleLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}
