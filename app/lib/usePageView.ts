// app/lib/usePageView.ts
'use client'
import { useEffect, useRef } from 'react'

// enabled defaults to true for backward compat with any other callers.
// On the event page, pass enabled=false until we've confirmed the visitor
// is not a host or admin — that keeps their frequent visits out of the count.
export function usePageView(page: string, event_id?: string, enabled = true) {
  const tracked = useRef(false)

  useEffect(() => {
    if (!enabled) return
    if (typeof window === 'undefined') return
    if (window.location.hostname === 'localhost') return
    if (tracked.current) return   // fire once per page load, even if deps re-run
    tracked.current = true

    fetch('/api/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page,
        event_id: event_id || null,
        referrer: document.referrer || null,
      }),
    }).catch(() => {})
  }, [page, event_id, enabled])
}