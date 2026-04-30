'use client'

import { LucideProvider } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

export function IconProvider({ children }: Props) {
  return (
    <LucideProvider strokeWidth={1.5}>
      {children}
    </LucideProvider>
  )
}
