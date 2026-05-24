'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'
import QRCode from 'qrcode'
import confetti from 'canvas-confetti'
import { gsap } from 'gsap'
import { useNavLogo, useTicketTear, GLBadgeStamp } from '../lib/animations'
import TouchBlot from '../components/TouchBlot'

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
  const { startTear } = useTicketTear({
    topRef,
    bottomRef,
    onComplete: () => { setPhase('open'); setEnlarged(false); fireConfetti() },
  })

  const fireConfetti = () => {
    const colors = ['#ffaa33', '#ffc850', '#ffffff', '#ff6600']
    confetti({ particleCount: 120, spread: 100, origin: { y: 0.45 }, colors, startVelocity: 32, gravity: 0.3, ticks: 600 })
    setTimeout(() => {
      confetti({ particleCount: 60, angle: 55, spread: 80, origin: { x: 0, y: 0.5 }, colors, startVelocity: 26, gravity: 0.25, ticks: 600 })
      confetti({ particleCount: 60, angle: 125, spread: 80, origin: { x: 1, y: 0.5 }, colors, startVelocity: 26, gravity: 0.25, ticks: 600 })
    }, 150)
  }

  useEffect(() => {
    QRCode.toDataURL(ticket.qr_code, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } }).then(setDataUrl)
    const t1 = setTimeout(() => {
      setPhase('tear')
      requestAnimationFrame(() => requestAnimationFrame(() => startTear()))
    }, 800)
    const t2 = setTimeout(() => { setPhase('open'); setEnlarged(false); fireConfetti() }, 2600)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [ticket.qr_code])

  const date = ticket.event?.starts_at
    ? new Date(ticket.event.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'TBD'

  return (
    <>
      <style>{`
        @keyframes backdropIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:translateY(0)}}
        @keyframes revealIn{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
        @keyframes glowRing{0%,100%{box-shadow:0 0 20px rgba(255,170,51,0.2),0 0 60px rgba(255,170,51,0.08)}50%{box-shadow:0 0 40px rgba(255,170,51,0.45),0 0 100px rgba(255,170,51,0.15)}}
        @keyframes qrReveal{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}
        @keyframes shimmer{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes tearTop{to{transform:translateY(-300px) rotate(-8deg);opacity:0}}
        @keyframes tearBottom{to{transform:translateY(300px) rotate(7deg);opacity:0}}
        .slide-up{animation:slideUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards;}
        .reveal-in{animation:revealIn 0.5s cubic-bezier(0.16,1,0.3,1) forwards;}
        .glow-ring{animation:glowRing 2.5s ease-in-out infinite;}
        .qr-reveal{animation:qrReveal 0.6s cubic-bezier(0.34,1.2,0.64,1) 0.2s forwards;opacity:0;}
        .shimmer-line{background:linear-gradient(90deg,transparent,rgba(255,170,51,0.06),transparent);background-size:200% 100%;animation:shimmer 3s ease-in-out infinite;}
        .tear-top{animation:tearTop 1.1s cubic-bezier(0.4,0,0.8,0.2) forwards;}
        .tear-bottom{animation:tearBottom 1.1s cubic-bezier(0.4,0,0.8,0.2) 0.05s forwards;}
      `}</style>
      <div
        style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.92)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',backdropFilter:'blur(16px)',animation:'backdropIn 0.3s ease forwards' }}
        onClick={onClose}
      >
        {phase === 'entry' && (
          <div className="slide-up" style={{width:'320px',maxWidth:'calc(100vw - 40px)'}} onClick={e => e.stopPropagation()}>
            <div style={{ background:'linear-gradient(135deg,#1a0f00,#0d0800)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:'20px',overflow:'hidden',boxShadow:'0 40px 80px rgba(0,0,0,0.8)' }}>
              <div style={{ height:'4px',background:'linear-gradient(90deg,#ff6600,#ffaa33,#ffc850)',backgroundSize:'200% 100%',animation:'shimmer 1.5s ease infinite' }}/>
              <div style={{padding:'28px',textAlign:'center'}}>
                <div style={{fontSize:'11px',letterSpacing:'3px',color:'#443',textTransform:'uppercase',marginBottom:'12px',fontFamily:'Syne,sans-serif'}}>Your ticket</div>
                <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:'32px',fontWeight:900,color:'#fff',textTransform:'uppercase',marginBottom:'4px'}}>{ticket.event?.title ?? 'Event'}</div>
                <div style={{fontSize:'13px',color:'#665',fontFamily:'Syne,sans-serif'}}>{ticket.tier?.name ? toRomanTierName(ticket.tier.name) : ''} · {date}</div>
              </div>
            </div>
          </div>
        )}

        {phase === 'tear' && (
          <div style={{width:'320px',maxWidth:'calc(100vw - 40px)',position:'relative'}} onClick={e => e.stopPropagation()}>
            <div ref={topRef} className="tear-top" style={{ background:'linear-gradient(135deg,#1a0f00,#0d0800)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:'20px 20px 0 0',borderBottom:'2px dashed rgba(255,255,255,0.1)',padding:'28px 28px 20px',textAlign:'center' }}>
              <div style={{fontSize:'11px',letterSpacing:'3px',color:'#443',textTransform:'uppercase',marginBottom:'8px',fontFamily:'Syne,sans-serif'}}>Your ticket</div>
              <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:'28px',fontWeight:900,color:'#fff',textTransform:'uppercase'}}>{ticket.event?.title ?? 'Event'}</div>
            </div>
            <div ref={bottomRef} className="tear-bottom" style={{ background:'linear-gradient(135deg,#0d0800,#1a0f00)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:'0 0 20px 20px',borderTop:'2px dashed rgba(255,255,255,0.1)',padding:'20px 28px 28px',textAlign:'center' }}>
              <div style={{fontSize:'13px',color:'#665',fontFamily:'Syne,sans-serif'}}>{ticket.tier?.name ? toRomanTierName(ticket.tier.name) : ''} · {date}</div>
            </div>
          </div>
        )}

        {phase === 'open' && (
          <div className="reveal-in glow-ring" style={{ background:'linear-gradient(135deg,#1a0f00,#0d0800)',border:'1px solid rgba(255,170,51,0.35)',borderRadius:'24px',padding:'32px',width:'320px',maxWidth:'calc(100vw - 40px)',textAlign:'center',position:'relative',overflow:'hidden' }} onClick={e => e.stopPropagation()}>
            <div className="shimmer-line" style={{position:'absolute',top:0,left:0,right:0,height:'100%',pointerEvents:'none',zIndex:0}}/>
            <div style={{position:'relative',zIndex:1}}>
              <GLBadgeStamp delay={0.4}>
                <div style={{ display:'inline-block',background:ticket.is_guestlist ? 'linear-gradient(135deg,rgba(255,170,51,0.2),rgba(255,102,0,0.15))' : 'rgba(255,170,51,0.1)',border:'1px solid rgba(255,170,51,0.3)',borderRadius:'100px',padding:'6px 16px',marginBottom:'16px' }}>
                  <span style={{fontSize:'12px',color:'#ffaa33',letterSpacing:'1.5px',textTransform:'uppercase',fontFamily:'Syne,sans-serif',fontWeight:500}}>{ticket.is_guestlist ? 'Guest List · On the list' : "You're on the list"}</span>
                </div>
              </GLBadgeStamp>
              <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:'28px',fontWeight:900,color:'#fff',textTransform:'uppercase',marginBottom:'4px'}}>{ticket.event?.title ?? 'Event'}</div>
              <div style={{fontSize:'13px',color:'#665',fontFamily:'Syne,sans-serif',marginBottom:'4px'}}>{ticket.tier?.name ? toRomanTierName(ticket.tier.name) : ''} · {date}</div>
              <div style={{fontSize:'12px',color:'#554',fontFamily:'Syne,sans-serif',marginBottom:'24px'}}>{ticket.event?.venue_name ?? ''}</div>
              <div
                className="qr-reveal"
                style={{
                  background: '#fff',
                  borderRadius: '16px',
                  padding: '12px',
                  display: 'inline-block',
                  cursor: 'pointer',
                  transition: 'all 0.35s cubic-bezier(0.34,1.2,0.64,1)',
                  boxShadow: enlarged ? '0 0 60px rgba(255,170,51,0.6), 0 0 120px rgba(255,170,51,0.2)' : '0 0 30px rgba(255,170,51,0.15)',
                }}
                onClick={() => setEnlarged(e => !e)}
              >
                {dataUrl
                  ? <img src={dataUrl} alt="QR" style={{width: enlarged ? '240px' : '160px', height: enlarged ? '240px' : '160px', display:'block', transition:'all 0.35s cubic-bezier(0.34,1.2,0.64,1)'}}/>
                  : <div style={{width:'160px',height:'160px',display:'flex',alignItems:'center',justifyContent:'center',color:'#888',fontSize:'13px'}}>Generating...</div>
                }
              </div>
              <div style={{marginTop:'14px',fontSize:'11px',color:'#443',letterSpacing:'1.5px',textTransform:'uppercase',fontFamily:'Syne,sans-serif'}}>{enlarged ? 'Tap to shrink' : 'Show at the door · Tap to enlarge'}</div>
              <button onClick={onClose} style={{marginTop:'20px',background:'none',border:'0.5px solid rgba(255,255,255,0.1)',color:'#554',borderRadius:'100px',padding:'8px 24px',fontSize:'13px',cursor:'pointer',fontFamily:'Syne,sans-serif',display:'block',width:'100%',transition:'all 0.15s'}}>Close</button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Wallet Card ───────────────────────────────────────────────────────────────
function WalletCard({ ticket, onClick }: { ticket: any; onClick: () => void }) {
  const date = ticket.event?.starts_at
    ? new Date(ticket.event.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : 'TBD'
  const price = Number(ticket.tier?.price)
  const tierName = ticket.tier?.name ? toRomanTierName(ticket.tier.name) : 'Ticket'
  const cover = ticket.event?.cover_image_url

  return (
    <div
      className="wallet-card-wrap"
      style={{ cursor: 'pointer', borderRadius: '20px', overflow: 'hidden', height: '240px', position: 'relative' }}
      onClick={onClick}
    >
      {/* Background — cover image or dark gradient */}
      {cover ? (
        <>
          <img src={cover} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',zIndex:0}}/>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(0,0,0,0.93) 0%,rgba(0,0,0,0.3) 55%,rgba(0,0,0,0.1) 100%)',zIndex:1}}/>
        </>
      ) : (
        <div style={{position:'absolute',inset:0,background:'linear-gradient(135deg,#1a0f00,#0d0800)',zIndex:0}}/>
      )}

      {/* Border */}
      <div style={{
        position:'absolute',inset:0,borderRadius:'20px',zIndex:3,
        border: ticket.is_guestlist ? '1px solid rgba(255,170,51,0.45)' : '0.5px solid rgba(255,255,255,0.08)',
        boxShadow: ticket.is_guestlist ? '0 0 30px rgba(255,170,51,0.15), inset 0 0 30px rgba(255,170,51,0.04)' : '0 8px 40px rgba(0,0,0,0.6)',
        pointerEvents:'none',
      }}/>

      {/* Content */}
      <div style={{position:'relative',zIndex:2,height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'18px 20px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          {ticket.is_guestlist ? (
            <span style={{background:'linear-gradient(135deg,#ffaa33,#ff6600)',color:'#000',fontSize:'9px',fontWeight:900,letterSpacing:'1.5px',textTransform:'uppercase',padding:'4px 10px',borderRadius:'6px',fontFamily:'Barlow Condensed,sans-serif'}}>GL</span>
          ) : <span/>}
          <span style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',fontFamily:'Syne,sans-serif',letterSpacing:'0.5px'}}>Tap to scan</span>
        </div>
        <div>
          <div style={{fontFamily:'Barlow Condensed,sans-serif',fontSize:'clamp(32px,5vw,44px)',fontWeight:900,color:'#fff',textTransform:'uppercase',lineHeight:0.9,marginBottom:'10px',textShadow:'0 2px 20px rgba(0,0,0,0.8)'}}>{ticket.event?.title ?? 'Event'}</div>
          <div style={{display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap'}}>
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.55)',fontFamily:'Syne,sans-serif'}}>{date}</span>
            <span style={{color:'rgba(255,255,255,0.25)',fontSize:'10px'}}>·</span>
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.55)',fontFamily:'Syne,sans-serif'}}>{tierName}</span>
            {price > 0 && <>
              <span style={{color:'rgba(255,255,255,0.25)',fontSize:'10px'}}>·</span>
              <span style={{fontSize:'13px',color:'#ffaa33',fontFamily:'Barlow Condensed,sans-serif',fontWeight:700}}>${price}</span>
            </>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<any>(null)
  const logoRef = useNavLogo<HTMLButtonElement>()
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)
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

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? ''
  const initials = (user?.user_metadata?.full_name ?? user?.email ?? 'U')
    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <>
      <TouchBlot />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Syne:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:#000;font-family:'Syne',sans-serif;color:#f0f0f0;min-height:100vh;}

        /* Acid background — same as homepage */
        .acid{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;}
        .acid::before{content:'';position:absolute;width:70vmax;height:70vmax;border-radius:50%;background:radial-gradient(circle,rgba(255,102,0,0.18) 0%,rgba(232,0,29,0.08) 45%,transparent 70%);top:-20vmax;left:-20vmax;animation:orb1 18s ease-in-out infinite alternate;mix-blend-mode:screen;filter:blur(40px);}
        .acid::after{content:'';position:absolute;width:60vmax;height:60vmax;border-radius:50%;background:radial-gradient(circle,rgba(192,26,111,0.16) 0%,rgba(255,170,51,0.06) 50%,transparent 70%);bottom:-15vmax;right:-10vmax;animation:orb2 22s ease-in-out infinite alternate;mix-blend-mode:screen;filter:blur(50px);}
        .blob3{position:absolute;width:50vmax;height:50vmax;border-radius:50%;background:radial-gradient(circle,rgba(255,170,51,0.12) 0%,transparent 65%);bottom:10vmax;left:30%;animation:orb3 16s ease-in-out infinite alternate;mix-blend-mode:screen;filter:blur(45px);}
        @keyframes orb1{0%{transform:translate(0,0) scale(1)}100%{transform:translate(15vw,12vh) scale(1.15)}}
        @keyframes orb2{0%{transform:translate(0,0) scale(1.1)}100%{transform:translate(-12vw,-10vh) scale(0.9)}}
        @keyframes orb3{0%{transform:translate(0,0) scale(0.95)}100%{transform:translate(8vw,-8vh) scale(1.1)}}

        nav{padding:14px 32px;background:rgba(0,0,0,0.7);position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);border-bottom:0.5px solid rgba(255,255,255,0.05);}
        .logo{background:none;border:none;padding:0;cursor:pointer;line-height:0;display:inline-flex;}
        .logo-img{height:22px;width:auto;filter:drop-shadow(0 0 10px rgba(255,170,51,0.4));}
        @media(max-width:680px){.logo-img{height:20px;}}

        .nav-right{display:flex;align-items:center;gap:10px;}
        .nav-pill{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.1);borderRadius:100px;padding:6px 12px 6px 8px;cursor:pointer;transition:all 0.15s;}
        .nav-pill:hover{border-color:rgba(255,255,255,0.2);}
        .nav-av{width:26px;height:26px;border-radius:50%;background:rgba(255,170,51,0.2);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#ffaa33;letter-spacing:0.5px;flex-shrink:0;}
        .nav-name{font-size:12px;color:#ccc;font-family:'Syne',sans-serif;font-weight:500;}
        .nav-btn{font-size:13px;color:#665;background:none;border:none;cursor:pointer;font-family:'Syne',sans-serif;transition:color 0.15s;padding:6px 10px;}
        .nav-btn:hover{color:#f0f0f0;}
        .nav-btn.highlight{color:#ffaa33;background:rgba(255,170,51,0.1);border-radius:8px;}
        .signout-btn{font-size:12px;color:#443;background:none;border:0.5px solid rgba(255,255,255,0.08);border-radius:100px;padding:6px 14px;cursor:pointer;font-family:'Syne',sans-serif;transition:all 0.15s;}
        .signout-btn:hover{color:#f0f0f0;border-color:rgba(255,255,255,0.2);}

        .wrap{max-width:900px;margin:0 auto;padding:60px 32px 100px;position:relative;z-index:1;}
        @media(max-width:680px){.wrap{padding:40px 20px 80px;}}

        .section-header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:28px;}
        .section-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:3px;text-transform:uppercase;line-height:1;}
        .ticket-count{font-size:13px;color:#443;font-family:'Syne',sans-serif;}

        .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;}
        @media(max-width:420px){.grid{grid-template-columns:1fr;}}

        .empty{text-align:center;padding:80px 20px;}
        .empty-icon{font-size:48px;opacity:0.12;margin-bottom:16px;}
        .empty-title{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;text-transform:uppercase;color:#f0f0f0;margin-bottom:8px;}
        .empty-sub{font-size:14px;color:#443;margin-bottom:28px;}
        .empty-btn{background:#ffaa33;color:#000;border:none;border-radius:100px;padding:13px 28px;font-size:14px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;box-shadow:0 0 20px rgba(255,170,51,0.3);}

        .spinner{width:28px;height:28px;border:2px solid rgba(255,170,51,0.2);border-top-color:#ffaa33;border-radius:50%;animation:spin 0.8s linear infinite;margin:80px auto;}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* Acid background */}
      <div className="acid" aria-hidden="true"><div className="blob3"/></div>

      {selectedTicket && <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)}/>}

      <nav>
        <button ref={logoRef} className="logo" onClick={() => router.push('/')} aria-label="Pulse home">
          <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
        </button>
        <div className="nav-right">
          <button className="nav-btn" onClick={() => router.push('/discover')}>Discover</button>
          <button className="nav-btn" onClick={() => router.push('/connect')}>Connect</button>
          <button className="nav-btn highlight" onClick={() => router.push('/host')}>Dashboard</button>
          {user && (
            <div className="nav-pill" onClick={signOut} title="Sign out">
              <div className="nav-av">{initials}</div>
              <span className="nav-name">{firstName}</span>
            </div>
          )}
        </div>
      </nav>

      <div className="wrap">
        {loading ? (
          <div className="spinner"/>
        ) : (
          <>
            <div className="section-header">
              <div className="section-title">MY TICKETS</div>
              {tickets.length > 0 && <div className="ticket-count">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</div>}
            </div>

            {tickets.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🎟</div>
                <div className="empty-title">No tickets yet</div>
                <div className="empty-sub">Find an event and grab your spot</div>
                <button className="empty-btn" onClick={() => router.push('/')}>Browse events</button>
              </div>
            ) : (
              <div className="grid" ref={gridRef}>
                {tickets.map((ticket, i) => (
                  <WalletCard
                    key={ticket.id}
                    ticket={ticket}
                    onClick={() => setSelectedTicket(ticket)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}