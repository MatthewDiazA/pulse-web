'use client'
import { useEffect, useState } from 'react'
import { useMagneticButton, useNavLogo } from '../../lib/animations'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const COLORS = {
  primary: '#ffaa33',
  accent: '#ff6600',
  highlight: '#ffc850',
  bg: '#000',
} as const

type Phase = 'checking' | 'need-login' | 'claiming' | 'success' | 'error'

export default function ClaimGuestPage() {
  const router = useRouter()
  const params = useParams()
  const logoRef = useNavLogo<HTMLButtonElement>()
  const claimBtnRef = useMagneticButton<HTMLButtonElement>()
  const token = params.token as string

  const [phase, setPhase] = useState<Phase>('checking')
  const [message, setMessage] = useState('')
  const [eventTitle, setEventTitle] = useState<string>('')
  const [ticketCount, setTicketCount] = useState(1)
  const [ownLink, setOwnLink] = useState(false)
  // No account needed: guests claim with name + email
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [formError, setFormError] = useState('')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  // Shared by the signed-in auto-claim and the guest form
  const claim = async (payload: { userId: string } | { guestName: string; guestEmail: string }) => {
    setPhase('claiming')
    try {
      const res = await fetch('/api/claim-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...payload }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        setTicketCount(data.ticketCount ?? 1)
        setOrderId(data.orderId ?? null)
        if ('guestEmail' in payload) setSentTo(payload.guestEmail)
        // Fetch the event title for the success screen
        if (data.eventId) {
          const { data: ev } = await createClient().from('events').select('title').eq('id', data.eventId).single()
          if (ev?.title) setEventTitle(ev.title)
        }
        setPhase('success')
      } else if (res.status === 400 && 'guestEmail' in payload) {
        // Form problem — keep them on the form
        setFormError(data.error ?? 'Check your name and email.')
        setPhase('need-login')
      } else {
        setOwnLink(!!data.ownLink)
        setMessage(data.error ?? 'This invite link could not be used.')
        setPhase('error')
      }
    } catch {
      setMessage('Something went wrong. Please try again.')
      setPhase('error')
    }
  }

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) {
        // Signing in stays optional; if they choose to, come back here afterwards
        try { sessionStorage.setItem('pulse_redirect', `/gl/${token}`) } catch {}
        setPhase('need-login')
        return
      }
      claim({ userId: user.id })
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const submitGuest = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    if (!guestName.trim()) { setFormError('Add your name so the door can find you.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) { setFormError('Enter a valid email — your ticket goes there.'); return }
    claim({ guestName: guestName.trim(), guestEmail: guestEmail.trim() })
  }

  const goLogin = () => {
    router.push('/login')
  }

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Syne:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:${COLORS.bg};color:#f0f0f0;font-family:'Syne',sans-serif;}
        .wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;}
        .card{max-width:380px;width:100%;background:linear-gradient(135deg,#1a0f00 0%,#0d0800 100%);border:1px solid rgba(255,170,51,0.25);border-radius:24px;padding:40px 28px;box-shadow:0 30px 80px rgba(0,0,0,0.7);position:relative;overflow:hidden;}
        .card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,${COLORS.accent},${COLORS.primary},${COLORS.highlight});}
        .gl-mark{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:40px;letter-spacing:2px;background:linear-gradient(135deg,${COLORS.primary},${COLORS.accent});-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:8px;}
        .eyebrow{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#776;margin-bottom:18px;}
        .title{font-family:'Barlow Condensed',sans-serif;font-size:30px;font-weight:900;text-transform:uppercase;color:#fff;line-height:1;margin-bottom:10px;}
        .sub{font-size:14px;color:#998;line-height:1.6;margin-bottom:24px;}
        .gl-form{display:flex;flex-direction:column;gap:10px;text-align:left;}
        .gl-input{width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:14px 14px;font-size:16px;color:#fff;font-family:'Syne',sans-serif;outline:none;}
        .gl-input:focus{border-color:rgba(255,255,255,0.35);}
        .gl-input::placeholder{color:rgba(255,255,255,0.3);}
        .gl-form .btn{justify-content:center;margin-top:6px;}
        .gl-err{font-size:12px;color:#ff8a8a;}
        .gl-signin{margin-top:16px;background:none;border:none;color:rgba(255,255,255,0.55);font-size:13px;font-family:'Syne',sans-serif;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(255,255,255,0.25);text-underline-offset:3px;}
        .btn{background:${COLORS.primary};color:#000;border:none;border-radius:100px;padding:14px 28px;font-size:15px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;box-shadow:0 0 20px rgba(255,170,51,0.3);transition:all 0.15s;display:inline-flex;align-items:center;gap:8px;}
        .btn:hover{box-shadow:0 0 30px rgba(255,170,51,0.45);}
        .btn:active{transform:scale(0.97);}
        .btn.ghost{background:transparent;color:${COLORS.primary};border:0.5px solid rgba(255,170,51,0.3);box-shadow:none;margin-top:10px;}
        .spinner{width:32px;height:32px;border:2px solid ${COLORS.primary};border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 18px;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .err-icon{color:#ff6666;font-size:40px;margin-bottom:14px;}
      `}</style>

      <div className="wrap">
        <div className="card">
          {phase === 'checking' || phase === 'claiming' ? (
            <>
              <div className="spinner" />
              <div className="eyebrow">Guest List</div>
              <div className="sub">{phase === 'checking' ? 'Checking your invite…' : 'Adding you to the list…'}</div>
            </>
          ) : phase === 'need-login' ? (
            <>
              <div className="gl-mark">GL</div>
              <div className="eyebrow">You've been invited</div>
              <div className="title">Guest List Access</div>
              <div className="sub">Add your name and email — we&apos;ll send your ticket straight there. No account needed.</div>
              <form className="gl-form" onSubmit={submitGuest} noValidate>
                <input className="gl-input" placeholder="Full name" autoComplete="name" value={guestName} onChange={e => setGuestName(e.target.value)}/>
                <input className="gl-input" type="email" inputMode="email" placeholder="Email" autoComplete="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)}/>
                {formError && <div className="gl-err">{formError}</div>}
                <button ref={claimBtnRef} className="btn" type="submit">
                  <i className="ti ti-ticket" aria-hidden="true" />
                  Claim my spot
                </button>
              </form>
              <button className="gl-signin" onClick={goLogin}>Have an account? Sign in instead</button>
            </>
          ) : phase === 'success' ? (
            <>
              <div className="gl-mark">GL</div>
              <div className="eyebrow">You're on the list</div>
              <div className="title">{eventTitle || 'You\'re in'}</div>
              <div className="sub">
                {ticketCount > 1 ? `Your ${ticketCount} guest list tickets are ready` : 'Your guest list ticket is ready'}
                {sentTo ? <> — we also sent {ticketCount > 1 ? 'them' : 'it'} to <b style={{color:'#fff'}}>{sentTo}</b>.</> : '. Find it in your account with your QR code for the door.'}
              </div>
              <button ref={claimBtnRef} className="btn" onClick={() => router.push(orderId ? `/tickets/${orderId}` : '/account')}>
                <i className="ti ti-ticket" aria-hidden="true" />
                View my ticket
              </button>
            </>
          ) : (
            <>
              <i className="ti ti-alert-circle err-icon" aria-hidden="true" />
              <div className="eyebrow">Guest List</div>
              <div className="title">{ownLink ? 'This is your link' : "Can't use this link"}</div>
              <div className="sub">{message}</div>
              <button className="btn ghost" onClick={() => router.push('/')}>Go home</button>
            </>
          )}
        </div>
      </div>
    </>
  )
}