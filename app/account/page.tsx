'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'
import QRCode from 'qrcode'
import confetti from 'canvas-confetti'
import { useNavLogo, useTicketTear, GLBadgeStamp } from '../lib/animations'

function QRTicket({ code }: { code: string }) {
  const [dataUrl, setDataUrl] = useState('')
  useEffect(() => {
    QRCode.toDataURL(code, { width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' } }).then(setDataUrl)
  }, [code])
  return (
    <div style={{textAlign:'center'}}>
      {dataUrl
        ? <img src={dataUrl} alt="QR Code" style={{width:'52px',height:'52px',borderRadius:'6px'}}/>
        : <div style={{width:'52px',height:'52px',background:'rgba(255,170,51,0.08)',border:'0.5px solid rgba(255,170,51,0.2)',borderRadius:'8px'}}/>
      }
      <div style={{fontSize:'10px',color:'#443',marginTop:'4px',fontFamily:'Syne,sans-serif'}}>Tap to scan</div>
    </div>
  )
}

function TicketModal({ ticket, onClose }: { ticket: any; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState('')
  const [phase, setPhase] = useState<'entry' | 'tear' | 'open'>('entry')
  const [scale, setScale] = useState(1)
  const topRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { startTear } = useTicketTear({
    topRef,
    bottomRef,
    onComplete: () => { setPhase('open'); fireConfetti() },
  })

  const fireConfetti = () => {
    const colors = ['#ffaa33', '#ffc850', '#ffffff', '#ff6600']
    confetti({
      particleCount: 120,
      spread: 100,
      origin: { y: 0.45 },
      colors,
      startVelocity: 32,
      gravity: 0.3,
      ticks: 600,
    })
    setTimeout(() => {
      confetti({
        particleCount: 60,
        angle: 55,
        spread: 80,
        origin: { x: 0, y: 0.5 },
        colors,
        startVelocity: 26,
        gravity: 0.25,
        ticks: 600,
      })
      confetti({
        particleCount: 60,
        angle: 125,
        spread: 80,
        origin: { x: 1, y: 0.5 },
        colors,
        startVelocity: 26,
        gravity: 0.25,
        ticks: 600,
      })
    }, 150)
  }

  useEffect(() => {
    QRCode.toDataURL(ticket.qr_code, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setDataUrl)

    const t1 = setTimeout(() => { setPhase('tear'); startTear() }, 800)

    return () => {
      clearTimeout(t1)
    }
  }, [ticket.qr_code])

  const date = ticket.event?.starts_at
    ? new Date(ticket.event.starts_at).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Date TBD'

  return (
    <>
      <style>{`
        @keyframes backdropIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{0%{transform:translateY(100px) scale(0.95);opacity:0}60%{transform:translateY(-8px) scale(1.01);opacity:1}100%{transform:translateY(0) scale(1);opacity:1}}
        @keyframes tearTop{0%{transform:translateY(0);opacity:1}100%{transform:translateY(-280px) rotate(-8deg);opacity:0}}
        @keyframes tearBottom{0%{transform:translateY(0);opacity:1}100%{transform:translateY(280px) rotate(8deg);opacity:0}}
        @keyframes revealIn{0%{transform:scale(0.7) translateY(30px);opacity:0}50%{transform:scale(1.05) translateY(-8px);opacity:1}100%{transform:scale(1) translateY(0);opacity:1}}
        @keyframes glowRing{0%,100%{box-shadow:0 0 30px rgba(255,170,51,0.2)}50%{box-shadow:0 0 60px rgba(255,170,51,0.5),0 0 100px rgba(255,170,51,0.2)}}
        @keyframes qrReveal{0%{transform:scale(0.8);opacity:0;filter:blur(4px)}100%{transform:scale(1);opacity:1;filter:blur(0)}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes badgePop{0%{transform:scale(0) rotate(-10deg);opacity:0}60%{transform:scale(1.2) rotate(2deg);opacity:1}100%{transform:scale(1) rotate(0deg);opacity:1}}
        .slide-up{animation:slideUp 0.7s cubic-bezier(0.34,1.2,0.64,1) forwards;}
        .tear-top{animation:tearTop 1.1s cubic-bezier(0.4,0,0.8,0.2) forwards;}
        .tear-bottom{animation:tearBottom 1.1s cubic-bezier(0.4,0,0.8,0.2) forwards;}
        .reveal-in{animation:revealIn 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards;}
        .glow-ring{animation:glowRing 2.5s ease-in-out infinite;}
        .qr-reveal{animation:qrReveal 0.6s cubic-bezier(0.34,1.2,0.64,1) 0.2s forwards;opacity:0;}
        .badge-pop{animation:badgePop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.4s forwards;opacity:0;}
        .shimmer-line{background:linear-gradient(90deg,transparent 0%,rgba(255,170,51,0.06) 50%,transparent 100%);background-size:200% 100%;animation:shimmer 3s ease-in-out infinite;}
      `}</style>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.92)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backdropFilter: 'blur(16px)',
          animation: 'backdropIn 0.3s ease forwards',
        }}
        onClick={onClose}
      >
        {phase === 'entry' && (
          <div className="slide-up" style={{width: '320px'}} onClick={e => e.stopPropagation()}>
            <div
              style={{
                background: 'linear-gradient(135deg,#1a0f00 0%,#0d0800 100%)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: '20px',
                overflow: 'hidden',
                boxShadow: '0 40px 80px rgba(0,0,0,0.8)',
              }}
            >
              <div
                style={{
                  height: '4px',
                  background: 'linear-gradient(90deg,#ff6600,#ffaa33,#ffc850)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s ease infinite',
                }}
              />
              <div style={{padding: '28px', textAlign: 'center'}}>
                <div
                  style={{
                    fontSize: '11px',
                    letterSpacing: '3px',
                    color: '#443',
                    textTransform: 'uppercase',
                    marginBottom: '12px',
                    fontFamily: 'Syne,sans-serif',
                  }}
                >
                  Your ticket
                </div>
                <div
                  style={{
                    fontFamily: 'Barlow Condensed,sans-serif',
                    fontSize: '32px',
                    fontWeight: 900,
                    color: '#f0f0f0',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                    marginBottom: '8px',
                  }}
                >
                  {ticket.event?.title ?? 'Event'}
                </div>
                <div style={{fontSize: '13px', color: '#665', fontFamily: 'Syne,sans-serif'}}>
                  {ticket.tier?.name} · {date}
                </div>
                <div
                  style={{
                    marginTop: '20px',
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(255,170,51,0.1)',
                    border: '1px solid rgba(255,170,51,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '20px auto 0',
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffaa33" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 9a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4V9z"/>
                    <line x1="9" y1="8" x2="9" y2="16" strokeDasharray="2 2"/>
                  </svg>
                </div>
              </div>
              <div style={{borderTop: '2px dashed rgba(255,255,255,0.08)', margin: '0 20px'}}/>
              <div style={{padding: '20px', textAlign: 'center'}}>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#443',
                    letterSpacing: '1px',
                    textTransform: 'uppercase',
                    fontFamily: 'Syne,sans-serif',
                  }}
                >
                  {ticket.event?.venue_name ?? 'Venue TBD'}
                </div>
              </div>
            </div>
          </div>
        )}

        {phase === 'tear' && (
          <div style={{width: '320px', position: 'relative'}} onClick={e => e.stopPropagation()}>
            <div
              ref={topRef}
              className="tear-top"
              style={{
                background: 'linear-gradient(135deg,#1a0f00 0%,#0d0800 100%)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: '20px 20px 0 0',
                borderBottom: '2px dashed rgba(255,255,255,0.1)',
                padding: '28px 28px 20px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  height: '3px',
                  background: 'linear-gradient(90deg,#ff6600,#ffaa33)',
                  borderRadius: '2px',
                  marginBottom: '20px',
                }}
              />
              <div
                style={{
                  fontSize: '11px',
                  letterSpacing: '3px',
                  color: '#443',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                  fontFamily: 'Syne,sans-serif',
                }}
              >
                Your ticket
              </div>
              <div
                style={{
                  fontFamily: 'Barlow Condensed,sans-serif',
                  fontSize: '32px',
                  fontWeight: 900,
                  color: '#f0f0f0',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                {ticket.event?.title ?? 'Event'}
              </div>
            </div>
            <div
              ref={bottomRef}
              className="tear-bottom"
              style={{
                background: 'linear-gradient(135deg,#0d0800 0%,#1a0f00 100%)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                borderRadius: '0 0 20px 20px',
                borderTop: '2px dashed rgba(255,255,255,0.1)',
                padding: '20px 28px 28px',
                textAlign: 'center',
              }}
            >
              <div style={{fontSize: '13px', color: '#665', fontFamily: 'Syne,sans-serif', marginBottom: '12px'}}>
                {ticket.tier?.name} · {date}
              </div>
            </div>
          </div>
        )}

        {phase === 'open' && (
          <div
            className="reveal-in glow-ring"
            style={{
              background: 'linear-gradient(135deg,#1a0f00 0%,#0d0800 100%)',
              border: '1px solid rgba(255,170,51,0.35)',
              borderRadius: '24px',
              padding: '32px',
              maxWidth: '360px',
              width: '100%',
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="shimmer-line"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '100%',
                pointerEvents: 'none',
                borderRadius: '24px',
              }}
            />
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255,255,255,0.05)',
                border: '0.5px solid rgba(255,255,255,0.08)',
                color: '#443',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ×
            </button>
            <GLBadgeStamp delay={0.4}><div className="badge-pop" style={{display: 'inline-block', background: ticket.is_guestlist ? 'linear-gradient(135deg,rgba(255,170,51,0.2),rgba(255,102,0,0.15))' : 'rgba(255,170,51,0.1)', border: '1px solid rgba(255,170,51,0.3)', borderRadius: '100px', padding: '6px 16px', marginBottom: '16px'}}>
              <span style={{fontSize: '12px', color: '#ffaa33', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: 'Syne,sans-serif', fontWeight: 500}}>{ticket.is_guestlist ? 'Guest List · On the list' : "You're on the list"}</span>
            </div></GLBadgeStamp>
            <div style={{fontFamily: 'Barlow Condensed,sans-serif', fontSize: '34px', fontWeight: 900, color: '#f0f0f0', textTransform: 'uppercase', lineHeight: 1, marginBottom: '6px'}}>
              {ticket.event?.title ?? 'Event'}
            </div>
            <div style={{fontSize: '13px', color: '#665', marginBottom: '4px', fontFamily: 'Syne,sans-serif'}}>
              {ticket.is_guestlist ? 'Guest List' : ticket.tier?.name} · {date}
            </div>
            <div style={{fontSize: '12px', color: '#443', marginBottom: '24px', fontFamily: 'Syne,sans-serif'}}>
              {ticket.event?.venue_name ?? ''}
            </div>
            <div
              className="qr-reveal"
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                padding: '16px',
                display: 'inline-block',
                cursor: 'pointer',
                transition: 'transform 0.15s',
                transform: `scale(${scale})`,
                boxShadow: '0 0 40px rgba(255,170,51,0.15)',
              }}
              onTouchStart={() => setScale(1.08)}
              onTouchEnd={() => setScale(1)}
              onMouseDown={() => setScale(1.08)}
              onMouseUp={() => setScale(1)}
            >
              {dataUrl ? (
                <img src={dataUrl} alt="QR Code" style={{width: '200px', height: '200px', display: 'block'}}/>
              ) : (
                <div style={{width: '200px', height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: '13px'}}>
                  Generating...
                </div>
              )}
            </div>
            <div style={{marginTop: '20px', fontSize: '11px', color: '#443', letterSpacing: '1.5px', textTransform: 'uppercase', fontFamily: 'Syne,sans-serif'}}>
              Show at the door · Tap to enlarge
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const logoRef = useNavLogo<HTMLButtonElement>()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [orderSuccess, setOrderSuccess] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<any>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('order') === 'success') setOrderSuccess(true)
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      setUser(user)
      const { data } = await supabase
        .from('tickets')
        .select('*, event:events(title,starts_at,venue_name,cover_image_url), tier:ticket_tiers(name,price)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setTickets(data ?? [])
      setLoading(false)
    }
    fetchData()
  }, [router])

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'
  const initials = (user?.user_metadata?.full_name ?? user?.email ?? 'U').slice(0, 2).toUpperCase()

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Syne:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#000;font-family:'Syne',sans-serif;color:#f0f0f0;}
        .wrap{max-width:800px;margin:0 auto;padding:0 40px 80px;}
        nav{padding:14px 40px;background:rgba(0,0,0,0.95);position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);position:relative;}
        nav::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#ff6600,#ffaa33,#ffc850,#ff6600,transparent);background-size:300% 100%;animation:navPulse 5s ease-in-out infinite;}
        @keyframes navPulse{0%{background-position:0% 50%;opacity:0.2}50%{background-position:100% 50%;opacity:1}100%{background-position:0% 50%;opacity:0.2}}
        .logo{background:none;border:none;padding:0;cursor:pointer;line-height:0;display:inline-flex;}
        .logo-img{height:22px;width:auto;filter:drop-shadow(0 0 10px rgba(255,170,51,0.4));}
        @media(max-width:680px){.logo-img{height:20px;}}
        .nav-right{display:flex;gap:10px;align-items:center;}
        .nav-btn{font-size:13px;color:#665;background:none;border:none;cursor:pointer;font-family:'Syne',sans-serif;text-decoration:none;transition:color 0.15s;padding:7px 12px;border-radius:6px;}
        .nav-btn:hover{color:#f0f0f0;}
        .nav-btn.highlight{background:rgba(255,170,51,0.08);color:#ffaa33;border:0.5px solid rgba(255,170,51,0.25);}
        .create-btn{background:#ffaa33;color:#000;font-size:18px;font-weight:900;width:36px;height:36px;border-radius:50%;border:none;cursor:pointer;font-family:'Syne',sans-serif;box-shadow:0 0 14px rgba(255,170,51,0.3);display:inline-flex;align-items:center;justify-content:center;transition:all 0.15s;}
        .create-btn:hover{box-shadow:0 0 22px rgba(255,170,51,0.5);transform:scale(1.05);}
        .create-btn:active{transform:scale(0.95);}
        .hero-section{padding:40px 0 20px;border-bottom:0.5px solid rgba(255,255,255,0.05);margin-bottom:24px;}
        .greeting{font-family:'Barlow Condensed',sans-serif;font-size:72px;line-height:0.95;font-weight:900;text-transform:uppercase;margin-bottom:8px;}
        .greeting span{color:#ffaa33;text-shadow:0 0 8px rgba(255,170,51,0.5),0 0 16px rgba(255,170,51,0.25);}
        .user-card{background:#0d0800;border:0.5px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px 24px;margin-bottom:32px;display:flex;align-items:center;gap:16px;}
        .user-avatar{width:56px;height:56px;border-radius:50%;background:rgba(255,170,51,0.12);border:1.5px solid rgba(255,170,51,0.3);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:500;color:#ffaa33;flex-shrink:0;font-family:'Syne',sans-serif;}
        .user-name{font-size:16px;font-weight:500;color:#f0f0f0;}
        .user-email{font-size:13px;color:#554;margin-top:2px;}
        .signout-btn{margin-left:auto;font-size:12px;color:#554;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.08);border-radius:6px;padding:7px 14px;cursor:pointer;font-family:'Syne',sans-serif;transition:all 0.15s;}
        .signout-btn:hover{color:#e24b4a;border-color:rgba(226,75,74,0.3);}
        .section-title{font-size:11px;color:#443;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:16px;padding-bottom:8px;border-bottom:0.5px solid rgba(255,255,255,0.05);}
        .ticket-card{background:#0d0800;border:0.5px solid rgba(255,255,255,0.06);border-radius:12px;overflow:hidden;margin-bottom:12px;display:flex;transition:all 0.2s;cursor:pointer;position:relative;}
        .ticket-card.gl{border-color:rgba(255,170,51,0.4);box-shadow:0 0 24px rgba(255,170,51,0.08);}
        .gl-badge{position:absolute;top:0;right:0;z-index:2;background:linear-gradient(135deg,#ffaa33,#ff6600);color:#000;font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:13px;letter-spacing:1px;padding:3px 10px;border-radius:0 12px 0 12px;box-shadow:0 2px 10px rgba(255,170,51,0.4);}
        .ticket-card:hover{border-color:rgba(255,170,51,0.25);transform:translateY(-2px);box-shadow:0 8px 32px rgba(0,0,0,0.5);}
        .ticket-left{width:4px;background:linear-gradient(180deg,#ffaa33,#ff6600);flex-shrink:0;}
        .ticket-body{padding:20px 24px;flex:1;display:flex;align-items:center;gap:20px;}
        .ticket-info{flex:1;}
        .ticket-event{font-size:16px;font-weight:500;color:#f0f0f0;margin-bottom:4px;}
        .ticket-tier{font-size:13px;color:#443;margin-bottom:4px;}
        .ticket-date{font-size:12px;color:#332;}
        .ticket-price{font-family:'Barlow Condensed',sans-serif;font-size:24px;color:#ffaa33;font-weight:900;text-align:right;min-width:60px;}
        .empty-state{text-align:center;padding:60px 20px;}
        .empty-title{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:#f0f0f0;margin-bottom:8px;}
        .empty-sub{font-size:14px;color:#443;margin-bottom:24px;}
        .empty-btn{background:#ffaa33;color:#000;font-size:14px;font-weight:700;padding:12px 28px;border-radius:100px;text-decoration:none;display:inline-block;font-family:'Syne',sans-serif;box-shadow:0 0 16px rgba(255,170,51,0.3);}
        .success-banner{background:rgba(255,170,51,0.07);border:0.5px solid rgba(255,170,51,0.25);border-radius:10px;padding:16px 20px;margin-bottom:32px;display:flex;align-items:center;gap:12px;animation:bannerIn 0.5s cubic-bezier(0.34,1.2,0.64,1) forwards;}
        @keyframes bannerIn{from{transform:translateY(20px);opacity:0}to{transform:translateY(0);opacity:1}}
        .success-text{font-size:14px;color:#ffaa33;font-weight:500;}
        .success-sub{font-size:12px;color:#554;margin-top:2px;}
        @media(max-width:680px){.wrap{padding:0 20px 60px;} .greeting{font-size:48px;} nav{padding:14px 16px;} .nav-btn{padding:6px 10px;font-size:12px;} .create-btn{width:32px;height:32px;font-size:16px;}}
      `}</style>

      {selectedTicket && <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)}/>}

      <nav>
        <button ref={logoRef} className="logo" onClick={() => router.push('/')} aria-label="Pulse home"><img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/></button>
        <div className="nav-right">
          <a href="/discover" onClick={e => { e.preventDefault(); router.push('/discover') }} className="nav-btn">Discover</a>
          <a href="/connect" onClick={e => { e.preventDefault(); router.push('/connect') }} className="nav-btn">Connect</a>
          <a href="/host" onClick={e => { e.preventDefault(); router.push('/host') }} className="nav-btn highlight">Dashboard</a>
          <button className="create-btn" onClick={() => router.push('/host/create')} aria-label="Create event">+</button>
        </div>
      </nav>

      <div className="wrap">
        {orderSuccess && (
          <div className="success-banner" style={{marginTop: '32px'}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffaa33" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 9a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4V9z"/>
              <line x1="9" y1="8" x2="9" y2="16" strokeDasharray="2 2"/>
            </svg>
            <div>
              <div className="success-text">Payment successful — you're on the list</div>
              <div className="success-sub">Your tickets have been sent to your email</div>
            </div>
          </div>
        )}

        <div className="hero-section">
          <h1 className="greeting">Hey, <span>{firstName}</span></h1>
        </div>

        {user && (
          <div className="user-card">
            <div className="user-avatar">{initials}</div>
            <div>
              <div className="user-name">{user.user_metadata?.full_name ?? 'No name set'}</div>
              <div className="user-email">{user.email}</div>
            </div>
            <button
              className="signout-btn"
              onClick={async () => {
                const s = createClient()
                await s.auth.signOut()
                router.push('/')
              }}
            >
              Sign out
            </button>
          </div>
        )}

        <div className="section-title">My tickets</div>

        {loading ? (
          <div style={{textAlign: 'center', padding: '40px', color: '#443', fontSize: '14px'}}>Loading your tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">No tickets yet</div>
            <div className="empty-sub">When you buy tickets they'll show up here</div>
            <a href="/" onClick={e => { e.preventDefault(); router.push('/') }} className="empty-btn">Browse events</a>
          </div>
        ) : (
          tickets.map(ticket => {
            const date = ticket.event?.starts_at
              ? new Date(ticket.event.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              : 'Date TBD'
            const price = Number(ticket.tier?.price)
            return (
              <div key={ticket.id} className={`ticket-card ${ticket.is_guestlist ? 'gl' : ''}`} onClick={() => setSelectedTicket(ticket)}>
                {ticket.is_guestlist && <GLBadgeStamp delay={0.1}><span className="gl-badge">GL</span></GLBadgeStamp>}
                <div className="ticket-left"/>
                <div className="ticket-body">
                  <div className="ticket-info">
                    <div className="ticket-event">{ticket.event?.title ?? 'Event'}</div>
                    <div className="ticket-tier">{ticket.is_guestlist ? 'Guest List' : (ticket.tier?.name ?? 'Ticket')}</div>
                    <div className="ticket-date">{date} · {ticket.event?.venue_name ?? ''}</div>
                  </div>
                  <QRTicket code={ticket.qr_code}/>
                  <div className="ticket-price">{ticket.is_guestlist ? 'GL' : (isNaN(price) || price === 0 ? 'Free' : `$${price}`)}</div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}