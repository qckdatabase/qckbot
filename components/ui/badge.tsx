import { ReactNode } from 'react'
import styles from './badge.module.css'

interface BadgeProps {
  variant?: 'default' | 'accent' | 'success' | 'warning' | 'error' | 'new'
  children: ReactNode
}

export function Badge({ variant = 'default', children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]}`}>
      {children}
    </span>
  )
}
