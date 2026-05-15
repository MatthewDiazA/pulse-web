'use client'
import { useEffect, useState, useRef } from 'react'
import { createClient } from './lib/supabase/client'

function AuthButton() {
  const [user, setUser] = useState<any>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])
  if (user) {
    return (
      <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
        <a href="/host/create" style={{
          background:'#fff', color:'#000', fontSize:'13px', fontWeight:700,
          padding:'8px 18px', borderRadius:'100px', textDecoration:'none',
          fontFamily:'Nunito,sans-serif', letterSpacing:'0.3px',
          boxShadow:'0 0 20px rgba(136,204,255,0.4)',
          display:'inline-flex', alignItems:'center', gap:'6px'
        }}>
          <i className="ti ti-plus" style={{fontSize:'14px'}} aria-hidden="true"/>
          create event
        </a>
        <a href="/account" style={{
          background:'transparent', color:'#88ccff', fontSize:'13px', fontWeight:600,
          padding:'8px 18px', borderRadius:'6px', border:'0.5px solid rgba(136,204,255,0.3)',
          textDecoration:'none', fontFamily:'Nunito,sans-serif',
          display:'inline-flex', alignItems:'center', gap:'6px',
        }}>
          <i className="ti ti-user" style={{fontSize:'14px'}} aria-hidden="true"/>
          {user.user_metadata?.full_name?.split(' ')[0] ?? user.email?.split('@')[0]}
        </a>
      </div>
    )
  }
  return (
    <a href="/login" style={{
      background:'#fff', color:'#000', fontSize:'13px', fontWeight:700,
      padding:'8px 18px', borderRadius:'100px', textDecoration:'none',
      fontFamily:'Nunito,sans-serif', display:'inline-flex', alignItems:'center', gap:'6px'
    }}>
      <i className="ti ti-login" style={{fontSize:'14px'}} aria-hidden="true"/>
      Sign in
    </a>
  )
}

function MobileNavBtn() {
  const [user, setUser] = useState<any>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])
  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? null
  if (user) {
    return (
      <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
        <a href="/host/create" style={{
          background:'#fff', color:'#000', fontSize:'12px', fontWeight:700,
          padding:'7px 14px', borderRadius:'100px', textDecoration:'none',
          fontFamily:'Nunito,sans-serif', boxShadow:'0 0 14px rgba(136,204,255,0.3)',
          display:'inline-flex', alignItems:'center', gap:'4px'
        }}>
          <i className="ti ti-plus" style={{fontSize:'13px'}} aria-hidden="true"/>
          create
        </a>
        <a href="/account" style={{
          background:'transparent', color:'#88ccff', fontSize:'12px', fontWeight:600,
          padding:'7px 14px', borderRadius:'6px', border:'0.5px solid rgba(136,204,255,0.3)',
          textDecoration:'none', fontFamily:'Nunito,sans-serif',
          display:'inline-flex', alignItems:'center', gap:'4px',
        }}>
          <i className="ti ti-user" style={{fontSize:'13px'}} aria-hidden="true"/>
          {name}
        </a>
      </div>
    )
  }
  return (
    <a href="/login" style={{
      background:'#fff', color:'#000', fontSize:'12px', fontWeight:700,
      padding:'7px 14px', borderRadius:'100px', textDecoration:'none',
      fontFamily:'Nunito,sans-serif', display:'inline-flex', alignItems:'center', gap:'4px'
    }}>
      <i className="ti ti-login" style={{fontSize:'13px'}} aria-hidden="true"/>
      Sign in
    </a>
  )
}

const placeholderAccent: Record<string, string> = {
  nightlife: '#88ccff', concert: '#0044ff', festival: '#aaddff', other: '#4499ff',
}

