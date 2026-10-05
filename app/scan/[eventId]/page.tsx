'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { authFetch } from '../../lib/authFetch'

// Door scanner: point the phone camera at a ticket, get a full-screen
// green (admitted) or red (with the reason) answer. Host/admin only.

type Attendee = { ticket_id: string; name: string; email: string; tier: string; checked_in: boolean; checked_in_at: string | null }
type Result = {
  status: 'admitted' | 'already' | 'expired' | 'static_blocked' | 'wrong_event' | 'invalid' | 'error'
  ticket_id?: string | null
  name?: string | null
  tier?: string | null
  checked_in_at?: string | null
  checked_in_count?: number
  total?: number
}

const COPY: Record<Result['status'], { title: string; note?: string }> = {
  admitted: { title: 'Admitted' },
  already: { title: 'Already checked in' },
  expired: { title: 'Expired code', note: 'Looks like a screenshot. Ask them to open their ticket page — the live code refreshes.' },
  static_blocked: { title: 'Old code', note: 'This ticket has a live code. Ask them to open their ticket page instead of the email or a screenshot.' },
  wrong_event: { title: 'Wrong event', note: 'This ticket is for a different event.' },
  invalid: { title: 'Not a valid ticket' },
  error: { title: 'Couldn’t check', note: 'Connection problem — try again.' },
}

const clock = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''

