'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from '../lib/supabase/client'
import QRCode from 'qrcode'

import confetti from 'canvas-confetti'

function QRTicket({ code }: { code: string }) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(code, {
      width: 200, margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setDataUrl)
  }, [code])

  if (!dataUrl) return <div className="qr-box">🎫</div>

  return (
    <div style={{textAlign:'center'}}>
      <img src={dataUrl} alt="QR Code" style={{width:'52px', height:'52px', borderRadius:'6px'}}/>
      <div className="qr-label">Tap to scan</div>
    </div>
  )
}

function TicketModal({ ticket, onClose }: { ticket: any, onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState('')
  const [phase, setPhase] = useState<'entry' | 'tear' | 'open'>('entry')
  const [scale, setScale] = useState(1)
  const confettiRef = useRef<any>(null)


  const fireConfetti = () => {
  const colors = ['#e8ff47', '#ff4fd8', '#ffffff', '#6399dc']
  confetti({ particleCount: 100, spread: 90, origin: { y: 0.5 }, colors, startVelocity: 28, gravity: 0.35, ticks: 500 })
  setTimeout(() => confetti({ particleCount: 50, angle: 55, spread: 70, origin: { x: 0, y: 0.55 }, colors, startVelocity: 22, gravity: 0.3, ticks: 500 }), 120)
  setTimeout(() => confetti({ particleCount: 50, angle: 125, spread: 70, origin: { x: 1, y: 0.55 }, colors, startVelocity: 22, gravity: 0.3, ticks: 500 }), 120)
}

  useEffect(() => {
    QRCode.toDataURL(ticket.qr_code, {
      width: 400, margin: 2,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setDataUrl)

    const t1 = setTimeout(() => setPhase('tear'), 600)
    const t2 = setTimeout(() => fireConfetti(), 650)
    const t3 = setTimeout(() => setPhase('open'), 1800)

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [ticket.qr_code])

  const date = ticket.event?.starts_at
    ? new Date(ticket.event.starts_at).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })
    : 'Date TBD'

  return (
    <>
      <style>{`
        @keyframes backdropIn { from{opacity:0} to{opacity:1} }
        @keyframes slideUp {
          0%{transform:translateY(100px) scale(0.95);opacity:0}
          60%{transform:translateY(-8px) scale(1.01);opacity:1}
          100%{transform:translateY(0) scale(1);opacity:1}
        }
        @keyframes tearTop {
          0%{transform:translateY(0) rotate(0deg) skewX(0deg);opacity:1}
          20%{transform:translateY(-20px) rotate(-1deg) skewX(-1deg);opacity:1}
          50%{transform:translateY(-80px) rotate(-3deg) skewX(-2deg);opacity:1}
          80%{transform:translateY(-160px) rotate(-6deg) skewX(-3deg);opacity:0.5}
          100%{transform:translateY(-280px) rotate(-8deg) skewX(-4deg);opacity:0}
        }
        @keyframes tearBottom {
          0%{transform:translateY(0) rotate(0deg) skewX(0deg);opacity:1}
          20%{transform:translateY(20px) rotate(1deg) skewX(1deg);opacity:1}
          50%{transform:translateY(80px) rotate(3deg) skewX(2deg);opacity:1}
          80%{transform:translateY(160px) rotate(6deg) skewX(3deg);opacity:0.5}
          100%{transform:translateY(280px) rotate(8deg) skewX(4deg);opacity:0}
        }
        @keyframes revealIn {
          0%{transform:scale(0.7) translateY(30px) rotate(-2deg);opacity:0}
          50%{transform:scale(1.05) translateY(-8px) rotate(1deg);opacity:1}
          75%{transform:scale(0.98) translateY(2px) rotate(0deg)}
          100%{transform:scale(1) translateY(0) rotate(0deg);opacity:1}
        }
        @keyframes glowRing {
          0%,100%{box-shadow:0 0 0 0 rgba(232,255,71,0), 0 0 30px rgba(232,255,71,0.2)}
          50%{box-shadow:0 0 0 12px rgba(232,255,71,0), 0 0 60px rgba(232,255,71,0.5), 0 0 100px rgba(232,255,71,0.2)}
        }
        @keyframes qrReveal {
          0%{transform:scale(0.8) rotateX(20deg);opacity:0;filter:blur(4px)}
          100%{transform:scale(1) rotateX(0deg);opacity:1;filter:blur(0)}
        }
        @keyframes shimmer {
          0%{background-position:-200% 0}
          100%{background-position:200% 0}
        }
        @keyframes badgePop {
          0%{transform:scale(0) rotate(-10deg);opacity:0}
          60%{transform:scale(1.2) rotate(2deg);opacity:1}
          100%{transform:scale(1) rotate(0deg);opacity:1}
        }
        .slide-up { animation: slideUp 0.7s cubic-bezier(0.34,1.2,0.64,1) forwards; }
        .tear-top { animation: tearTop 1.1s cubic-bezier(0.4,0,0.8,0.2) forwards; }
        .tear-bottom { animation: tearBottom 1.1s cubic-bezier(0.4,0,0.8,0.2) forwards; }
        .reveal-in { animation: revealIn 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .glow-ring { animation: glowRing 2.5s ease-in-out infinite; }
        .qr-reveal { animation: qrReveal 0.6s cubic-bezier(0.34,1.2,0.64,1) 0.2s forwards; opacity:0; }
        .badge-pop { animation: badgePop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.4s forwards; opacity:0; }
        .shimmer-line {
          background: linear-gradient(90deg, transparent 0%, rgba(232,255,71,0.06) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 3s ease-in-out infinite;
        }
      `}</style>

      <div
        style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:1000,
          display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
          backdropFilter:'blur(16px)', animation:'backdropIn 0.3s ease forwards'
        }}
        onClick={onClose}
      >
        {phase === 'entry' && (
          <div className="slide-up" style={{width:'320px'}} onClick={e => e.stopPropagation()}>
            <div style={{
              background:'linear-gradient(135deg, #1a1a20 0%, #111116 100%)',
              border:'0.5px solid rgba(255,255,255,0.12)',
              borderRadius:'20px', overflow:'hidden',
              boxShadow:'0 40px 80px rgba(0,0,0,0.6)'
            }}>
              <div style={{height:'4px', background:'linear-gradient(90deg, #e8ff47, #ff4fd8, #e8ff47)', backgroundSize:'200% 100%', animation:'shimmer 1.5s ease infinite'}}/>
              <div style={{padding:'28px', textAlign:'center'}}>
                <div style={{fontSize:'11px', letterSpacing:'3px', color:'#555', textTransform:'uppercase', marginBottom:'12px', fontFamily:'DM Sans,sans-serif'}}>Your ticket</div>
                <div style={{fontFamily:'Barlow Condensed,sans-serif', fontSize:'32px', fontWeight:900, color:'#f0f0f0', textTransform:'uppercase', lineHeight:1, marginBottom:'8px'}}>{ticket.event?.title ?? 'Event'}</div>
                <div style={{fontSize:'13px', color:'#888', fontFamily:'DM Sans,sans-serif'}}>{ticket.tier?.name} · {date}</div>
                <div style={{marginTop:'20px', fontSize:'48px'}}>🎫</div>
              </div>
              <div style={{borderTop:'2px dashed rgba(255,255,255,0.1)', margin:'0 20px'}}/>
              <div style={{padding:'20px', textAlign:'center'}}>
                <div style={{fontSize:'12px', color:'#555', letterSpacing:'1px', textTransform:'uppercase', fontFamily:'DM Sans,sans-serif'}}>{ticket.event?.venue_name ?? 'Venue TBD'}</div>
              </div>
            </div>
          </div>
        )}

        {phase === 'tear' && (
          <div style={{width:'320px', position:'relative'}} onClick={e => e.stopPropagation()}>
            <div className="tear-top" style={{
              background:'linear-gradient(135deg, #1a1a20 0%, #111116 100%)',
              border:'0.5px solid rgba(255,255,255,0.12)',
              borderRadius:'20px 20px 0 0',
              borderBottom:'2px dashed rgba(255,255,255,0.15)',
              padding:'28px 28px 20px', textAlign:'center',
              boxShadow:'0 -20px 60px rgba(232,255,71,0.1)'
            }}>
              <div style={{height:'3px', background:'linear-gradient(90deg, #e8ff47, #ff4fd8)', borderRadius:'2px', marginBottom:'20px'}}/>
              <div style={{fontSize:'11px', letterSpacing:'3px', color:'#555', textTransform:'uppercase', marginBottom:'8px', fontFamily:'DM Sans,sans-serif'}}>Your ticket</div>
              <div style={{fontFamily:'Barlow Condensed,sans-serif', fontSize:'32px', fontWeight:900, color:'#f0f0f0', textTransform:'uppercase', lineHeight:1}}>{ticket.event?.title ?? 'Event'}</div>
            </div>
            <div className="tear-bottom" style={{
              background:'linear-gradient(135deg, #111116 0%, #1a1a20 100%)',
              border:'0.5px solid rgba(255,255,255,0.12)',
              borderRadius:'0 0 20px 20px',
              borderTop:'2px dashed rgba(255,255,255,0.15)',
              padding:'20px 28px 28px', textAlign:'center',
              boxShadow:'0 20px 60px rgba(255,79,216,0.1)'
            }}>
              <div style={{fontSize:'13px', color:'#888', fontFamily:'DM Sans,sans-serif', marginBottom:'12px'}}>{ticket.tier?.name} · {date}</div>
              <div style={{fontSize:'40px'}}>🎟</div>
            </div>
          </div>
        )}

        {phase === 'open' && (
          <div
            className="reveal-in glow-ring"
            style={{
              background:'linear-gradient(135deg, #1a1a22 0%, #111116 100%)',
              border:'1px solid rgba(232,255,71,0.35)',
              borderRadius:'24px', padding:'32px',
              maxWidth:'360px', width:'100%',
              textAlign:'center', position:'relative', overflow:'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="shimmer-line" style={{position:'absolute', top:0, left:0, right:0, height:'100%', pointerEvents:'none', borderRadius:'24px'}}/>
            <button onClick={onClose} style={{
              position:'absolute', top:'16px', right:'16px',
              background:'rgba(255,255,255,0.06)', border:'0.5px solid rgba(255,255,255,0.1)',
              color:'#555', width:'32px', height:'32px', borderRadius:'50%',
              cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center',
              justifyContent:'center', fontFamily:'DM Sans,sans-serif'
            }}>×</button>
            <div className="badge-pop" style={{
              display:'inline-block', background:'rgba(232,255,71,0.1)',
              border:'1px solid rgba(232,255,71,0.3)', borderRadius:'100px',
              padding:'6px 16px', marginBottom:'16px'
            }}>
              <span style={{fontSize:'12px', color:'#e8ff47', letterSpacing:'1.5px', textTransform:'uppercase', fontFamily:'DM Sans,sans-serif', fontWeight:500}}>✦ You're on the list</span>
            </div>
            <div style={{fontFamily:'Barlow Condensed,sans-serif', fontSize:'34px', fontWeight:900, color:'#f0f0f0', textTransform:'uppercase', lineHeight:1, marginBottom:'6px'}}>{ticket.event?.title ?? 'Event'}</div>
            <div style={{fontSize:'13px', color:'#888', marginBottom:'4px', fontFamily:'DM Sans,sans-serif'}}>{ticket.tier?.name} · {date}</div>
            <div style={{fontSize:'12px', color:'#444', marginBottom:'24px', fontFamily:'DM Sans,sans-serif'}}>{ticket.event?.venue_name ?? ''}</div>
            <div className="qr-reveal" style={{
              background:'#ffffff', borderRadius:'16px', padding:'16px',
              display:'inline-block', cursor:'pointer',
              transition:'transform 0.15s',
              transform:`scale(${scale})`,
              boxShadow:'0 0 40px rgba(232,255,71,0.15)'
            }}
              onTouchStart={() => setScale(1.08)}
              onTouchEnd={() => setScale(1)}
              onMouseDown={() => setScale(1.08)}
              onMouseUp={() => setScale(1)}
            >
              {dataUrl
                ? <img src={dataUrl} alt="QR Code" style={{width:'200px', height:'200px', display:'block'}}/>
                : <div style={{width:'200px', height:'200px', display:'flex', alignItems:'center', justifyContent:'center', color:'#888', fontSize:'13px', fontFamily:'DM Sans,sans-serif'}}>Generating...</div>
              }
            </div>
            <div style={{marginTop:'20px', fontSize:'11px', color:'#444', letterSpacing:'1.5px', textTransform:'uppercase', fontFamily:'DM Sans,sans-serif'}}>Show at the door · Tap to enlarge</div>
          </div>
        )}
      </div>
    </>
  )
}

export default function AccountPage() {
  const [user, setUser] = useState<any>(null)
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
      if (!user) { window.location.href = '/login'; return }
      setUser(user)
      const { data } = await supabase
        .from('tickets')
        .select('*, event:events(title, starts_at, venue_name, cover_image_url), tier:ticket_tiers(name, price)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setTickets(data ?? [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'
  const initials = (user?.user_metadata?.full_name ?? user?.email ?? 'U').slice(0,2).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@900&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#0a0a0b; font-family:'DM Sans',sans-serif; color:#f0f0f0; }
        .wrap { max-width:800px; margin:0 auto; padding:0 40px 80px; }
        nav { border-bottom:0.5px solid rgba(255,255,255,0.08); padding:16px 40px; background:#0a0a0b; position:sticky; top:0; z-index:100; display:flex; align-items:center; justify-content:space-between; }
        .logo { font-family:'Anton',sans-serif; font-size:42px; letter-spacing:1px; color:#e8ff47; cursor:pointer; line-height:1; text-transform:lowercase; }
        .nav-right { display:flex; gap:12px; align-items:center; }
        .nav-btn { font-size:13px; color:#888; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; text-decoration:none; }
        .nav-btn:hover { color:#f0f0f0; }
        .hero-section { padding:52px 0 40px; border-bottom:0.5px solid rgba(255,255,255,0.08); margin-bottom:40px; }
        .greeting { font-family:'Barlow Condensed',sans-serif; font-size:72px; line-height:0.95; font-weight:900; text-transform:uppercase; margin-bottom:8px; }
        .greeting span { color:#e8ff47; text-shadow:0 0 8px rgba(232,255,71,0.5), 0 0 16px rgba(232,255,71,0.25); }
        .greeting-sub { font-size:15px; color:#888; font-weight:300; }
        .quick-actions { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:40px; }
        .action-card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:12px; padding:20px 24px; cursor:pointer; transition:all 0.2s; text-decoration:none; display:block; }
        .action-card:hover { border-color:rgba(255,255,255,0.28); background:#1c1c21; transform:translateY(-2px); }
        .action-card.accent { border-color:rgba(232,255,71,0.3); background:rgba(232,255,71,0.05); }
        .action-card.accent:hover { background:rgba(232,255,71,0.1); }
        .action-icon { font-size:24px; margin-bottom:10px; }
        .action-title { font-size:15px; font-weight:500; color:#f0f0f0; margin-bottom:4px; }
        .action-sub { font-size:13px; color:#888; }
        .action-card.accent .action-title { color:#e8ff47; }
        .user-card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:12px; padding:20px 24px; margin-bottom:32px; display:flex; align-items:center; gap:16px; transition:border-color 0.2s; }
        .user-card:hover { border-color:rgba(255,255,255,0.28); }
        .user-avatar { width:56px; height:56px; border-radius:50%; background:rgba(232,255,71,0.15); border:1.5px solid rgba(232,255,71,0.4); display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:500; color:#e8ff47; flex-shrink:0; }
        .user-name { font-size:16px; font-weight:500; color:#f0f0f0; }
        .user-email { font-size:13px; color:#888; margin-top:2px; }
        .signout-btn { margin-left:auto; font-size:12px; color:#888; background:rgba(255,255,255,0.06); border:0.5px solid rgba(255,255,255,0.14); border-radius:6px; padding:7px 14px; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; }
        .signout-btn:hover { color:#e24b4a; border-color:rgba(226,75,74,0.3); }
        .section-title { font-size:11px; color:#888; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:16px; padding-bottom:8px; border-bottom:0.5px solid rgba(255,255,255,0.08); }
        .ticket-card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:12px; overflow:hidden; margin-bottom:12px; display:flex; transition:all 0.2s; cursor:pointer; }
        .ticket-card:hover { border-color:rgba(232,255,71,0.3); transform:translateY(-2px); box-shadow:0 8px 32px rgba(0,0,0,0.3); }
        .ticket-left { width:4px; background:linear-gradient(180deg, #e8ff47, #ff4fd8); flex-shrink:0; }
        .ticket-body { padding:20px 24px; flex:1; display:flex; align-items:center; gap:20px; }
        .ticket-info { flex:1; }
        .ticket-event { font-size:16px; font-weight:500; color:#f0f0f0; margin-bottom:4px; }
        .ticket-tier { font-size:13px; color:#888; margin-bottom:4px; }
        .ticket-date { font-size:12px; color:#555; }
        .qr-box { width:52px; height:52px; background:rgba(232,255,71,0.08); border:0.5px solid rgba(232,255,71,0.2); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:24px; }
        .qr-label { font-size:10px; color:#555; margin-top:4px; text-align:center; }
        .ticket-price { font-family:'Barlow Condensed',sans-serif; font-size:24px; color:#e8ff47; font-weight:900; text-align:right; min-width:60px; }
        .empty-state { text-align:center; padding:60px 20px; }
        .empty-icon { font-size:48px; margin-bottom:16px; }
        .empty-title { font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:900; color:#f0f0f0; margin-bottom:8px; }
        .empty-sub { font-size:14px; color:#555; margin-bottom:24px; }
        .empty-btn { background:#e8ff47; color:#0a0a0b; font-size:14px; font-weight:500; padding:12px 28px; border-radius:8px; text-decoration:none; display:inline-block; font-family:'DM Sans',sans-serif; transition:opacity 0.15s; }
        .empty-btn:hover { opacity:0.88; }
        .success-banner { background:rgba(232,255,71,0.08); border:0.5px solid rgba(232,255,71,0.3); border-radius:10px; padding:16px 20px; margin-bottom:32px; display:flex; align-items:center; gap:12px; animation:slideUp 0.5s cubic-bezier(0.34,1.2,0.64,1) forwards; }
        @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
        .success-text { font-size:14px; color:#e8ff47; font-weight:500; }
        .success-sub { font-size:12px; color:#888; margin-top:2px; }
        @media(max-width:680px){
          .wrap { padding:0 20px 60px; }
          .greeting { font-size:52px; }
          .quick-actions { grid-template-columns:1fr; }
          nav { padding:16px 20px; }
        }
      `}</style>

      {selectedTicket && (
        <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)}/>
      )}

      <nav>
        <div className="logo" onClick={() => window.location.href='/'}>pulse</div>
        <div className="nav-right">
          <a href="/" className="nav-btn">← Discover</a>
          <a href="/host" className="nav-btn" style={{background:'rgba(232,255,71,0.1)', color:'#e8ff47', padding:'7px 14px', borderRadius:'6px', border:'0.5px solid rgba(232,255,71,0.3)'}}>Host dashboard</a>
        </div>
      </nav>

      <div className="wrap">
        {orderSuccess && (
          <div className="success-banner" style={{marginTop:'32px'}}>
            <div style={{fontSize:'24px'}}>🎟</div>
            <div>
              <div className="success-text">Payment successful! You're on the list.</div>
              <div className="success-sub">Your tickets have been sent to your email.</div>
            </div>
          </div>
        )}

        <div className="hero-section">
          <h1 className="greeting">Hey, <span>{firstName}.</span></h1>
          <p className="greeting-sub">Welcome to your PULSE account — your tickets and events live here.</p>
        </div>

        <div className="quick-actions">
          <a href="/" className="action-card">
            <div className="action-icon">🎵</div>
            <div className="action-title">Find events</div>
            <div className="action-sub">Browse parties & concerts near you</div>
          </a>
          <a href="/host/create" className="action-card accent">
            <div className="action-icon">✦</div>
            <div className="action-title">Host an event</div>
            <div className="action-sub">Create and sell tickets in minutes</div>
          </a>
        </div>

        {user && (
          <div className="user-card">
            <div className="user-avatar">{initials}</div>
            <div>
              <div className="user-name">{user.user_metadata?.full_name ?? 'No name set'}</div>
              <div className="user-email">{user.email}</div>
            </div>
            <button className="signout-btn" onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              window.location.href = '/'
            }}>Sign out</button>
          </div>
        )}

        <div className="section-title">My tickets</div>

        {loading ? (
          <div style={{textAlign:'center', padding:'40px', color:'#555', fontSize:'14px'}}>Loading your tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎫</div>
            <div className="empty-title">No tickets yet</div>
            <div className="empty-sub">When you buy tickets they'll show up here</div>
            <a href="/" className="empty-btn">Browse events</a>
          </div>
        ) : (
          tickets.map(ticket => {
            const date = ticket.event?.starts_at
              ? new Date(ticket.event.starts_at).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })
              : 'Date TBD'
            return (
              <div key={ticket.id} className="ticket-card" onClick={() => setSelectedTicket(ticket)}>
                <div className="ticket-left"/>
                <div className="ticket-body">
                  <div className="ticket-info">
                    <div className="ticket-event">{ticket.event?.title ?? 'Event'}</div>
                    <div className="ticket-tier">{ticket.tier?.name ?? 'Ticket'}</div>
                    <div className="ticket-date">{date} · {ticket.event?.venue_name ?? ''}</div>
                  </div>
                  <QRTicket code={ticket.qr_code}/>
                  <div className="ticket-price">${ticket.tier?.price ?? 0}</div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}