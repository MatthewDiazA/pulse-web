'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// Where Stripe sends guests after paying. The webhook issues the tickets a moment
// later, so poll until the order exists, then open the ticket page.

export default function OrderSuccess() {
  const router = useRouter()
  const [email, setEmail] = useState<string | null>(null)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id')
    let alive = true
    const started = Date.now()
    const poll = async () => {
      if (!sessionId) { setSlow(true); return }
      try {
        const r = await fetch(`/api/orders/lookup?session_id=${encodeURIComponent(sessionId)}`)
        const d = await r.json()
        if (!alive) return
        if (d.email) setEmail(d.email)
        if (d.orderId) { router.replace(`/tickets/${d.orderId}`); return }
      } catch {}
      if (Date.now() - started > 30000) { setSlow(true); return }
      setTimeout(poll, 1500)
    }
    poll()
    return () => { alive = false }
  }, [router])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@900&family=Syne:wght@400;600&display=swap');
        body{background:#000;margin:0;color:#f0f0f0;font-family:'Syne',sans-serif;}
        .c{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center;}
        .t{font-family:'Barlow Condensed',sans-serif;font-size:40px;font-weight:900;text-transform:uppercase;line-height:0.95;color:#fff;}
        .d{font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6;max-width:320px;}
        .d b{color:#fff;font-weight:600;}
        .spin{width:22px;height:22px;border:1px solid rgba(255,255,255,0.5);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
        a{color:#fff;font-size:13px;text-decoration:underline;text-decoration-color:rgba(255,255,255,0.3);text-underline-offset:3px;}
      `}</style>
      <div className="c">
        {!slow && <div className="spin"/>}
        <div className="t">{slow ? 'Payment received' : 'You’re in'}</div>
        <div className="d">
          {slow
            ? <>Your tickets are on their way{email ? <> to <b>{email}</b></> : ''}. It can take a minute — check spam if you don&apos;t see it.</>
            : <>Getting your tickets ready{email ? <> — we&apos;re also sending them to <b>{email}</b></> : ''}.</>}
        </div>
        {slow && <Link href="/">Back to Pulse</Link>}
      </div>
    </>
  )
}
