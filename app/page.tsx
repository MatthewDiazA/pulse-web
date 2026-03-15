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
        <a href="/host/create" style={{background:'transparent', color:'#e8ff47', fontSize:'13px', fontWeight:500, padding:'8px 18px', borderRadius:'6px', border:'0.5px solid rgba(232,255,71,0.4)', textDecoration:'none', fontFamily:'DM Sans,sans-serif'}}>+ Create event</a>
        <a href="/account" style={{
          background:'transparent', color:'#e8ff47', fontSize:'13px', fontWeight:500,
          padding:'8px 18px', borderRadius:'6px', border:'0.5px solid rgba(232,255,71,0.4)',
          textDecoration:'none', fontFamily:'DM Sans,sans-serif',
          textShadow:'0 0 8px rgba(232,255,71,0.5), 0 0 16px rgba(232,255,71,0.25)',
          letterSpacing:'0.3px'
        }}>
          ✦ {user.user_metadata?.full_name?.split(' ')[0] ?? user.email?.split('@')[0]}
        </a>
      </div>
    )
  }

  return <a href="/login" style={{background:'#e8ff47', color:'#0a0a0b', fontSize:'13px', fontWeight:500, padding:'8px 18px', borderRadius:'6px', textDecoration:'none', fontFamily:'DM Sans,sans-serif'}}>Sign in</a>
}

