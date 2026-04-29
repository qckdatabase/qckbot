import { ReactNode } from 'react'
import styles from './card.module.css'

interface CardProps {
  children: ReactNode
  className?: string
  interactive?: boolean
}

export function Card({ children, className, interactive }: CardProps) {
  const cls = [styles.card, interactive ? styles.interactive : '', className || '']
    .filter(Boolean)
    .join(' ')
  return <div className={cls}>{children}</div>
}
