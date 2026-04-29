'use client'

import { useEffect, useRef } from 'react'

export function RefreshBoot() {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/tenants/refresh-status', { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as {
          refresh_in_flight: boolean
          initial_refresh_done: boolean
        }
        if (cancelled) return
        if (!json.initial_refresh_done && !json.refresh_in_flight) {
          fetch('/api/tenants/initial-refresh', { method: 'POST' }).catch(() => {
            // fire-and-forget; user-visible UI still polls status
          })
        }
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
