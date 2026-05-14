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
          background:'#00ffaa', color:'#000', fontSize:'13px', fontWeight:700,
          padding:'8px 18px', borderRadius:'100px', textDecoration:'none',
          fontFamily:'Nunito,sans-serif', letterSpacing:'0.3px',
          boxShadow:'0 0 16px rgba(0,255,170,0.25)',
          display:'inline-flex', alignItems:'center', gap:'6px'
        }}>
          <i className="ti ti-plus" style={{fontSize:'14px'}} aria-hidden="true"/>
          create event
        </a>
        <a href="/account" style={{
          background:'transparent', color:'#00ffaa', fontSize:'13px', fontWeight:600,
          padding:'8px 18px', borderRadius:'6px', border:'0.5px solid rgba(0,255,170,0.35)',
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
      background:'#00ffaa', color:'#000', fontSize:'13px', fontWeight:700,
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
          background:'#00ffaa', color:'#000', fontSize:'12px', fontWeight:700,
          padding:'7px 14px', borderRadius:'100px', textDecoration:'none',
          fontFamily:'Nunito,sans-serif', boxShadow:'0 0 12px rgba(0,255,170,0.2)',
          display:'inline-flex', alignItems:'center', gap:'4px'
        }}>
          <i className="ti ti-plus" style={{fontSize:'13px'}} aria-hidden="true"/>
          create
        </a>
        <a href="/account" style={{
          background:'transparent', color:'#00ffaa', fontSize:'12px', fontWeight:600,
          padding:'7px 14px', borderRadius:'6px', border:'0.5px solid rgba(0,255,170,0.35)',
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
      background:'#00ffaa', color:'#000', fontSize:'12px', fontWeight:700,
      padding:'7px 14px', borderRadius:'100px', textDecoration:'none',
      fontFamily:'Nunito,sans-serif', display:'inline-flex', alignItems:'center', gap:'4px'
    }}>
      <i className="ti ti-login" style={{fontSize:'13px'}} aria-hidden="true"/>
      Sign in
    </a>
  )
}

