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
          background:'#e8ff47', color:'#0a0a0b', fontSize:'13px', fontWeight:700,
          padding:'8px 18px', borderRadius:'100px', textDecoration:'none',
          fontFamily:'Nunito,sans-serif', letterSpacing:'0.3px',
          boxShadow:'0 0 16px rgba(232,255,71,0.35)',
          display:'inline-flex', alignItems:'center', gap:'6px'
        }}>✦ create event</a>
        <a href="/account" style={{
          background:'transparent', color:'#e8ff47', fontSize:'13px', fontWeight:600,
          padding:'8px 18px', borderRadius:'6px', border:'0.5px solid rgba(232,255,71,0.4)',
          textDecoration:'none', fontFamily:'Nunito,sans-serif',
          textShadow:'0 0 8px rgba(232,255,71,0.5)',
        }}>✦ {user.user_metadata?.full_name?.split(' ')[0] ?? user.email?.split('@')[0]}</a>
      </div>
    )
  }
  return <a href="/login" style={{background:'#e8ff47', color:'#0a0a0b', fontSize:'13px', fontWeight:700, padding:'8px 18px', borderRadius:'100px', textDecoration:'none', fontFamily:'Nunito,sans-serif'}}>Sign in</a>
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
          background:'#e8ff47', color:'#0a0a0b', fontSize:'12px', fontWeight:700,
          padding:'7px 14px', borderRadius:'100px', textDecoration:'none',
          fontFamily:'Nunito,sans-serif', boxShadow:'0 0 12px rgba(232,255,71,0.3)',
          display:'inline-flex', alignItems:'center', gap:'4px'
        }}>✦ create</a>
        <a href="/account" style={{
          background:'transparent', color:'#e8ff47', fontSize:'12px', fontWeight:600,
          padding:'7px 14px', borderRadius:'6px', border:'0.5px solid rgba(232,255,71,0.4)',
          textDecoration:'none', fontFamily:'Nunito,sans-serif',
          textShadow:'0 0 8px rgba(232,255,71,0.5)',
        }}>✦ {name}</a>
      </div>
    )
  }
  return <a href="/login" style={{background:'#e8ff47', color:'#0a0a0b', fontSize:'12px', fontWeight:700, padding:'7px 14px', borderRadius:'100px', textDecoration:'none', fontFamily:'Nunito,sans-serif'}}>Sign in</a>
}

const placeholderAccent: Record<string, string> = {
  nightlife: '#e8ff47', concert: '#6399dc', festival: '#ff4fd8', other: '#ff4fd8',
}