export default function ScanPage() {
  const router = useRouter()
  const { eventId } = useParams() as { eventId: string }
  const [phase, setPhase] = useState<'loading' | 'denied' | 'ready'>('loading')
  const [title, setTitle] = useState('')
  const [tab, setTab] = useState<'scan' | 'find'>('scan')
  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [counts, setCounts] = useState({ in: 0, total: 0 })
  const [search, setSearch] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [cameraError, setCameraError] = useState('')
  const [checkingId, setCheckingId] = useState<string | null>(null)

  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const busy = useRef(false)
  const lastCode = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Who's allowed, and the attendee list
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) {
        try { sessionStorage.setItem('pulse_redirect', `/scan/${eventId}`) } catch {}
        router.push('/login')
        return
      }
      const res = await authFetch(`/api/host/attendees?eventId=${eventId}`)
      if (!res.ok) { setPhase('denied'); return }
      const d = await res.json()
      setTitle(d.event?.title ?? '')
      setAttendees(d.attendees ?? [])
      setCounts({ in: d.checked_in_count ?? 0, total: d.total ?? 0 })
      setPhase('ready')
    }
    load()
  }, [eventId, router])

  const dismiss = useCallback(() => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    setResult(null)
    busy.current = false
  }, [])

  const show = useCallback((r: Result) => {
    setResult(r)
    if (r.checked_in_count !== undefined && r.total !== undefined) setCounts({ in: r.checked_in_count, total: r.total })
    if (r.ticket_id && (r.status === 'admitted' || r.status === 'already')) {
      setAttendees(list => list.map(a => a.ticket_id === r.ticket_id ? { ...a, checked_in: true, checked_in_at: r.checked_in_at ?? a.checked_in_at } : a))
    }
    try { navigator.vibrate?.(r.status === 'admitted' ? [60, 40, 60] : [300]) } catch {}
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    dismissTimer.current = setTimeout(dismiss, r.status === 'admitted' ? 1800 : 3200)
  }, [dismiss])

  const checkIn = useCallback(async (payload: { code: string } | { ticketId: string }) => {
    try {
      const res = await authFetch('/api/host/checkin', { method: 'POST', body: JSON.stringify({ eventId, ...payload }) })
      const d = await res.json()
      show(res.ok && d.status ? d : { status: 'error' })
    } catch {
      show({ status: 'error' })
    }
  }, [eventId, show])

  // Camera — only while the Scan tab is open
  useEffect(() => {
    if (phase !== 'ready' || tab !== 'scan') return
    let cancelled = false
    const start = async () => {
      try {
        setCameraError('')
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return
        const scanner = new Html5Qrcode('qr-reader')
        scannerRef.current = scanner
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text: string) => {
            const now = Date.now()
            // Ignore while a result is up, and the same code twice in a row
            if (busy.current || (text === lastCode.current.code && now - lastCode.current.at < 4000)) return
            busy.current = true
            lastCode.current = { code: text, at: now }
            checkIn({ code: text })
          },
          () => {},
        )
      } catch (e) {
        setCameraError(e instanceof Error && e.message ? e.message : 'Camera access was blocked. Allow camera access for this site, or use Find by name.')
      }
    }
    start()
    return () => {
      cancelled = true
      scannerRef.current?.stop().catch(() => {})
      scannerRef.current = null
    }
  }, [phase, tab, checkIn])

  const manual = async (ticketId: string) => {
    setCheckingId(ticketId)
    busy.current = true
    await checkIn({ ticketId })
    setCheckingId(null)
  }

  const q = search.trim().toLowerCase()
  const shown = attendees
    .filter(a => !q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q))
    .sort((a, b) => Number(a.checked_in) - Number(b.checked_in) || a.name.localeCompare(b.name))

  const good = result?.status === 'admitted'
  const copy = result ? COPY[result.status] : null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Syne:wght@400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:#000;color:#f0f0f0;font-family:'Syne',sans-serif;}
        nav{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:14px 20px;border-bottom:0.5px solid rgba(255,255,255,0.08);position:sticky;top:0;background:#000;z-index:10;}
        .back{justify-self:start;background:none;border:none;color:rgba(255,255,255,0.6);font-size:13px;font-family:'Syne',sans-serif;cursor:pointer;}
        .logo{line-height:0;background:none;border:none;}
        .logo img{height:19px;width:auto;}
        .wrap{max-width:480px;margin:0 auto;padding:20px 20px 60px;}
        .title{font-family:'Barlow Condensed',sans-serif;font-size:30px;font-weight:900;text-transform:uppercase;line-height:0.95;color:#fff;}
        .count{margin-top:6px;font-size:14px;color:rgba(255,255,255,0.6);}
        .count b{color:#fff;font-weight:700;}
        .tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:18px 0 16px;background:#111;border-radius:12px;padding:4px;}
        .tab{padding:11px;border:none;border-radius:9px;background:none;color:rgba(255,255,255,0.55);font-size:14px;font-weight:600;font-family:'Syne',sans-serif;cursor:pointer;}
        .tab.on{background:#fff;color:#000;}
        .cam{border-radius:12px;overflow:hidden;background:#0a0a0a;min-height:300px;}
        #qr-reader{width:100%;}
        #qr-reader video{border-radius:12px;}
        .hint{font-size:13px;color:rgba(255,255,255,0.5);text-align:center;margin-top:12px;line-height:1.5;}
        .err{font-size:13px;color:#ff8a8a;line-height:1.5;margin-top:12px;}
        .search{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:13px 14px;font-size:16px;color:#fff;font-family:'Syne',sans-serif;outline:none;margin-bottom:10px;}
        .row{display:flex;align-items:center;gap:12px;padding:13px 0;border-bottom:1px solid rgba(255,255,255,0.08);}
        .row-txt{flex:1;min-width:0;}
        .row-name{font-size:15px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .row-sub{font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .in-btn{padding:10px 16px;border-radius:12px;border:none;background:#fff;color:#000;font-size:13px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;flex-shrink:0;}
        .in-btn:disabled{opacity:0.5;}
        .in-done{font-size:12px;color:#5ec888;font-weight:600;flex-shrink:0;}
        .result{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:32px;cursor:pointer;}
        .result.good{background:#0f8a4b;}
        .result.bad{background:#b42323;}
        .r-title{font-family:'Barlow Condensed',sans-serif;font-size:56px;font-weight:900;text-transform:uppercase;line-height:0.95;color:#fff;}
        .r-name{font-size:24px;font-weight:700;color:#fff;margin-top:16px;}
        .r-sub{font-size:16px;color:rgba(255,255,255,0.85);margin-top:6px;}
        .r-note{font-size:15px;color:rgba(255,255,255,0.9);margin-top:16px;max-width:320px;line-height:1.5;}
        .r-tap{position:absolute;bottom:calc(28px + env(safe-area-inset-bottom));font-size:12px;color:rgba(255,255,255,0.7);}
        .center{min-height:70vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;color:rgba(255,255,255,0.6);font-size:15px;line-height:1.6;}
      `}</style>

      <nav>
        <button className="back" onClick={() => router.push(`/events/${eventId}`)}>← Event</button>
        <button className="logo" onClick={() => router.push('/')} aria-label="Pulse home"><img src="/pulse-word-tight.png" alt="pulse"/></button>
      </nav>

      {phase === 'loading' ? (
        <div className="center">Loading…</div>
      ) : phase === 'denied' ? (
        <div className="center">Only the host can scan tickets for this event.</div>
      ) : (
        <div className="wrap">
          <div className="title">{title}</div>
          <div className="count"><b>{counts.in}</b> of {counts.total} checked in</div>

          <div className="tabs">
            <button className={`tab ${tab === 'scan' ? 'on' : ''}`} onClick={() => setTab('scan')}>Scan</button>
            <button className={`tab ${tab === 'find' ? 'on' : ''}`} onClick={() => setTab('find')}>Find by name</button>
          </div>

          {tab === 'scan' ? (
            <>
              <div className="cam"><div id="qr-reader"/></div>
              {cameraError
                ? <div className="err">{cameraError}</div>
                : <div className="hint">Point the camera at the ticket&apos;s QR code. Tickets must be shown live from the ticket page — screenshots won&apos;t scan.</div>}
            </>
          ) : (
            <>
              <input className="search" placeholder="Search name or email" value={search} onChange={e => setSearch(e.target.value)}/>
              {shown.map(a => (
                <div key={a.ticket_id} className="row">
                  <div className="row-txt">
                    <div className="row-name">{a.name}</div>
                    <div className="row-sub">{a.tier}{a.email ? ` · ${a.email}` : ''}</div>
                  </div>
                  {a.checked_in
                    ? <span className="in-done">In {clock(a.checked_in_at)}</span>
                    : <button className="in-btn" disabled={checkingId === a.ticket_id} onClick={() => manual(a.ticket_id)}>{checkingId === a.ticket_id ? '…' : 'Check in'}</button>}
                </div>
              ))}
              {shown.length === 0 && <div className="hint">No one matches.</div>}
            </>
          )}
        </div>
      )}

      {result && copy && (
        <div className={`result ${good ? 'good' : 'bad'}`} onClick={dismiss} role="alert">
          <div className="r-title">{copy.title}</div>
          {result.name && <div className="r-name">{result.name}</div>}
          {result.tier && <div className="r-sub">{result.tier}</div>}
          {result.status === 'already' && result.checked_in_at && <div className="r-sub">at {clock(result.checked_in_at)}</div>}
          {copy.note && <div className="r-note">{copy.note}</div>}
          <div className="r-tap">Tap to continue</div>
        </div>
      )}
    </>
  )
}