export default function Home() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [userCity, setUserCity] = useState<string | null>(null)
  const [heroVisible, setHeroVisible] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 100)
    const fetchEvents = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('events')
        .select('*, ticket_tiers(*)')
        .eq('status', 'published')
        .order('starts_at', { ascending: true })
      setEvents(data ?? [])
      setLoading(false)
    }
    fetchEvents()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let t = 0

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const W = canvas.width, H = canvas.height
      const cx = W / 2, cy = H / 2

      ctx.fillStyle = 'rgba(0,0,0,0.09)'
      ctx.fillRect(0, 0, W, H)

      // outer spiral — hue locked 200-240 (ice blue to deep blue only)
      for (let i = 0; i < 90; i++) {
        const angle = (i / 90) * Math.PI * 2 + t * 0.32
        const spiral = 18 + Math.sin(t * 1.1 + i * 0.28) * 70 + i * 2.6
        const warpX = Math.sin(t * 0.55 + i * 0.13) * 1.2
        const warpY = Math.cos(t * 0.42 + i * 0.11) * 1.2
        const x = cx + spiral * Math.cos(angle + warpX)
        const y = cy + spiral * Math.sin(angle + warpY)
        const hue = 200 + ((i * 2.2 + t * 25) % 40)
        const lightness = 60 + Math.sin(t * 1.5 + i * 0.3) * 15
        const alpha = 0.45 + 0.45 * Math.sin(t * 2.2 + i * 0.2)
        const size = 1.6 + Math.sin(t * 1.5 + i) * 1.0
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue},90%,${lightness}%,${alpha})`
        ctx.fill()
      }

      // pulsing rings
      for (let i = 0; i < 7; i++) {
        const rad = 20 + i * 55 + Math.sin(t * 0.55 + i * 0.8) * 18
        const offX = Math.sin(t * 0.08 + i * 0.4) * 6
        const offY = Math.cos(t * 0.08 + i * 0.4) * 6
        const hue = 200 + ((i * 6 + t * 15) % 40)
        ctx.beginPath()
        ctx.arc(cx + offX, cy + offY, rad, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${hue},90%,65%,${0.07 + 0.05 * Math.sin(t * 0.9 + i)})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      // inner core swirl — slightly brighter, near white
      for (let i = 0; i < 30; i++) {
        const angle2 = (i / 30) * Math.PI * 2 + t * 0.7
        const r2 = 8 + Math.sin(t * 2 + i * 0.4) * 15
        const x2 = cx + r2 * Math.cos(angle2)
        const y2 = cy + r2 * Math.sin(angle2)
        const hue2 = 200 + ((i * 4 + t * 40) % 40)
        const light2 = 75 + Math.sin(t * 2 + i) * 15
        const alpha2 = 0.35 + 0.35 * Math.sin(t * 3 + i * 0.3)
        ctx.beginPath()
        ctx.arc(x2, y2, 1.2, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue2},80%,${light2}%,${alpha2})`
        ctx.fill()
      }

      t += 0.016
      animRef.current = requestAnimationFrame(draw)
    }

    draw()

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animRef.current)
      } else {
        draw()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', handleVisibility)
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  useEffect(() => {
    if (!gridRef.current) return
    const cards = gridRef.current.querySelectorAll('.card')
    cards.forEach((card, index) => {
      setTimeout(() => (card as HTMLElement).classList.add('visible'), index * 80)
    })
  }, [loading, filter])

  const handleNearMe = () => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
          const data = await res.json()
          setUserCity(data.address?.city ?? data.address?.town ?? null)
          setFilter('nearme')
        } catch { setFilter('nearme') }
      },
      () => alert('Please enable location access')
    )
  }

  const filtered = (() => {
    if (filter === 'all') return events
    if (filter === 'nearme') return userCity
      ? events.filter(e => e.city?.toLowerCase().includes(userCity.toLowerCase()))
      : events
    return events.filter(e => e.category === filter)
  })()

  const categoryLabels: Record<string, string> = {
    nightlife: 'Nightlife', concert: 'Concert', festival: 'Festival', other: 'Event',
  }

  const getPrice = (event: any) => {
    const tiers = event.ticket_tiers ?? []
    if (!tiers.length) return 'Free'
    const prices = tiers.map((t: any) => t.price)
    const min = Math.min(...prices), max = Math.max(...prices)
    if (min === 0) return 'Free'
    if (min === max) return `$${min}`
    return `$${min}+`
  }

  const tickerText = 'TONIGHT · YOUR CITY · FIND YOUR PULSE · LIVE EVENTS · HOUSTON · GET ON THE LIST · '

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        html, body { background:#000; min-height:100vh; overflow-x:hidden; }

        .page { position:relative; z-index:1; }

        nav { padding:14px 0; background:rgba(0,0,0,0.88); position:sticky; top:0; z-index:100; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); position:relative; }
        nav::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,#ffffff,#88ccff,#0044ff,#88ccff,transparent); background-size:300% 100%; animation:navPulse 5s ease-in-out infinite; }
        @keyframes navPulse { 0%{background-position:0% 50%;opacity:0.15} 50%{background-position:100% 50%;opacity:0.9} 100%{background-position:0% 50%;opacity:0.15} }
        .nav-inner { display:flex; align-items:center; justify-content:space-between; padding:0 20px; max-width:1100px; margin:0 auto; }
        .logo { font-family:'Nunito',sans-serif; font-size:28px; font-weight:900; letter-spacing:-0.5px; color:#fff; cursor:pointer; line-height:1; text-transform:lowercase; filter:drop-shadow(0 0 10px rgba(136,204,255,0.5)); }

        .hero-wrap { position:relative; overflow:hidden; min-height:460px; display:flex; flex-direction:column; justify-content:flex-end; padding-bottom:40px; }
        .hero-canvas { position:absolute; inset:0; width:100%; height:100%; }
        .hero-fade { position:absolute; bottom:0; left:0; right:0; height:160px; background:linear-gradient(to bottom,transparent,#000); pointer-events:none; z-index:1; }
        .hero { position:relative; z-index:2; padding:60px 20px 0; }
        .hero-line { overflow:hidden; line-height:1; }
        .hero-word { font-family:'Barlow Condensed',sans-serif; font-size:clamp(44px,12vw,130px); line-height:0.88; color:#f0f0f0; letter-spacing:1px; font-weight:900; text-transform:uppercase; display:block; transform:translateY(110%); transition:transform 0.8s cubic-bezier(0.16,1,0.3,1); }
        .hero-word.accent { color:#fff; text-shadow:0 0 60px rgba(136,204,255,0.6), 0 0 120px rgba(0,68,255,0.3); white-space:nowrap; }
        .hero-word.show { transform:translateY(0); }
        .hero-sub { position:relative; z-index:2; margin-top:16px; padding:0 20px; font-size:14px; color:#445; font-weight:300; font-family:'DM Sans',sans-serif; line-height:1.6; opacity:0; transition:opacity 0.8s ease 0.6s; }
        .hero-sub.show { opacity:1; }
        .hero-sub a { color:#88ccff; text-decoration:none; font-weight:500; display:inline-flex; align-items:center; gap:4px; }

        .ticker-wrap { overflow:hidden; border-top:0.5px solid rgba(255,255,255,0.04); border-bottom:0.5px solid rgba(255,255,255,0.04); background:rgba(136,204,255,0.015); padding:10px 0; }
        .ticker-track { display:flex; width:max-content; animation:ticker 22s linear infinite; }
        .ticker-item { font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700; letter-spacing:2px; color:#88ccff; opacity:0.3; white-space:nowrap; text-transform:uppercase; }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }

        .filters { padding:16px 16px 10px; display:flex; gap:8px; flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; max-width:1100px; margin:0 auto; }
        .filters::-webkit-scrollbar { display:none; }
        .pill { background:rgba(255,255,255,0.04); border:0.5px solid rgba(255,255,255,0.07); border-radius:100px; padding:8px 16px; font-size:13px; color:#445; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.2s; white-space:nowrap; flex-shrink:0; display:inline-flex; align-items:center; gap:6px; }
        .pill:active { transform:scale(0.94); }
        .pill.active { background:rgba(136,204,255,0.1); color:#88ccff; border-color:rgba(136,204,255,0.3); font-weight:500; }

        .section-label { font-size:11px; color:#1a1a1a; letter-spacing:1.5px; text-transform:uppercase; font-family:'DM Sans',sans-serif; padding:0 16px 10px; max-width:1100px; margin:0 auto; }
        .cards-wrap { padding:4px 12px 100px; max-width:1100px; margin:0 auto; }
        .grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; }
        @media(min-width:600px){ .grid { grid-template-columns:repeat(3, 1fr); gap:12px; } }
        @media(min-width:900px){ .grid { grid-template-columns:repeat(4, 1fr); gap:16px; } }

        .card { border-radius:14px; cursor:pointer; position:relative; overflow:hidden; opacity:0; transform:translateY(20px); transition:transform 0.25s ease, box-shadow 0.25s ease, opacity 0.4s ease; aspect-ratio:2/3; background:#04080f; }
        .card.visible { opacity:1; transform:translateY(0); }
        .card:active { transform:scale(0.96) !important; }
        @media(hover:hover){ .card:hover { transform:translateY(-4px) !important; box-shadow:0 20px 60px rgba(0,0,0,0.8), 0 0 24px rgba(136,204,255,0.07); } }
        .card-bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .card-overlay { position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.2) 55%, transparent 100%); }
        .card-content { position:absolute; inset:0; padding:10px; display:flex; flex-direction:column; justify-content:space-between; }
        .card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:4px; }
        .card-tag { font-size:9px; font-weight:600; padding:3px 7px; border-radius:100px; letter-spacing:0.8px; text-transform:uppercase; font-family:'DM Sans',sans-serif; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
        .card-price-badge { font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900; color:#fff; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); padding:3px 7px; border-radius:100px; border:0.5px solid rgba(255,255,255,0.1); white-space:nowrap; }
        .card-price-badge.free { color:#88ccff; border-color:rgba(136,204,255,0.35); }
        .card-date-small { font-size:9px; color:rgba(255,255,255,0.4); letter-spacing:0.6px; text-transform:uppercase; margin-bottom:3px; font-family:'DM Sans',sans-serif; display:flex; align-items:center; gap:3px; }
        .card-title-big { font-family:'Barlow Condensed',sans-serif; font-size:clamp(16px,4vw,22px); font-weight:900; color:#fff; text-transform:uppercase; line-height:1; margin-bottom:4px; }
        .card-venue-small { font-size:10px; color:rgba(255,255,255,0.35); font-family:'DM Sans',sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:3px; }

        .tag-nightlife { background:rgba(136,204,255,0.12); color:#88ccff; border:0.5px solid rgba(136,204,255,0.25); }
        .tag-concert { background:rgba(0,68,255,0.14); color:#4488ff; border:0.5px solid rgba(0,68,255,0.3); }
        .tag-festival { background:rgba(170,221,255,0.1); color:#aaddff; border:0.5px solid rgba(170,221,255,0.2); }
        .tag-other { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.45); border:0.5px solid rgba(255,255,255,0.1); }

        .empty { text-align:center; padding:60px 20px; color:#222; font-size:15px; font-family:'DM Sans',sans-serif; line-height:1.6; }
        .empty a { color:#88ccff; text-decoration:none; display:inline-flex; align-items:center; gap:4px; }
        .bottom { padding:12px 12px 20px; }
        .showing { font-size:11px; color:#1a1a1a; letter-spacing:0.5px; font-family:'DM Sans',sans-serif; }
        .nav-desktop { display:none; }
        .nav-mobile { display:flex; }
        @media(min-width:680px){ .nav-desktop { display:flex; } .nav-mobile { display:none !important; } }
      `}</style>

      <div className="page">
        <nav>
          <div className="nav-inner">
            <div className="logo" onClick={() => window.location.href='/'}>pulse</div>
            <div className="nav-desktop"><AuthButton/></div>
            <div className="nav-mobile"><MobileNavBtn/></div>
          </div>
        </nav>

        <div className="hero-wrap">
          <canvas ref={canvasRef} className="hero-canvas"/>
          <div className="hero-fade"/>
          <div className="hero">
            <div className="hero-line">
              <span className={`hero-word ${heroVisible ? 'show' : ''}`} style={{transitionDelay:'0ms'}}>Find</span>
            </div>
            <div className="hero-line" style={{overflow:'visible'}}>
              <span className={`hero-word accent ${heroVisible ? 'show' : ''}`} style={{transitionDelay:'120ms'}}>Your Pulse.</span>
            </div>
          </div>
          <p className={`hero-sub ${heroVisible ? 'show' : ''}`}>
            Discover the best parties &amp; shows near you.{' '}
            <a href="/host/create">
              Host your own
              <i className="ti ti-arrow-right" style={{fontSize:'14px'}} aria-hidden="true"/>
            </a>
          </p>
        </div>

        <div className="ticker-wrap">
          <div className="ticker-track">
            <span className="ticker-item">{tickerText.repeat(4)}</span>
            <span className="ticker-item">{tickerText.repeat(4)}</span>
          </div>
        </div>

        <div className="events-section">
          <div className="filters">
            {[
              { label: 'All', value: 'all', icon: 'ti-layout-grid' },
              { label: 'Nightlife', value: 'nightlife', icon: 'ti-moon' },
              { label: 'Concerts', value: 'concert', icon: 'ti-music' },
              { label: 'Festivals', value: 'festival', icon: 'ti-confetti' },
              { label: 'Near me', value: 'nearme', icon: 'ti-map-pin' },
            ].map(f => (
              <div
                key={f.value}
                className={`pill ${filter === f.value ? 'active' : ''}`}
                onClick={() => f.value === 'nearme' ? handleNearMe() : setFilter(f.value)}
              >
                <i className={`ti ${f.icon}`} style={{fontSize:'13px'}} aria-hidden="true"/>
                {f.label}
              </div>
            ))}
          </div>

          <div className="section-label">
            {filter === 'all' ? 'All events' : filter === 'nearme' ? 'Near you' : categoryLabels[filter]}
            {' '}— {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
          </div>

          <div className="cards-wrap">
            {loading ? (
              <div className="empty">Loading events...</div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                {filter === 'nearme' ? 'No events near you yet.' :
                  events.length === 0 ? (
                    <>No events yet. <a href="/host/create">Create the first <i className="ti ti-arrow-right" style={{fontSize:'13px'}} aria-hidden="true"/></a></>
                  ) : 'No events in this category.'}
              </div>
            ) : (
              <div className="grid" ref={gridRef}>
                {filtered.map((event, index) => {
                  const cat = event.category ?? 'other'
                  const accent = placeholderAccent[cat] ?? '#88ccff'
                  const date = event.starts_at
                    ? new Date(event.starts_at).toLocaleDateString('en-US', { month:'short', day:'numeric' }).toUpperCase()
                    : 'TBD'
                  const price = getPrice(event)
                  const isFree = price === 'Free'

                  return (
                    <div key={event.id} className="card" data-index={index} onClick={() => window.location.href=`/events/${event.id}`}>
                      {event.cover_image_url ? (
                        <img src={event.cover_image_url} className="card-bg" alt={event.title}/>
                      ) : (
                        <svg width="100%" height="100%" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" style={{position:'absolute',inset:0}}>
                          <defs>
                            <radialGradient id={`g_${index}`} cx="50%" cy="50%" r="80%">
                              <stop offset="0%" stopColor={accent} stopOpacity="0.18"/>
                              <stop offset="100%" stopColor="#000" stopOpacity="1"/>
                            </radialGradient>
                          </defs>
                          <rect width="200" height="300" fill="#04080f"/>
                          <rect width="200" height="300" fill={`url(#g_${index})`}/>
                          <g stroke={accent} strokeWidth="0.4" opacity="0.12">
                            {[0.6,0.7,0.8,0.9,1.0].map((y,i) => (
                              <line key={i} x1={100-(200*y)} y1={y*300} x2={100+(200*y)} y2={y*300}/>
                            ))}
                            {[-5,-3,-1,0,1,3,5].map((v,i) => (
                              <line key={i} x1="100" y1="140" x2={100+v*50} y2="300"/>
                            ))}
                          </g>
                          <circle cx="100" cy="140" r="28" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.25"/>
                          <circle cx="100" cy="140" r="14" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.4"/>
                          <circle cx="100" cy="140" r="4" fill={accent} opacity="0.3"/>
                        </svg>
                      )}
                      <div className="card-overlay"/>
                      <div className="card-content">
                        <div className="card-top">
                          <div className={`card-tag tag-${cat}`}>{categoryLabels[cat] ?? 'Event'}</div>
                          <div className={`card-price-badge ${isFree ? 'free' : ''}`}>{price}</div>
                        </div>
                        <div>
                          <div className="card-date-small">
                            <i className="ti ti-calendar-event" style={{fontSize:'9px'}} aria-hidden="true"/>
                            {date}
                          </div>
                          <div className="card-title-big">{event.title}</div>
                          <div className="card-venue-small">
                            <i className="ti ti-map-pin" style={{fontSize:'10px'}} aria-hidden="true"/>
                            {event.venue_name ?? event.city ?? 'TBD'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="bottom">
              <span className="showing">{filtered.length} event{filtered.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}