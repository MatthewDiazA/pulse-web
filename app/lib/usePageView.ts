// app/lib/usePageView.ts
'use client'
import { useEffect } from 'react'

export function usePageView(page: string, event_id?: string) {
  useEffect(() => {
    // Don't track in dev
    if (typeof window === 'undefined') return
    if (window.location.hostname === 'localhost') return

    fetch('/api/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page,
        event_id: event_id || null,
        referrer: document.referrer || null,
      }),
    }).catch(() => {})
  }, [page, event_id])
}