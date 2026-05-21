'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from './lib/supabase/client'

type Tier = { id: string; price: number; quantity: number; name: string }
type Event = {
  id: string
  title: string
  category: 'nightlife' | 'concert' | 'festival' | 'other'
  starts_at: string | null
  venue_name: string | null
  city: string | null
  cover_image_url: string | null
  ticket_tiers: Tier[]
}
type SupabaseUser = { id: string; email?: string; user_metadata?: { full_name?: string } }

const COLORS = {
  primary: '#ffaa33',
  accent: '#ff6600',
  highlight: '#ffc850',
  bg: '#000',
  cardBg: '#0d0800',
} as const

const CATEGORY_LABEL: Record<Event['category'], string> = {
  nightlife: 'Nightlife',
  concert: 'Concert',
  festival: 'Festival',
  other: 'Event',
}

const CATEGORY_ACCENT: Record<Event['category'], string> = {
  nightlife: COLORS.primary,
  concert: COLORS.accent,
  festival: COLORS.highlight,
  other: '#ff8800',
}

function useUser() {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user as SupabaseUser | null))
  }, [])
  return user
}

function displayName(u: SupabaseUser | null): string | null {
  if (!u) return null
  return u.user_metadata?.full_name?.split(' ')[0] ?? u.email?.split('@')[0] ?? null
}

function NavActions({ compact = false }: { compact?: boolean }) {
  const user = useUser()
  const router = useRouter()
  const name = displayName(user)
  const size = compact ? 12 : 13
  const pad = compact ? '7px 14px' : '8px 18px'
  const icon = compact ? 13 : 14
  const gap = compact ? 4 : 6

  if (user) {
    return (
      <div style={{display:'flex', gap:'8px', alignItems:'center'}}>
        <a
          href="/host/create"
          onClick={e => { e.preventDefault(); router.push('/host/create') }}
          style={{
            background: COLORS.primary,
            color: '#000',
            fontSize: size,
            fontWeight: 700,
            padding: pad,
            borderRadius: '100px',
            textDecoration: 'none',
            fontFamily: 'Nunito,sans-serif',
            letterSpacing: '0.3px',
            boxShadow: `0 0 ${compact ? 14 : 18}px rgba(255,170,51,0.32)`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: `${gap}px`,
          }}
        >
          <i className="ti ti-plus" style={{fontSize:`${icon}px`}} aria-hidden="true"/>
          {compact ? 'create' : 'create event'}
        </a>
        <a
          href="/account"
          onClick={e => { e.preventDefault(); router.push('/account') }}
          aria-label={`Account: ${name ?? 'user'}`}
          style={{
            background: 'transparent',
            color: COLORS.primary,
            fontSize: size,
            fontWeight: 600,
            padding: pad,
            borderRadius: '6px',
            border: `0.5px solid rgba(255,170,51,0.3)`,
            textDecoration: 'none',
            fontFamily: 'Nunito,sans-serif',
            display: 'inline-flex',
            alignItems: 'center',
            gap: `${gap}px`,
          }}
        >
          {name}
        </a>
      </div>
    )
  }
  return (
    <a
      href="/login"
      onClick={e => { e.preventDefault(); router.push('/login') }}
      style={{
        background: COLORS.primary,
        color: '#000',
        fontSize: size,
        fontWeight: 700,
        padding: pad,
        borderRadius: '100px',
        textDecoration: 'none',
        fontFamily: 'Nunito,sans-serif',
        display: 'inline-flex',
        alignItems: 'center',
        gap: `${gap}px`,
      }}
    >
      <i className="ti ti-login" style={{fontSize:`${icon}px`}} aria-hidden="true"/>
      Sign in
    </a>
  )
}