const placeholderAccent: Record<string, string> = {
  nightlife: '#00ffaa', concert: '#00cfff', festival: '#7fff00', other: '#00cc88',
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
      const W = canvas.width
      const H = canvas.height
      const cx = W / 2
      const cy = H / 2

      ctx.fillStyle = 'rgba(3,5,5,0.08)'
      ctx.fillRect(0, 0, W, H)

      for (let i = 0; i < 80; i++) {
        const angle = (i / 80) * Math.PI * 2 + t * 0.3
        const r = 60 + Math.sin(t * 1.2 + i * 0.3) * 80 + i * 2.8
        const x = cx + r * Math.cos(angle + Math.sin(t * 0.5 + i * 0.1) * 0.8)
        const y = cy + r * Math.sin(angle + Math.cos(t * 0.4 + i * 0.1) * 0.8)
        const hue = (160 + i * 3 + t * 30) % 360
        const a = 0.5 + 0.4 * Math.sin(t * 2 + i * 0.2)
        ctx.beginPath()
        ctx.arc(x, y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue},90%,55%,${a})`
        ctx.fill()
      }

      for (let i = 0; i < 6; i++) {
        const radius = 40 + i * 60 + Math.sin(t * 0.6 + i) * 20
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(0,255,170,${0.05 + 0.04 * Math.sin(t + i)})`
        ctx.lineWidth = 0.8
        ctx.stroke()
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
    if (filter === 'nearme') return userCity ? events.filter(e => e.city?.toLowerCase().includes(userCity.toLowerCase())) : events
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
        html, body { background:#030505; min-height:100vh; overflow-x:hidden; }

        .page { position:relative; z-index:1; }

        nav { padding:14px 0; background:rgba(3,5,5,0.85); position:sticky; top:0; z-index:100; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); position:relative; }
        nav::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,#00ffaa,#00cfff,#7fff00,transparent); background-size:300% 100%; animation:navPulse 5s ease-in-out infinite; }
        @keyframes navPulse { 0%{background-position:0% 50%;opacity:0.2} 50%{background-position:100% 50%;opacity:0.8} 100%{background-position:0% 50%;opacity:0.2} }
        .nav-inner { display:flex; align-items:center; justify-content:space-between; padding:0 20px; max-width:1100px; margin:0 auto; }
        .logo { font-family:'Nunito',sans-serif; font-size:28px; font-weight:900; letter-spacing:-0.5px; color:#00ffaa; cursor:pointer; line-height:1; text-transform:lowercase; filter:drop-shadow(0 0 10px rgba(0,255,170,0.4)); }

        .hero-wrap { position:relative; overflow:hidden; min-height:420px; display:flex; flex-direction:column; justify-content:flex-end; padding-bottom:40px; }
        .hero-canvas { position:absolute; inset:0; width:100%; height:100%; }
        .hero-fade { position:absolute; bottom:0; left:0; right:0; height:140px; background:linear-gradient(to bottom, transparent, #030505); pointer-events:none; }
        .hero { position:relative; z-index:2; padding:60px 20px 0; }
        .hero-line { overflow:hidden; line-height:1; }
        .hero-word { font-family:'Barlow Condensed',sans-serif; font-size:clamp(44px,12vw,130px); line-height:0.88; color:#f0f0f0; letter-spacing:1px; font-weight:900; text-transform:uppercase; display:block; transform:translateY(110%); transition:transform 0.8s cubic-bezier(0.16,1,0.3,1); }
        .hero-word.accent { color:#00ffaa; text-shadow:0 0 60px rgba(0,255,170,0.4); white-space:nowrap; }
        .hero-word.show { transform:translateY(0); }
        .hero-sub { position:relative; z-index:2; margin-top:16px; padding:0 20px; font-size:14px; color:#556; font-weight:300; font-family:'DM Sans',sans-serif; line-height:1.6; opacity:0; transition:opacity 0.8s ease 0.6s; }
        .hero-sub.show { opacity:1; }
        .hero-sub a { color:#00ffaa; text-decoration:none; font-weight:500; display:inline-flex; align-items:center; gap:4px; }

        .ticker-wrap { overflow:hidden; border-top:0.5px solid rgba(255,255,255,0.05); border-bottom:0.5px solid rgba(255,255,255,0.05); background:rgba(0,255,170,0.02); padding:10px 0; }
        .ticker-track { display:flex; width:max-content; animation:ticker 22s linear infinite; }
        .ticker-item { font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700; letter-spacing:2px; color:#00ffaa; opacity:0.4; white-space:nowrap; text-transform:uppercase; }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }

        .filters { padding:16px 16px 10px; display:flex; gap:8px; flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; max-width:1100px; margin:0 auto; }
        .filters::-webkit-scrollbar { display:none; }
        .pill { background:rgba(255,255,255,0.04); border:0.5px solid rgba(255,255,255,0.08); border-radius:100px; padding:8px 16px; font-size:13px; color:#445; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.2s; white-space:nowrap; flex-shrink:0; display:inline-flex; align-items:center; gap:6px; }
        .pill:active { transform:scale(0.94); }
        .pill.active { background:rgba(0,255,170,0.1); color:#00ffaa; border-color:rgba(0,255,170,0.3); font-weight:500; }

        .section-label { font-size:11px; color:#2a2a2a; letter-spacing:1.5px; text-transform:uppercase; font-family:'DM Sans',sans-serif; padding:0 16px 10px; max-width:1100px; margin:0 auto; }
        .cards-wrap { padding:4px 12px 100px; max-width:1100px; margin:0 auto; }
        .grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; }
        @media(min-width:600px){ .grid { grid-template-columns:repeat(3, 1fr); gap:12px; } }
        @media(min-width:900px){ .grid { grid-template-columns:repeat(4, 1fr); gap:16px; } }

        .card { border-radius:14px; cursor:pointer; position:relative; overflow:hidden; opacity:0; transform:translateY(20px); transition:transform 0.25s ease, box-shadow 0.25s ease, opacity 0.4s ease; aspect-ratio:2/3; background:#080f0d; }
        .card.visible { opacity:1; transform:translateY(0); }
        .card:active { transform:scale(0.96) !important; }
        @media(hover:hover){ .card:hover { transform:translateY(-4px) !important; box-shadow:0 20px 60px rgba(0,0,0,0.6), 0 0 20px rgba(0,255,170,0.05); } }
        .card-bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .card-overlay { position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.2) 55%, transparent 100%); }
        .card-content { position:absolute; inset:0; padding:10px; display:flex; flex-direction:column; justify-content:space-between; }
        .card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:4px; }
        .card-tag { font-size:9px; font-weight:600; padding:3px 7px; border-radius:100px; letter-spacing:0.8px; text-transform:uppercase; font-family:'DM Sans',sans-serif; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
        .card-price-badge { font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900; color:#fff; background:rgba(0,0,0,0.55); backdrop-filter:blur(8px); padding:3px 7px; border-radius:100px; border:0.5px solid rgba(255,255,255,0.12); white-space:nowrap; }
        .card-price-badge.free { color:#00ffaa; border-color:rgba(0,255,170,0.35); }
        .card-date-small { font-size:9px; color:rgba(255,255,255,0.4); letter-spacing:0.6px; text-transform:uppercase; margin-bottom:3px; font-family:'DM Sans',sans-serif; display:flex; align-items:center; gap:3px; }
        .card-title-big { font-family:'Barlow Condensed',sans-serif; font-size:clamp(16px,4vw,22px); font-weight:900; color:#fff; text-transform:uppercase; line-height:1; margin-bottom:4px; }
        .card-venue-small { font-size:10px; color:rgba(255,255,255,0.35); font-family:'DM Sans',sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:3px; }

        .tag-nightlife { background:rgba(0,255,170,0.12); color:#00ffaa; border:0.5px solid rgba(0,255,170,0.25); }
        .tag-concert { background:rgba(0,207,255,0.12); color:#00cfff; border:0.5px solid rgba(0,207,255,0.25); }
        .tag-festival { background:rgba(127,255,0,0.12); color:#7fff00; border:0.5px solid rgba(127,255,0,0.25); }
        .tag-other { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.5); border:0.5px solid rgba(255,255,255,0.12); }

        .empty { text-align:center; padding:60px 20px; color:#333; font-size:15px; font-family:'DM Sans',sans-serif; line-height:1.6; }
        .empty a { color:#00ffaa; text-decoration:none; display:inline-flex; align-items:center; gap:4px; }
        .bottom { padding:12px 12px 20px; }
        .showing { font-size:11px; color:#222; letter-spacing:0.5px; font-family:'DM Sans',sans-serif; }
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
                  const accent = placeholderAccent[cat] ?? '#00ffaa'
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
                              <stop offset="0%" stopColor={accent} stopOpacity="0.15"/>
                              <stop offset="100%" stopColor="#030505" stopOpacity="1"/>
                            </radialGradient>
                          </defs>
                          <rect width="200" height="300" fill="#080f0d"/>
                          <rect width="200" height="300" fill={`url(#g_${index})`}/>
                          <g stroke={accent} strokeWidth="0.4" opacity="0.15">
                            {[0.6,0.7,0.8,0.9,1.0].map((y,i) => (
                              <line key={i} x1={100-(200*y)} y1={y*300} x2={100+(200*y)} y2={y*300}/>
                            ))}
                            {[-5,-3,-1,0,1,3,5].map((v,i) => (
                              <line key={i} x1="100" y1="140" x2={100+v*50} y2="300"/>
                            ))}
                          </g>
                          <ellipse cx="100" cy="140" rx="40" ry="12" fill={accent} opacity="0.05"/>
                          <circle cx="100" cy="140" r="18" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.3"/>
                          <circle cx="100" cy="140" r="8" fill="none" stroke={accent} strokeWidth="0.5" opacity="0.5"/>
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