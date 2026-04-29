'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface RefreshStatus {
  refresh_in_flight: boolean
  last_refreshed_at: string | null
  initial_refresh_done: boolean
}

const DEFAULT_STATUS: RefreshStatus = {
  refresh_in_flight: false,
  last_refreshed_at: null,
  initial_refresh_done: true,
}

export function useRefreshStatus(): {
  status: RefreshStatus
  loading: boolean
  refetch: () => Promise<void>
} {
  const [status, setStatus] = useState<RefreshStatus>(DEFAULT_STATUS)
  const [loading, setLoading] = useState(true)
  const mounted = useRef(true)

  const refetch = useCallback(async () => {
    try {
      const res = await fetch('/api/tenants/refresh-status', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as RefreshStatus
      if (mounted.current) setStatus(json)
    } catch {
      // ignore — keep last known status
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    refetch()
    return () => {
      mounted.current = false
    }
  }, [refetch])

  useEffect(() => {
    if (!status.refresh_in_flight) return
    const id = setInterval(() => {
      refetch()
    }, 5000)
    return () => clearInterval(id)
  }, [status.refresh_in_flight, refetch])

  return { status, loading, refetch }
}