function useHeroAnimation(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    let t = 0
    let W = 0
    let H = 0

    const resize = () => {
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const drawFrame = () => {
      const cx = W / 2

      ctx.fillStyle = 'rgba(0,0,0,0.14)'
      ctx.fillRect(0, 0, W, H)

      const numRays = 10
      for (let i = 0; i < numRays; i++) {
        const baseAngle = -Math.PI * 0.85 + (i / (numRays - 1)) * Math.PI * 0.7
        const sway = Math.sin(t * 0.5 + i * 0.7) * 0.06
        const angle = baseAngle + sway
        const len = H * 1.2
        const ex = cx + Math.cos(angle) * len
        const ey = Math.sin(angle) * len
        const rayAlpha = 0.025 + 0.02 * Math.sin(t * 0.8 + i * 0.9)
        const grad = ctx.createLinearGradient(cx, 0, ex, ey)
        grad.addColorStop(0, `rgba(255,160,40,${rayAlpha * 4})`)
        grad.addColorStop(0.35, `rgba(255,120,20,${rayAlpha})`)
        grad.addColorStop(1, 'rgba(255,80,0,0)')
        ctx.beginPath()
        ctx.moveTo(cx - 20, 0)
        ctx.lineTo(cx + 20, 0)
        ctx.lineTo(ex + 50, ey)
        ctx.lineTo(ex - 50, ey)
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()
      }

      const isMobile = W < 600
      // Even square-ish grid: derive spacing from width, match vertical to it
      const targetSpacing = isMobile ? 40 : 64
      const cols = Math.max(8, Math.round(W / targetSpacing))
      const spacingX = W / (cols + 1)
      const spacingY = spacingX
      const rows = Math.max(5, Math.floor((H * 0.6) / spacingY))
      const startY = 18

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = spacingX * (c + 1)
          const by = startY + spacingY * (r + 1)
          const wave = Math.sin(t * 1.2 + c * 0.45 + r * 0.65) * 0.5 + 0.5
          const pulse = Math.sin(t * 2.2 + (c + r) * 0.28) * 0.3 + 0.7
          const intensity = wave * pulse
          const hue = 28 + Math.sin(t * 0.35 + c * 0.12) * 14
          const sat = 90 + intensity * 10
          const light = 35 + intensity * 38
          const alpha = 0.12 + intensity * 0.7

          // Scale dot size to grid spacing so dots stay proportionally large
          const unit = spacingX / 26

          ctx.fillStyle = `hsla(${hue},${sat}%,${light}%,${alpha * 0.25})`
          ctx.beginPath()
          ctx.arc(bx, by, unit * (5 + intensity * 9), 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = `hsla(${hue},${sat}%,${light + 10}%,${alpha * 0.5})`
          ctx.beginPath()
          ctx.arc(bx, by, unit * (3 + intensity * 4), 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = `hsla(${hue},${sat}%,${light + 25}%,${alpha})`
          ctx.beginPath()
          ctx.arc(bx, by, unit * 2.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      const fog = ctx.createRadialGradient(cx, H * 0.52, 0, cx, H * 0.52, W * 0.45)
      fog.addColorStop(0, `rgba(255,120,20,${0.045 + 0.03 * Math.sin(t * 0.7)})`)
      fog.addColorStop(0.5, `rgba(255,80,0,${0.02 + 0.01 * Math.sin(t * 0.5)})`)
      fog.addColorStop(1, 'rgba(255,60,0,0)')
      ctx.fillStyle = fog
      ctx.fillRect(0, 0, W, H)

      const crowd = ctx.createLinearGradient(0, H * 0.7, 0, H)
      crowd.addColorStop(0, 'rgba(0,0,0,0)')
      crowd.addColorStop(1, `rgba(255,80,10,${0.04 + 0.02 * Math.sin(t * 0.3)})`)
      ctx.fillStyle = crowd
      ctx.fillRect(0, H * 0.7, W, H * 0.3)
    }

    const loop = () => {
      t += 0.016
      drawFrame()
      raf = requestAnimationFrame(loop)
    }

    if (prefersReduced) {
      drawFrame()
    } else {
      loop()
    }

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(raf)
      else if (!prefersReduced) loop()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      cancelAnimationFrame(raf)
    }
  }, [canvasRef])
}

function CardPlaceholder({ accent, index }: { accent: string; index: number }) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 200 300"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      style={{position: 'absolute', inset: 0}}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={`g_${index}`} cx="50%" cy="30%" r="80%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.25"/>
          <stop offset="60%" stopColor="#ff4400" stopOpacity="0.08"/>
          <stop offset="100%" stopColor="#000" stopOpacity="1"/>
        </radialGradient>
      </defs>
      <rect width="200" height="300" fill={COLORS.cardBg}/>
      <rect width="200" height="300" fill={`url(#g_${index})`}/>
      <g stroke={accent} strokeWidth="0.3" opacity="0.15">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <line key={i} x1={20 + i * 30} y1="0" x2={20 + i * 30 - 40} y2="300"/>
        ))}
      </g>
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <circle
          key={`a${i}`}
          cx={20 + i * 27}
          cy={30 + Math.sin(i) * 15}
          r="2"
          fill={accent}
          opacity={0.2 + i * 0.05}
        />
      ))}
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <circle
          key={`b${i}`}
          cx={25 + i * 26}
          cy={55 + Math.cos(i) * 10}
          r="2"
          fill={accent}
          opacity={0.15 + i * 0.04}
        />
      ))}
    </svg>
  )
}