export default function Home() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [userCity, setUserCity] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
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
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    const particles = Array.from({length: 100}, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      a: Math.random() * 0.5 + 0.15,
    }))
    let animId: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(232,255,71,${p.a})`
        ctx.fill()
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(animId) }
  }, [])

  const handleNearMe = () => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
          const data = await res.json()
          const city = data.address?.city ?? data.address?.town ?? data.address?.village ?? null
          setUserCity(city)
          setFilter('nearme')
        } catch { setFilter('nearme') }
      },
      () => alert('Please enable location access to use Near me')
    )
  }

  const filtered = (() => {
    if (filter === 'all') return events
    if (filter === 'nearme') {
      if (userCity) return events.filter(e => e.city?.toLowerCase().includes(userCity.toLowerCase()))
      return events
    }
    return events.filter(e => e.category === filter)
  })()

  const categoryColors: Record<string, string> = {
    nightlife: 'tag-nightlife', concert: 'tag-concert', festival: 'tag-festival', other: 'tag-other',
  }
  const categoryLabels: Record<string, string> = {
    nightlife: 'Nightlife', concert: 'Concert', festival: 'Festival', other: 'Event',
  }

  const getPrice = (event: any) => {
    const tiers = event.ticket_tiers ?? []
    if (tiers.length === 0) return 'Free'
    const prices = tiers.map((t: any) => t.price)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    if (min === 0) return 'Free'
    if (min === max) return `$${min}`
    return `$${min} – $${max}`
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@900&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        html, body { background:#0a0a0b; min-height:100vh; }
        .bg-canvas { position:fixed; inset:0; width:100vw; height:100vh; pointer-events:none; z-index:0; }
        .bg-rings { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:0; }
        .ring { position:absolute; border-radius:50%; border:1px solid rgba(232,255,71,0.07); animation:pulseRing 4s ease-in-out infinite; }
        @keyframes pulseRing { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.06);opacity:0.2} }
        .page { position:relative; z-index:1; }
        .wrap { max-width:1100px; margin:0 auto; padding:0 40px; }
        nav { border-bottom:0.5px solid rgba(255,255,255,0.08); padding:16px 0; background:rgba(10,10,11,0.7); position:sticky; top:0; z-index:100; backdrop-filter:blur(12px); }
        .nav-inner { display:flex; align-items:center; justify-content:space-between; }
        .logo { font-family:'Anton',sans-serif; font-size:42px; letter-spacing:1px; color:#e8ff47; cursor:pointer; line-height:1; text-transform:lowercase; }
        .nav-links { display:flex; gap:28px; align-items:center; }
        .hero { min-height:60vh; display:flex; align-items:center; padding:0 40px; max-width:1100px; margin:0 auto; }
        .hero h1 { font-family:'Barlow Condensed',sans-serif; font-size:clamp(64px,10vw,140px); line-height:0.9; color:#f0f0f0; letter-spacing:2px; font-weight:900; text-transform:uppercase; }
        .hero h1 span { color:#e8ff47; text-shadow:0 0 40px rgba(232,255,71,0.4); }
        .hero-sub { margin-top:16px; font-size:16px; color:#888; font-weight:300; font-family:'DM Sans',sans-serif; }
        .hero-scroll { margin-top:40px; font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:2px; text-transform:uppercase; font-family:'DM Sans',sans-serif; }
        .events-section { padding-top:0; }
        .filters { padding:24px 40px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; max-width:1100px; margin:0 auto; }
        .pill { background:rgba(255,255,255,0.06); border:0.5px solid rgba(255,255,255,0.14); border-radius:100px; padding:7px 16px; font-size:13px; color:#888; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; backdrop-filter:blur(8px); }
        .pill:hover { color:#f0f0f0; border-color:rgba(255,255,255,0.28); }
        .pill.active { background:#e8ff47; color:#0a0a0b; border-color:#e8ff47; font-weight:500; }
        .cards-wrap { padding:16px 40px 80px; max-width:1100px; margin:0 auto; }
        .grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:20px; }
        .card { background:rgba(14,14,18,0.85); backdrop-filter:blur(16px); border:0.5px solid rgba(255,255,255,0.1); border-radius:16px; cursor:pointer; transition:all 0.2s; position:relative; overflow:hidden; }
        .card:hover { border-color:rgba(232,255,71,0.3); transform:translateY(-4px); background:rgba(20,20,26,0.95); }
        .card-img { height:190px; overflow:hidden; position:relative; background:#0d0a1a; display:flex; align-items:center; justify-content:center; border-radius:16px 16px 0 0; }
        .card-img img { width:100%; height:100%; object-fit:cover; }
        .card-tag { position:absolute; top:12px; left:12px; font-size:11px; font-weight:500; padding:4px 10px; border-radius:100px; letter-spacing:0.5px; text-transform:uppercase; font-family:'DM Sans',sans-serif; }
        .tag-nightlife { background:rgba(232,255,71,0.18); color:#e8ff47; border:0.5px solid rgba(232,255,71,0.3); }
        .tag-concert { background:rgba(255,79,216,0.18); color:#ff4fd8; border:0.5px solid rgba(255,79,216,0.3); }
        .tag-festival { background:rgba(99,153,220,0.18); color:#6399dc; border:0.5px solid rgba(99,153,220,0.3); }
        .tag-other { background:rgba(255,255,255,0.1); color:#888; border:0.5px solid rgba(255,255,255,0.14); }
        .card-body { padding:18px 20px 20px; }
        .card-date { font-size:11px; color:#888; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:6px; font-family:'DM Sans',sans-serif; }
        .card-title { font-family:'Barlow Condensed',sans-serif; font-size:24px; letter-spacing:0.5px; line-height:1.15; color:#f0f0f0; margin-bottom:8px; font-weight:900; text-transform:uppercase; }
        .card-venue { font-size:13px; color:#888; margin-bottom:14px; font-family:'DM Sans',sans-serif; }
        .card-footer { display:flex; align-items:center; justify-content:space-between; border-top:0.5px solid rgba(255,255,255,0.08); padding-top:14px; }
        .price { font-family:'Barlow Condensed',sans-serif; font-size:22px; color:#e8ff47; font-weight:900; }
        .ticket-btn { background:#e8ff47; color:#0a0a0b; font-size:12px; font-weight:500; padding:7px 16px; border-radius:6px; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .ticket-btn:hover { opacity:0.88; }
        .empty { text-align:center; padding:80px 20px; color:#555; font-size:15px; font-family:'DM Sans',sans-serif; }
        .empty a { color:#e8ff47; text-decoration:none; }
        .bottom { padding:8px 0 40px; font-family:'DM Sans',sans-serif; }
        .showing { font-size:13px; color:#555; }
        .nav-mobile-btn { display:none !important; }
        @media(max-width:680px){
          .hero { padding:80px 40px 20px; max-width:1100px; margin:0 auto; }
          .filters { padding:12px 40px; display:flex; gap:10px; flex-wrap:wrap; align-items:center; max-width:1100px; margin:0 auto; }
          .cards-wrap { padding:16px 20px 60px; }
          .nav-links { display:none; }
          .nav-mobile-btn { display:flex !important; }
          .grid { grid-template-columns:1fr; }
        }
      `}</style>

      <canvas ref={canvasRef} className="bg-canvas"/>
      <div className="bg-rings">
        <div className="ring" style={{width:'900px', height:'900px', animationDelay:'0s'}}/>
        <div className="ring" style={{width:'650px', height:'650px', animationDelay:'1.3s'}}/>
        <div className="ring" style={{width:'400px', height:'400px', animationDelay:'2.6s'}}/>
      </div>

      <div className="page">
        <nav>
          <div className="wrap nav-inner">
            <div className="logo" onClick={() => window.location.href='/'}>pulse</div>
            <div className="nav-links">
              <AuthButton/>
            </div>
            <a href="/account" className="nav-mobile-btn" style={{background:'#e8ff47', color:'#0a0a0b', fontSize:'13px', fontWeight:500, padding:'8px 18px', borderRadius:'6px', textDecoration:'none'}}>Account</a>
          </div>
        </nav>

        <div className="hero">
          <div>
            <h1>Your city.<br/><span>Your night.</span></h1>
            <p className="hero-sub">Find tickets to the best parties, concerts & shows near you.</p>
            
          </div>
        </div>

        <div className="events-section">
          <div className="filters">
            {[
              { label: 'All events', value: 'all' },
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

          <div className="cards-wrap">
            {loading ? (
              <div className="empty">Loading events...</div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                {filter === 'nearme'
                  ? 'No events found near you yet.'
                  : events.length === 0
                  ? <>No events yet. <a href="/host/create">Create the first one →</a></>
                  : 'No events in this category yet.'
                }
              </div>
            ) : (
              <div className="grid">
                {filtered.map(event => {
                  const date = event.starts_at
                    ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }).toUpperCase()
                    : 'DATE TBD'
                  const time = event.starts_at
                    ? new Date(event.starts_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true })
                    : ''
                  return (
                    <div key={event.id} className="card" onClick={() => window.location.href=`/events/${event.id}`}>
                      <div className="card-img">
                        {event.cover_image_url
                          ? <img src={event.cover_image_url} alt={event.title}/>
                          : (
                            <svg width="100%" height="100%" viewBox="0 0 300 190" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                              <rect width="300" height="190" fill="#0d0a1a"/>
                              <circle cx="150" cy="95" r="60" fill="none" stroke="#e8ff47" strokeWidth="0.5" opacity="0.2"/>
                              <text x="150" y="105" textAnchor="middle" fontFamily="serif" fontSize="40" fill="#e8ff47" opacity="0.6">✦</text>
                            </svg>
                          )
                        }
                        <div className={`card-tag ${categoryColors[event.category] ?? 'tag-other'}`}>
                          {categoryLabels[event.category] ?? 'Event'}
                        </div>
                      </div>
                      <div className="card-body">
                        <div className="card-date">{date}{time ? ` · ${time}` : ''}</div>
                        <div className="card-title">{event.title}</div>
                        <div className="card-venue">📍 {event.venue_name ?? event.city ?? 'Venue TBD'}</div>
                        <div className="card-footer">
                          <div className="price">{getPrice(event)}</div>
                          <button className="ticket-btn" onClick={e => { e.stopPropagation(); window.location.href=`/events/${event.id}` }}>
                            Get tickets
                          </button>
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