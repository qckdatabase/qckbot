import { ReactNode } from 'react'
import styles from './table.module.css'

interface TableProps {
  headers: string[]
  children: ReactNode
}

export function Table({ headers, children }: TableProps) {
  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