function getPrice(event: Event): string {
  const tiers = event.ticket_tiers ?? []
  if (!tiers.length) return 'Free'
  const prices = tiers.map(t => t.price)
  const min = Math.min(...prices),
    max = Math.max(...prices)
  if (min === 0) return 'Free'
  if (min === max) return `$${min.toFixed(2)}`
  return `$${min.toFixed(2)}+`
}

export default function Home() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'nightlife' | 'concert' | 'festival' | 'nearme'>('all')
  const [userCity, setUserCity] = useState<string | null>(null)
  const [heroVisible, setHeroVisible] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  useHeroAnimation(canvasRef)

  useEffect(() => {
    const id = setTimeout(() => setHeroVisible(true), 100)
    const supabase = createClient()
    let alive = true
    supabase
      .from('events')
      .select('*, ticket_tiers(*)')
      .eq('status', 'published')
      .order('starts_at', { ascending: true })
      .then(({ data }) => {
        if (!alive) return
        setEvents((data ?? []) as Event[])
        setLoading(false)
      })
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [])

  useEffect(() => {
    if (!gridRef.current) return
    const cards = gridRef.current.querySelectorAll('.card')
    const timers: number[] = []
    cards.forEach((card, index) => {
      const id = window.setTimeout(() => (card as HTMLElement).classList.add('visible'), index * 80)
      timers.push(id)
    })
    return () => {
      timers.forEach(clearTimeout)
    }
  }, [loading, filter])

  const handleNearMe = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setFilter('nearme')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } },
          )
          const data = await res.json()
          setUserCity(data.address?.city ?? data.address?.town ?? null)
          setFilter('nearme')
        } catch {
          setFilter('nearme')
        }
      },
      () => alert('Please enable location access'),
    )
  }, [])

  const filtered = (() => {
    if (filter === 'all') return events
    if (filter === 'nearme') {
      return userCity ? events.filter(e => e.city?.toLowerCase().includes(userCity.toLowerCase())) : events
    }
    return events.filter(e => e.category === filter)
  })()

  const tickerText = 'TONIGHT · YOUR CITY · FIND YOUR PULSE · LIVE EVENTS · HOUSTON · GET ON THE LIST · '

  const filters = [
    { label: 'All', value: 'all' as const, icon: 'ti-layout-grid' },
    { label: 'Nightlife', value: 'nightlife' as const, icon: 'ti-moon' },
    { label: 'Concerts', value: 'concert' as const, icon: 'ti-music' },
    { label: 'Festivals', value: 'festival' as const, icon: 'ti-confetti' },
    { label: 'Near me', value: 'nearme' as const, icon: 'ti-map-pin' },
  ]

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@400;700;900&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        html, body { background:${COLORS.bg}; min-height:100vh; overflow-x:hidden; }

        .page { position:relative; z-index:1; }

        nav { padding:14px 0; background:rgba(0,0,0,0.9); position:sticky; top:0; z-index:100; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); }
        nav::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,${COLORS.accent},${COLORS.primary},${COLORS.highlight},${COLORS.accent},transparent); background-size:300% 100%; animation:navPulse 5s ease-in-out infinite; }
        @keyframes navPulse { 0%{background-position:0% 50%;opacity:0.2} 50%{background-position:100% 50%;opacity:1} 100%{background-position:0% 50%;opacity:0.2} }
        .nav-inner { display:flex; align-items:center; justify-content:space-between; padding:0 20px; max-width:1100px; margin:0 auto; }
        .logo { font-family:'Nunito',sans-serif; font-size:28px; font-weight:900; letter-spacing:-0.5px; color:${COLORS.primary}; cursor:pointer; line-height:1; text-transform:lowercase; filter:drop-shadow(0 0 10px rgba(255,170,51,0.5)); background:none; border:none; padding:0; }

        .hero-wrap { position:relative; overflow:hidden; min-height:480px; display:flex; flex-direction:column; justify-content:flex-end; padding-bottom:40px; }
        .hero-canvas { position:absolute; inset:0; width:100%; height:100%; }
        .hero-fade { position:absolute; bottom:0; left:0; right:0; height:180px; background:linear-gradient(to bottom,transparent,${COLORS.bg}); pointer-events:none; z-index:1; }
        .hero { position:relative; z-index:2; padding:60px 20px 0; }
        .hero-line { overflow:hidden; line-height:1; }
        .hero-word { font-family:'Barlow Condensed',sans-serif; font-size:clamp(44px,12vw,130px); line-height:0.88; color:#f0f0f0; letter-spacing:1px; font-weight:900; text-transform:uppercase; display:block; transform:translateY(110%); transition:transform 0.8s cubic-bezier(0.16,1,0.3,1); }
        .hero-word.accent { color:${COLORS.primary}; text-shadow:0 0 60px rgba(255,170,51,0.5), 0 0 120px rgba(255,100,0,0.25); white-space:nowrap; }
        .hero-word.show { transform:translateY(0); }
        .hero-sub { position:relative; z-index:2; margin-top:16px; padding:0 20px; font-size:14px; color:#665; font-weight:300; font-family:'DM Sans',sans-serif; line-height:1.6; opacity:0; transition:opacity 0.8s ease 0.6s; }
        .hero-sub.show { opacity:1; }
        .hero-sub a { color:${COLORS.primary}; text-decoration:none; font-weight:500; display:inline-flex; align-items:center; gap:4px; }

        .ticker-wrap { overflow:hidden; border-top:0.5px solid rgba(255,255,255,0.04); border-bottom:0.5px solid rgba(255,255,255,0.04); background:rgba(255,170,51,0.02); padding:10px 0; }
        .ticker-track { display:flex; width:max-content; animation:ticker 22s linear infinite; }
        .ticker-item { font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700; letter-spacing:2px; color:${COLORS.primary}; opacity:0.32; white-space:nowrap; text-transform:uppercase; }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }

        .filters { padding:16px 16px 10px; display:flex; gap:8px; flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; max-width:1100px; margin:0 auto; }
        .filters::-webkit-scrollbar { display:none; }
        .pill { background:rgba(255,255,255,0.04); border:0.5px solid rgba(255,255,255,0.07); border-radius:100px; padding:8px 16px; font-size:13px; color:#665; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.2s; white-space:nowrap; flex-shrink:0; display:inline-flex; align-items:center; gap:6px; }
        .pill:active { transform:scale(0.94); }
        .pill.active { background:rgba(255,170,51,0.1); color:${COLORS.primary}; border-color:rgba(255,170,51,0.3); font-weight:500; }

        .section-label { font-size:11px; color:#3a2a1a; letter-spacing:1.5px; text-transform:uppercase; font-family:'DM Sans',sans-serif; padding:0 16px 10px; max-width:1100px; margin:0 auto; }
        .cards-wrap { padding:4px 12px 100px; max-width:1100px; margin:0 auto; }
        .grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; }
        @media(min-width:600px){ .grid { grid-template-columns:repeat(3, 1fr); gap:12px; } }
        @media(min-width:900px){ .grid { grid-template-columns:repeat(4, 1fr); gap:16px; } }

        .card { border-radius:14px; cursor:pointer; position:relative; overflow:hidden; opacity:0; transform:translateY(20px); transition:transform 0.25s ease, box-shadow 0.25s ease, opacity 0.4s ease; aspect-ratio:2/3; background:${COLORS.cardBg}; }
        .card.visible { opacity:1; transform:translateY(0); }
        .card:focus-visible { outline:2px solid ${COLORS.primary}; outline-offset:2px; }
        .card:active { transform:scale(0.96) !important; }
        @media(hover:hover){ .card:hover { transform:translateY(-4px) !important; box-shadow:0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(255,170,51,0.08); } }
        .card-bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .card-overlay { position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.2) 55%, transparent 100%); }
        .card-content { position:absolute; inset:0; padding:10px; display:flex; flex-direction:column; justify-content:space-between; }
        .card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:4px; }
        .card-tag { font-size:9px; font-weight:600; padding:3px 7px; border-radius:100px; letter-spacing:0.8px; text-transform:uppercase; font-family:'DM Sans',sans-serif; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
        .card-price-badge { font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900; color:#fff; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); padding:3px 7px; border-radius:100px; border:0.5px solid rgba(255,255,255,0.1); white-space:nowrap; }
        .card-price-badge.free { color:${COLORS.primary}; border-color:rgba(255,170,51,0.35); }
        .card-date { font-size:9px; color:rgba(255,255,255,0.45); letter-spacing:0.6px; text-transform:uppercase; margin-bottom:3px; font-family:'DM Sans',sans-serif; display:flex; align-items:center; gap:3px; }
        .card-title { font-family:'Barlow Condensed',sans-serif; font-size:clamp(16px,4vw,22px); font-weight:900; color:#fff; text-transform:uppercase; line-height:1; margin-bottom:4px; }
        .card-venue { font-size:10px; color:rgba(255,255,255,0.4); font-family:'DM Sans',sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:3px; }

        .tag-nightlife { background:rgba(255,170,51,0.12); color:${COLORS.primary}; border:0.5px solid rgba(255,170,51,0.25); }
        .tag-concert { background:rgba(255,102,0,0.12); color:${COLORS.accent}; border:0.5px solid rgba(255,102,0,0.25); }
        .tag-festival { background:rgba(255,200,80,0.1); color:${COLORS.highlight}; border:0.5px solid rgba(255,200,80,0.2); }
        .tag-other { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.5); border:0.5px solid rgba(255,255,255,0.1); }

        .skeleton { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
        @media(min-width:600px){ .skeleton { grid-template-columns:repeat(3,1fr); gap:12px; } }
        @media(min-width:900px){ .skeleton { grid-template-columns:repeat(4,1fr); gap:16px; } }
        .skel { aspect-ratio:2/3; border-radius:14px; background:linear-gradient(110deg, #0c0700 0%, #1a1000 50%, #0c0700 100%); background-size:200% 100%; animation:shimmer 1.6s linear infinite; }
        @keyframes shimmer { from{background-position:0% 0%} to{background-position:-200% 0%} }

        .empty { text-align:center; padding:60px 20px; color:#554; font-size:15px; font-family:'DM Sans',sans-serif; line-height:1.6; }
        .empty a { color:${COLORS.primary}; text-decoration:none; display:inline-flex; align-items:center; gap:4px; }
        .bottom { padding:12px 12px 20px; }
        .showing { font-size:11px; color:#332; letter-spacing:0.5px; font-family:'DM Sans',sans-serif; }
        .nav-desktop { display:none; }
        .nav-mobile { display:flex; }
        @media(min-width:680px){ .nav-desktop { display:flex; } .nav-mobile { display:none !important; } }

        @media (prefers-reduced-motion: reduce) {
          .hero-word, .hero-sub, .card { transition:none !important; }
          .ticker-track, nav::after, .skel { animation:none !important; }
        }
      `}</style>

      <div className="page">
        <nav>
          <div className="nav-inner">
            <button className="logo" onClick={() => router.push('/')} aria-label="Pulse home">
              pulse
            </button>
            <div className="nav-desktop">
              <NavActions/>
            </div>
            <div className="nav-mobile">
              <NavActions compact/>
            </div>
          </div>
        </nav>

        <header className="hero-wrap">
          <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true"/>
          <div className="hero-fade"/>
          <div className="hero">
            <div className="hero-line">
              <span
                className={`hero-word ${heroVisible ? 'show' : ''}`}
                style={{transitionDelay: '0ms'}}
              >
                Find
              </span>
            </div>
            <div className="hero-line" style={{overflow: 'visible'}}>
              <span
                className={`hero-word accent ${heroVisible ? 'show' : ''}`}
                style={{transitionDelay: '120ms'}}
              >
                Your Pulse.
              </span>
            </div>
          </div>
          <p className={`hero-sub ${heroVisible ? 'show' : ''}`}>
            Discover the best parties &amp; shows near you.{' '}
            <a
              href="/host/create"
              onClick={e => {
                e.preventDefault()
                router.push('/host/create')
              }}
            >
              Host your own →
            </a>
          </p>
        </header>

        <div className="ticker-wrap" aria-hidden="true">
          <div className="ticker-track">
            <span className="ticker-item">{tickerText.repeat(4)}</span>
            <span className="ticker-item">{tickerText.repeat(4)}</span>
          </div>
        </div>

        <section className="events-section" aria-label="Events">
          <div className="filters" role="tablist">
            {filters.map(f => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                className={`pill ${filter === f.value ? 'active' : ''}`}
                onClick={() => (f.value === 'nearme' ? handleNearMe() : setFilter(f.value))}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="section-label">
            {filter === 'all'
              ? 'All events'
              : filter === 'nearme'
                ? 'Near you'
                : CATEGORY_LABEL[filter]}
            {' '}— {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
          </div>

          <div className="cards-wrap">
            {loading ? (
              <div className="skeleton" aria-busy="true" aria-label="Loading events">
                {Array.from({length: 8}).map((_, i) => (
                  <div key={i} className="skel"/>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty">
                {filter === 'nearme'
                  ? 'No events near you yet.'
                  : events.length === 0
                    ? (
                        <>
                          No events yet.{' '}
                          <a
                            href="/host/create"
                            onClick={e => {
                              e.preventDefault()
                              router.push('/host/create')
                            }}
                          >
                            Create the first →
                          </a>
                        </>
                      )
                    : 'No events in this category.'}
              </div>
            ) : (
              <div className="grid" ref={gridRef}>
                {filtered.map((event, index) => {
                  const cat = event.category ?? 'other'
                  const accent = CATEGORY_ACCENT[cat] ?? COLORS.primary
                  const date = event.starts_at
                    ? new Date(event.starts_at)
                        .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
                        .toUpperCase()
                    : 'TBD'
                  const price = getPrice(event)
                  const isFree = price === 'Free'

                  return (
                    <article
                      key={event.id}
                      className="card"
                      tabIndex={0}
                      role="link"
                      aria-label={`${event.title}, ${CATEGORY_LABEL[cat]}, ${date}, ${price}`}
                      onClick={() => router.push(`/events/${event.id}`)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          router.push(`/events/${event.id}`)
                        }
                      }}
                    >
                      {event.cover_image_url ? (
                        <img
                          src={event.cover_image_url}
                          className="card-bg"
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <CardPlaceholder accent={accent} index={index}/>
                      )}
                      <div className="card-overlay"/>
                      <div className="card-content">
                        <div className="card-top">
                          <span className={`card-tag tag-${cat}`}>
                            {CATEGORY_LABEL[cat] ?? 'Event'}
                          </span>
                          <span className={`card-price-badge ${isFree ? 'free' : ''}`}>
                            {price}
                          </span>
                        </div>
                        <div>
                          <div className="card-date">
                            {date}
                          </div>
                          <div className="card-title">{event.title}</div>
                          <div className="card-venue">
                            {event.venue_name ?? event.city ?? 'TBD'}
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
            <div className="bottom">
              <span className="showing">
                {filtered.length} event{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}