export default function Home() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [userCity, setUserCity] = useState<string | null>(null)
  const [heroVisible, setHeroVisible] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setTimeout(() => setHeroVisible(true), 100)
    const fetchEvents = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('events')
        .select('*, ticket_tiers(*)')
        .eq('status', 'published')
        .order('starts_at', { ascending: true })
      console.log('Events:', data, 'Error:', error)
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
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const particles = Array.from({length: 80}, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2, vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.2, a: Math.random() * 0.4 + 0.1,
    }))
    let animId: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width; if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height; if (p.y > canvas.height) p.y = 0
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(232,255,71,${p.a})`; ctx.fill()
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId) }
  }, [])

  useEffect(() => {
    if (!gridRef.current) return
    const cards = gridRef.current.querySelectorAll('.card')
    cards.forEach((card, index) => {
      setTimeout(() => (card as HTMLElement).classList.add('visible'), index * 100)
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
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        html, body { background:#0a0a0b; min-height:100vh; overflow-x:hidden; }
        .bg-canvas { position:fixed; inset:0; width:100vw; height:100vh; pointer-events:none; z-index:0; }
        .bg-rings { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:0; }
        .ring { position:absolute; border-radius:50%; border:1px solid rgba(232,255,71,0.06); animation:pulseRing 4s ease-in-out infinite; }
        @keyframes pulseRing { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.06);opacity:0.15} }
        .page { position:relative; z-index:1; }
        nav { border-bottom:none; padding:14px 0; background:rgba(10,10,11,0.8); position:sticky; top:0; z-index:100; backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); position:relative; }
        nav::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,#e8ff47,#ff4fd8,#6399dc,transparent); background-size:300% 100%; animation:navPulse 4s ease-in-out infinite; }
        @keyframes navPulse { 0%{background-position:0% 50%;opacity:0.3} 50%{background-position:100% 50%;opacity:0.7} 100%{background-position:0% 50%;opacity:0.3} }        .nav-inner { display:flex; align-items:center; justify-content:space-between; padding:0 20px; max-width:1100px; margin:0 auto; }
        .logo { font-family:'Nunito',sans-serif; font-size:28px; font-weight:900; letter-spacing:-0.5px; color:#e8ff47; cursor:pointer; line-height:1; text-transform:lowercase; filter:drop-shadow(0 0 8px rgba(232,255,71,0.3)); }
        .hero { padding:60px 20px 0; max-width:100%; margin:0 auto; }
        .hero-line { overflow:hidden; position:relative; z-index:1; line-height:1; }
        .hero-word { font-family:'Barlow Condensed',sans-serif; font-size:clamp(44px,12vw,130px); line-height:0.88; color:#f0f0f0; letter-spacing:1px; font-weight:900; text-transform:uppercase; display:block; transform:translateY(110%); transition:transform 0.8s cubic-bezier(0.16,1,0.3,1); }
        .hero-word.accent { color:#e8ff47; text-shadow:0 0 60px rgba(232,255,71,0.3); white-space:nowrap; }
        .hero-word.show { transform:translateY(0); }
        .hero-sub { margin-top:16px; font-size:14px; color:#555; font-weight:300; font-family:'DM Sans',sans-serif; line-height:1.6; opacity:0; transition:opacity 0.8s ease 0.6s; }
        .hero-sub.show { opacity:1; }
        .ticker-wrap { overflow:hidden; border-top:0.5px solid rgba(255,255,255,0.06); border-bottom:0.5px solid rgba(255,255,255,0.06); margin:28px 0 0; background:rgba(232,255,71,0.02); padding:10px 0; }
        .ticker-track { display:flex; width:max-content; animation:ticker 20s linear infinite; }
        .ticker-item { font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700; letter-spacing:2px; color:#e8ff47; opacity:0.5; white-space:nowrap; text-transform:uppercase; }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .filters { padding:16px 16px 10px; display:flex; gap:8px; flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; max-width:1100px; margin:0 auto; }
        .filters::-webkit-scrollbar { display:none; }
        .pill { background:rgba(255,255,255,0.05); border:0.5px solid rgba(255,255,255,0.1); border-radius:100px; padding:8px 16px; font-size:13px; color:#555; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.2s; white-space:nowrap; flex-shrink:0; }
        .pill:active { transform:scale(0.94); }
        .pill.active { background:#e8ff47; color:#0a0a0b; border-color:#e8ff47; font-weight:500; }
        .section-label { font-size:11px; color:#333; letter-spacing:1.5px; text-transform:uppercase; font-family:'DM Sans',sans-serif; padding:0 16px 10px; max-width:1100px; margin:0 auto; }
        .cards-wrap { padding:4px 12px 100px; max-width:1100px; margin:0 auto; }
        .grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; }
        @media(min-width:600px){ .grid { grid-template-columns:repeat(3, 1fr); gap:12px; } }
        @media(min-width:900px){ .grid { grid-template-columns:repeat(4, 1fr); gap:16px; } }
        .card { border-radius:14px; cursor:pointer; position:relative; overflow:hidden; opacity:0; transform:translateY(20px); transition:transform 0.25s ease, box-shadow 0.25s ease; aspect-ratio:2/3; background:#0d0a18; }
        .card.visible { opacity:1; transform:translateY(0); }
        .card:active { transform:scale(0.96) !important; }
        @media(hover:hover){ .card:hover { transform:translateY(-4px) !important; box-shadow:0 20px 60px rgba(0,0,0,0.5); } }
        .card-bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; transition:transform 0.5s ease; }
        .card-overlay { position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.15) 55%, transparent 100%); }
        .card-content { position:absolute; inset:0; padding:10px; display:flex; flex-direction:column; justify-content:space-between; }
        .card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:4px; }
        .card-tag { font-size:9px; font-weight:600; padding:3px 7px; border-radius:100px; letter-spacing:0.8px; text-transform:uppercase; font-family:'DM Sans',sans-serif; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
        .card-price-badge { font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900; color:#fff; background:rgba(0,0,0,0.5); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); padding:3px 7px; border-radius:100px; border:0.5px solid rgba(255,255,255,0.15); white-space:nowrap; }
        .card-price-badge.free { color:#e8ff47; border-color:rgba(232,255,71,0.4); }
        .card-date-small { font-size:9px; color:rgba(255,255,255,0.5); letter-spacing:0.6px; text-transform:uppercase; margin-bottom:3px; font-family:'DM Sans',sans-serif; }
        .card-title-big { font-family:'Barlow Condensed',sans-serif; font-size:clamp(16px,4vw,22px); font-weight:900; color:#fff; text-transform:uppercase; line-height:1; margin-bottom:4px; }
        .card-venue-small { font-size:10px; color:rgba(255,255,255,0.4); font-family:'DM Sans',sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .tag-nightlife { background:rgba(232,255,71,0.15); color:#e8ff47; border:0.5px solid rgba(232,255,71,0.3); }
        .tag-concert { background:rgba(99,153,220,0.15); color:#6399dc; border:0.5px solid rgba(99,153,220,0.3); }
        .tag-festival { background:rgba(255,79,216,0.15); color:#ff4fd8; border:0.5px solid rgba(255,79,216,0.3); }
        .tag-other { background:rgba(255,255,255,0.08); color:rgba(255,255,255,0.6); border:0.5px solid rgba(255,255,255,0.15); }
        .empty { text-align:center; padding:60px 20px; color:#444; font-size:15px; font-family:'DM Sans',sans-serif; line-height:1.6; }
        .empty a { color:#e8ff47; text-decoration:none; }
        .bottom { padding:12px 12px 20px; }
        .showing { font-size:11px; color:#2a2a2a; letter-spacing:0.5px; font-family:'DM Sans',sans-serif; }
        .nav-desktop { display:none; }
        .nav-mobile { display:flex; }
        @media(min-width:680px){ .nav-desktop { display:flex; } .nav-mobile { display:none !important; } }
      `}</style>

      <canvas ref={canvasRef} className="bg-canvas"/>
      <div className="bg-rings">
        <div className="ring" style={{width:'900px', height:'900px', animationDelay:'0s'}}/>
        <div className="ring" style={{width:'600px', height:'600px', animationDelay:'1.5s'}}/>
        <div className="ring" style={{width:'300px', height:'300px', animationDelay:'3s'}}/>
      </div>

      <div className="page">
        <nav>
          <div className="nav-inner">
            <div className="logo" onClick={() => window.location.href='/'}>pulse</div>
            <div className="nav-desktop"><AuthButton/></div>
            <div className="nav-mobile"><MobileNavBtn/></div>
          </div>
        </nav>

        <div className="hero">
          <div className="hero-line">
            <span className={`hero-word ${heroVisible ? 'show' : ''}`} style={{transitionDelay:'0ms'}}>Find</span>
          </div>
          <div className="hero-line" style={{overflow:'visible'}}>
            <span className={`hero-word accent ${heroVisible ? 'show' : ''}`} style={{transitionDelay:'120ms'}}>Your Pulse.</span>
          </div>
          <p className={`hero-sub ${heroVisible ? 'show' : ''}`}>
            Discover the best parties & shows near you. <a href="/host/create" style={{color:'#e8ff47', textDecoration:'none', fontWeight:500}}>Host your own →</a>
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
              { label: 'All', value: 'all' },
              { label: 'Nightlife', value: 'nightlife' },
              { label: 'Concerts', value: 'concert' },
              { label: 'Festivals', value: 'festival' },
              { label: '📍 Near me', value: 'nearme' },
            ].map(f => (
              <div
                key={f.value}
                className={`pill ${filter === f.value ? 'active' : ''}`}
                onClick={() => f.value === 'nearme' ? handleNearMe() : setFilter(f.value)}
              >
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
                  events.length === 0 ? <>No events yet. <a href="/host/create">Create the first →</a></> :
                  'No events in this category.'}
              </div>
            ) : (
              <div className="grid" ref={gridRef}>
                {filtered.map((event, index) => {
                  const cat = event.category ?? 'other'
                  const accent = placeholderAccent[cat] ?? '#e8ff47'
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
                              <stop offset="0%" stopColor={accent} stopOpacity="0.12"/>
                              <stop offset="100%" stopColor="#0a0a0b" stopOpacity="1"/>
                            </radialGradient>
                          </defs>
                          <rect width="200" height="300" fill="#0d0a18"/>
                          <rect width="200" height="300" fill={`url(#g_${index})`}/>
                          <g stroke={accent} strokeWidth="0.4" opacity="0.2">
                            {[0.6,0.7,0.8,0.9,1.0].map((y,i) => (
                              <line key={i} x1={100-(200*y)} y1={y*300} x2={100+(200*y)} y2={y*300}/>
                            ))}
                            {[-5,-3,-1,0,1,3,5].map((v,i) => (
                              <line key={i} x1="100" y1="140" x2={100+v*50} y2="300"/>
                            ))}
                          </g>
                          <ellipse cx="100" cy="140" rx="40" ry="12" fill={accent} opacity="0.06"/>
                          <text x="100" y="152" textAnchor="middle" fontSize="28" fill={accent} opacity="0.4" fontFamily="serif">✦</text>
                        </svg>
                      )}
                      <div className="card-overlay"/>
                      <div className="card-content">
                        <div className="card-top">
                          <div className={`card-tag tag-${cat}`}>{categoryLabels[cat] ?? 'Event'}</div>
                          <div className={`card-price-badge ${isFree ? 'free' : ''}`}>{price}</div>
                        </div>
                        <div className="card-bottom">
                          <div className="card-date-small">{date}</div>
                          <div className="card-title-big">{event.title}</div>
                          <div className="card-venue-small">📍 {event.venue_name ?? event.city ?? 'TBD'}</div>
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