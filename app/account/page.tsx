'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'
import QRCode from 'qrcode'
import confetti from 'canvas-confetti'
import { gsap } from 'gsap'
import { useNavLogo, useTicketTear, GLBadgeStamp } from '../lib/animations'
import TouchBlot from '../components/TouchBlot'
import TiltCard from '../components/TiltCard'

// ── Helpers ──────────────────────────────────────────────────────────────────
function toRomanTierName(name: string): string {
  const map: Record<string, string> = {
    '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V',
    '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X',
  }
  return name.replace(/\b(\d+)\b/g, n => map[n] ?? n)
}

// ── Ticket Modal ──────────────────────────────────────────────────────────────
function TicketModal({ ticket, onClose }: { ticket: any; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState('')
  const [phase, setPhase] = useState<'entry' | 'tear' | 'open'>('entry')
  const [enlarged, setEnlarged] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  // Guard: the tear can finish via GSAP's onComplete or the safety timer below.
  // Whichever gets there first opens the ticket; confetti fires exactly once.
  const openedRef = useRef(false)

  const fireConfetti = () => {
    const colors = ['#ffaa33', '#ffc850', '#ffffff']
    confetti({ particleCount: 90, spread: 100, origin: { y: 0.45 }, colors, startVelocity: 30, gravity: 0.3, ticks: 500 })
  }

  const openTicket = () => {
    if (openedRef.current) return
    openedRef.current = true
    setPhase('open')
    setEnlarged(false)
    fireConfetti()
  }

  const { startTear } = useTicketTear({ topRef, bottomRef, onComplete: openTicket })

  useEffect(() => {
    QRCode.toDataURL(ticket.qr_code, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } }).then(setDataUrl)
    const t1 = setTimeout(() => {
      setPhase('tear')
      requestAnimationFrame(() => requestAnimationFrame(() => startTear()))
    }, 800)
    // Safety net only — if GSAP never reports completion, open anyway.
    const t2 = setTimeout(openTicket, 2600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [ticket.qr_code])

  const date = ticket.event?.starts_at
    ? new Date(ticket.event.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase()
    : 'tba'

  return (
    <>
      <style>{`
        @keyframes backdropIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        @keyframes revealIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
        @keyframes qrReveal{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
        .slide-up{animation:slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards;}
        .reveal-in{animation:revealIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards;}
        .qr-reveal{animation:qrReveal 0.6s cubic-bezier(0.34,1.2,0.64,1) 0.2s forwards;opacity:0;}
        .stub-label{font-size:10px;letter-spacing:3px;color:rgba(255,255,255,0.3);font-family:'Syne',sans-serif;}
        .stub-title{font-family:'Barlow Condensed',sans-serif;font-size:32px;font-weight:700;color:#fff;line-height:0.95;}
        .stub-meta{font-size:12px;color:rgba(255,255,255,0.45);font-family:'Syne',sans-serif;letter-spacing:1px;}
      `}</style>
      <div
        style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.94)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',backdropFilter:'blur(16px)',animation:'backdropIn 0.3s ease forwards' }}
        onClick={onClose}
      >
        {phase === 'entry' && (
          <div className="slide-up" style={{width:'320px',maxWidth:'calc(100vw - 40px)'}} onClick={e => e.stopPropagation()}>
            <div style={{ background:'#000',border:'0.5px solid rgba(255,255,255,0.18)',overflow:'hidden' }}>
              <div style={{padding:'30px 28px',textAlign:'center'}}>
                <div className="stub-label" style={{marginBottom:'14px'}}>your ticket</div>
                <div className="stub-title" style={{marginBottom:'8px'}}>{(ticket.event?.title ?? 'event').toLowerCase()}</div>
                <div className="stub-meta">{ticket.tier?.name ? toRomanTierName(ticket.tier.name) : ''} · {date}</div>
              </div>
            </div>
          </div>
        )}

        {/* GSAP owns the tear — no CSS keyframes competing for the same elements */}
        {phase === 'tear' && (
          <div style={{width:'320px',maxWidth:'calc(100vw - 40px)',position:'relative'}} onClick={e => e.stopPropagation()}>
            <div ref={topRef} style={{ background:'#000',border:'0.5px solid rgba(255,255,255,0.18)',borderBottom:'1px dashed rgba(255,255,255,0.25)',padding:'30px 28px 22px',textAlign:'center' }}>
              <div className="stub-label" style={{marginBottom:'10px'}}>your ticket</div>
              <div className="stub-title">{(ticket.event?.title ?? 'event').toLowerCase()}</div>
            </div>
            <div ref={bottomRef} style={{ background:'#000',border:'0.5px solid rgba(255,255,255,0.18)',borderTop:'1px dashed rgba(255,255,255,0.25)',padding:'22px 28px 30px',textAlign:'center' }}>
              <div className="stub-meta">{ticket.tier?.name ? toRomanTierName(ticket.tier.name) : ''} · {date}</div>
            </div>
          </div>
        )}

        {phase === 'open' && (
          <div className="reveal-in" style={{ background:'#000',border:'0.5px solid rgba(255,255,255,0.2)',padding:'32px',width:'320px',maxWidth:'calc(100vw - 40px)',textAlign:'center',position:'relative' }} onClick={e => e.stopPropagation()}>
            <GLBadgeStamp delay={0.4}>
              <div style={{ display:'inline-block',border:'0.5px solid rgba(255,170,51,0.45)',padding:'6px 14px',marginBottom:'18px' }}>
                <span style={{fontSize:'10px',color:'#ffaa33',letterSpacing:'2px',fontFamily:'Syne,sans-serif'}}>{ticket.is_guestlist ? 'guest list' : "you're on the list"}</span>
              </div>
            </GLBadgeStamp>
            <div className="stub-title" style={{marginBottom:'8px'}}>{(ticket.event?.title ?? 'event').toLowerCase()}</div>
            <div className="stub-meta" style={{marginBottom:'4px'}}>{ticket.tier?.name ? toRomanTierName(ticket.tier.name) : ''} · {date}</div>
            <div style={{fontSize:'11px',color:'rgba(255,255,255,0.3)',fontFamily:'Syne,sans-serif',letterSpacing:'1px',marginBottom:'26px'}}>{(ticket.event?.venue_name ?? '').toLowerCase()}</div>
            <div
              className="qr-reveal"
              style={{
                background: '#fff',
                padding: '12px',
                display: 'inline-block',
                cursor: 'pointer',
                transition: 'all 0.35s cubic-bezier(0.34,1.2,0.64,1)',
              }}
              onClick={() => setEnlarged(e => !e)}
            >
              {dataUrl
                ? <img src={dataUrl} alt="QR" style={{width: enlarged ? '240px' : '170px', height: enlarged ? '240px' : '170px', display:'block', transition:'all 0.35s cubic-bezier(0.34,1.2,0.64,1)'}}/>
                : <div style={{width:'170px',height:'170px',display:'flex',alignItems:'center',justifyContent:'center',color:'#888',fontSize:'12px'}}>generating…</div>
              }
            </div>
            <div style={{marginTop:'16px',fontSize:'10px',color:'rgba(255,255,255,0.3)',letterSpacing:'2px',fontFamily:'Syne,sans-serif'}}>{enlarged ? 'tap to shrink' : 'show at the door · tap to enlarge'}</div>
            <button onClick={onClose} style={{marginTop:'24px',background:'none',border:'0.5px solid rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.55)',padding:'11px 24px',fontSize:'11px',letterSpacing:'2px',cursor:'pointer',fontFamily:'Syne,sans-serif',display:'block',width:'100%'}}>close</button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Wallet Card ───────────────────────────────────────────────────────────────
function WalletCard({ ticket, onClick }: { ticket: any; onClick: () => void }) {
  const date = ticket.event?.starts_at
    ? new Date(ticket.event.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toLowerCase()
    : 'tba'
  const price = Number(ticket.tier?.price)
  const tierName = ticket.tier?.name ? toRomanTierName(ticket.tier.name) : 'ticket'
  const cover = ticket.event?.cover_image_url

  return (
    <TiltCard
      className="wallet-card-wrap"
      style={{ cursor: 'pointer', overflow: 'hidden', height: '250px', position: 'relative' }}
      intensity={0.4}
      onClick={onClick}
    >
      {cover ? (
        <>
          <img src={cover} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',zIndex:0}}/>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.94) 0%,rgba(0,0,0,0.35) 55%,rgba(0,0,0,0.1) 100%)',zIndex:1}}/>
        </>
      ) : (
        <div style={{position:'absolute',inset:0,background:'#080808',zIndex:0}}/>
      )}
      <div style={{
        position:'absolute',inset:0,zIndex:3,
        border: ticket.is_guestlist ? '0.5px solid rgba(255,170,51,0.5)' : '0.5px solid rgba(255,255,255,0.14)',
        pointerEvents:'none',
      }}/>
      <div style={{position:'relative',zIndex:2,height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'18px 20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          {ticket.is_guestlist ? (
            <span style={{color:'#ffaa33',fontSize:'10px',letterSpacing:'2px',fontFamily:'Syne,sans-serif'}}>guest list</span>
          ) : <span/>}
          <span style={{fontSize:'10px',color:'rgba(255,255,255,0.35)',fontFamily:'Syne,sans-serif',letterSpacing:'1.5px'}}>tap to open</span>
        </div>
        <div>
          <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:'clamp(32px,5vw,42px)',fontWeight:700,color:'#fff',lineHeight:0.92,marginBottom:'12px',letterSpacing:'-0.5px'}}>{(ticket.event?.title ?? 'event').toLowerCase()}</div>
          <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap',fontSize:'11px',letterSpacing:'1.5px',color:'rgba(255,255,255,0.5)',fontFamily:'Syne,sans-serif'}}>
            <span>{date}</span>
            <span style={{color:'rgba(255,255,255,0.2)'}}>·</span>
            <span>{tierName.toLowerCase()}</span>
            {price > 0 && <>
              <span style={{color:'rgba(255,255,255,0.2)'}}>·</span>
              <span>${price}</span>
            </>}
          </div>
        </div>
      </div>
    </TiltCard>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const logoRef = useNavLogo<HTMLButtonElement>()
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
      const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', user.id).single()
      if (admin || user.email === 'mad2288@columbia.edu') setIsAdmin(true)
      const { data } = await supabase
        .from('tickets')
        .select('*, event:events(title,starts_at,venue_name,cover_image_url), tier:ticket_tiers(name,price)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setTickets(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // Stagger cards in after load
  useEffect(() => {
    if (loading || !gridRef.current) return
    const cards = gridRef.current.querySelectorAll('.wallet-card-wrap')
    if (!cards.length) return
    gsap.set(cards, { opacity: 0, y: 32 })
    gsap.to(cards, { opacity: 1, y: 0, duration: 0.55, stagger: 0.08, ease: 'power3.out', delay: 0.1 })
  }, [loading])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  const initials = (user?.user_metadata?.full_name ?? user?.email ?? 'U')
    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <>
      <TouchBlot />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Syne:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:#000;font-family:'Syne',sans-serif;color:#f0f0f0;min-height:100vh;}

        nav{padding:0 32px;height:66px;background:rgba(0,0,0,0.9);position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(255,255,255,0.08);}
        @media(max-width:680px){nav{padding:0 18px;height:56px;}}
        .logo{background:none;border:none;padding:0;cursor:pointer;line-height:0;display:inline-flex;flex-shrink:0;}
        .logo-img{height:19px;width:auto;}
        .nav-right{display:flex;align-items:center;gap:26px;}
        @media(max-width:680px){.nav-right{gap:16px;}}
        .nav-links{display:flex;align-items:center;gap:26px;}
        @media(max-width:680px){.nav-links{gap:14px;}}
        .nav-link{font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.35);background:none;border:none;cursor:pointer;font-family:'Syne',sans-serif;transition:color 0.2s;white-space:nowrap;padding:0;}
        .nav-link:hover{color:#fff;}
        /* On this page the avatar is a marker, not a link — it already points here */
        .nav-avatar{width:30px;height:30px;border-radius:50%;border:0.5px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,0.6);flex-shrink:0;letter-spacing:0.5px;}

        .wrap{max-width:900px;margin:0 auto;padding:52px 32px 100px;position:relative;z-index:1;}
        @media(max-width:680px){.wrap{padding:36px 18px 80px;}}

        .section-header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:26px;}
        .section-title{font-family:'Syne',sans-serif;font-size:10px;letter-spacing:3px;color:rgba(255,255,255,0.3);}
        .ticket-count{font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.25);font-family:'Syne',sans-serif;}

        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:18px;}
        @media(max-width:420px){.grid{grid-template-columns:1fr;}}

        .empty{padding:70px 0;}
        .empty-title{font-family:'Barlow Condensed',sans-serif;font-size:34px;font-weight:700;color:#fff;margin-bottom:10px;letter-spacing:-0.5px;}
        .empty-sub{font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:26px;letter-spacing:1px;}
        .empty-btn{background:none;border:0.5px solid rgba(255,255,255,0.25);color:#fff;padding:12px 24px;font-size:11px;letter-spacing:2px;font-family:'Syne',sans-serif;cursor:pointer;transition:border-color 0.15s;}
        .empty-btn:hover{border-color:#fff;}

        /* Account block — sign out is legible, not hidden */
        .account-block{margin-top:64px;padding-top:26px;border-top:0.5px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;}
        .account-email{font-size:11px;letter-spacing:1px;color:rgba(255,255,255,0.35);font-family:'Syne',sans-serif;word-break:break-all;}
        .signout-btn{background:none;border:0.5px solid rgba(255,255,255,0.25);color:rgba(255,255,255,0.7);font-family:'Syne',sans-serif;font-size:11px;letter-spacing:2px;padding:11px 22px;cursor:pointer;transition:all 0.15s;flex-shrink:0;}
        .signout-btn:hover{border-color:#fff;color:#fff;}

        .spinner{width:22px;height:22px;border:1px solid rgba(255,255,255,0.25);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin:80px auto;}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {selectedTicket && <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)}/>}

      <nav>
        <button ref={logoRef} className="logo" onClick={() => router.push('/')} aria-label="Pulse home">
          <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
        </button>
        <div className="nav-right">
          <div className="nav-links">
            <button className="nav-link" onClick={() => router.push('/discover')}>discover</button>
            <button className="nav-link" onClick={() => router.push('/connect')}>connect</button>
            <button className="nav-link" onClick={() => router.push('/host')}>dashboard</button>
            {isAdmin && (
              <button className="nav-link" onClick={() => router.push('/admin')} style={{color:'rgba(255,170,51,0.7)'}}>admin</button>
            )}
          </div>
          {user && <div className="nav-avatar" title={user.email}>{initials}</div>}
        </div>
      </nav>

      <div className="wrap">
        {loading ? (
          <div className="spinner"/>
        ) : (
          <>
            <div className="section-header">
              <div className="section-title">my tickets</div>
              {tickets.length > 0 && <div className="ticket-count">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</div>}
            </div>

            {tickets.length === 0 ? (
              <div className="empty">
                <div className="empty-title">no tickets yet</div>
                <div className="empty-sub">find an event and grab your spot</div>
                <button className="empty-btn" onClick={() => router.push('/')}>browse events</button>
              </div>
            ) : (
              <div className="grid" ref={gridRef}>
                {tickets.map((ticket) => (
                  <WalletCard
                    key={ticket.id}
                    ticket={ticket}
                    onClick={() => setSelectedTicket(ticket)}
                  />
                ))}
              </div>
            )}

            <div className="account-block">
              <div className="account-email">{user?.email}</div>
              <button className="signout-btn" onClick={signOut}>sign out</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}