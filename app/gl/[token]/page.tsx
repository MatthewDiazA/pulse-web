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

  useEffect(() => {
    const run = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Stash where to return after login
        try { sessionStorage.setItem('pulse_redirect', `/gl/${token}`) } catch {}
        setPhase('need-login')
        return
      }

      setPhase('claiming')
      try {
        const res = await fetch('/api/claim-guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, userId: user.id }),
        })
        const data = await res.json()

        if (res.ok && data.success) {
          // Fetch the event title for the success screen
          if (data.eventId) {
            const { data: ev } = await supabase
              .from('events')
              .select('title')
              .eq('id', data.eventId)
              .single()
            if (ev?.title) setEventTitle(ev.title)
          }
          setPhase('success')
        } else {
          setMessage(data.error ?? 'This invite link could not be used.')
          setPhase('error')
        }
      } catch {
        setMessage('Something went wrong. Please try again.')
        setPhase('error')
      }
    }
    run()
  }, [token])

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
              <div className="sub">Sign in or create a free account to claim your spot on the guest list. It only takes a moment.</div>
              <button ref={claimBtnRef} className="btn" onClick={goLogin}>
                <i className="ti ti-login" aria-hidden="true" />
                Sign in to claim
              </button>
            </>
          ) : phase === 'success' ? (
            <>
              <div className="gl-mark">GL</div>
              <div className="eyebrow">You're on the list</div>
              <div className="title">{eventTitle || 'You\'re in'}</div>
              <div className="sub">Your guest list ticket is ready. Find it in your account with your QR code for the door.</div>
              <button ref={claimBtnRef} className="btn" onClick={() => router.push('/account')}>
                <i className="ti ti-ticket" aria-hidden="true" />
                View my ticket
              </button>
            </>
          ) : (
            <>
              <i className="ti ti-alert-circle err-icon" aria-hidden="true" />
              <div className="eyebrow">Guest List</div>
              <div className="title">Can't use this link</div>
              <div className="sub">{message}</div>
              <button className="btn ghost" onClick={() => router.push('/')}>Go home</button>
            </>
          )}
        </div>
      </div>
    </>
  )
}