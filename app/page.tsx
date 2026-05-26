'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from './lib/supabase/client'
import { usePageView } from './lib/usePageView'
import { useMagneticButton, useStaggerReveal, useNavLogo } from './lib/animations'
import TouchBlot from './components/TouchBlot'

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

  if (user) {
    const initials = (user.user_metadata?.full_name ?? user.email ?? 'U').slice(0, 2).toUpperCase()
    return (
      <div style={{display:'flex', gap: compact ? '12px' : '20px', alignItems:'center'}}>
        <a
          href="/host/create"
          onClick={e => { e.preventDefault(); router.push('/host/create') }}
          style={{
            color: '#fff',
            fontSize: compact ? '12px' : '13px',
            fontWeight: 700,
            textDecoration: 'none',
            fontFamily: 'Syne,sans-serif',
            letterSpacing: '0.3px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            paddingBottom: '2px',
            borderBottom: '1px solid rgba(255,255,255,0.35)',
            transition: 'border-color 0.2s',
          }}
        >
          <span style={{fontSize: compact ? '14px' : '15px', lineHeight: 1}}>+</span>
          {compact ? 'create' : 'create event'}
        </a>
        <a
          href="/account"
          onClick={e => { e.preventDefault(); router.push('/account') }}
          aria-label={`Account: ${name ?? 'user'}`}
          style={{
            width: compact ? '28px' : '32px',
            height: compact ? '28px' : '32px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
            border: '0.5px solid rgba(255,255,255,0.15)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Syne,sans-serif',
            fontSize: '10px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.5)',
            textDecoration: 'none',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {initials}
        </a>
      </div>
    )
  }

  return (
    <a
      href="/login"
      onClick={e => { e.preventDefault(); router.push('/login') }}
      style={{
        color: '#fff',
        fontSize: compact ? '12px' : '13px',
        fontWeight: 700,
        textDecoration: 'none',
        fontFamily: 'Syne,sans-serif',
        letterSpacing: '0.3px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        paddingBottom: '2px',
        borderBottom: '1px solid rgba(255,255,255,0.35)',
      }}
    >
      sign in
    </a>
  )
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
  usePageView('/')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'nightlife' | 'concert' | 'festival' | 'nearme'>('all')
  const [userCity, setUserCity] = useState<string | null>(null)
  const gridRef = useStaggerReveal<HTMLDivElement>({ selector: '.card', stagger: 0.05, trigger: 'mount', deps: [loading, filter] })
  const logoRef = useNavLogo<HTMLButtonElement>()

  useEffect(() => {
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
    }
  }, [])

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
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Syne:wght@400;500;600;700;800&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        html, body { background:${COLORS.bg}; min-height:100vh; overflow-x:hidden; }

        .page { position:relative; z-index:1; }
        .events-section { position:relative; z-index:1; }

        nav { padding:16px 0; background:transparent; position:sticky; top:0; z-index:100; }
        .nav-inner { display:flex; align-items:center; justify-content:space-between; padding:0 24px; max-width:1100px; margin:0 auto; }
        .logo { background:none; border:none; padding:0; cursor:pointer; line-height:0; display:inline-flex; }
        .logo-img { height:22px; width:auto; filter:drop-shadow(0 0 8px rgba(255,170,51,0.35)); }
        @media(max-width:680px){ .logo-img { height:20px; } }



        /* ACID — morphing amber/red/magenta liquid filling the WHOLE background */
        .acid { position:fixed; inset:0; z-index:0; background:${COLORS.bg}; overflow:hidden; pointer-events:none; }
        .acid::before, .acid::after, .acid .blob3 { content:''; position:absolute; border-radius:50%; filter:blur(90px); opacity:0.6; mix-blend-mode:screen; }
        .acid::before { width:70vw; height:70vw; background:radial-gradient(circle, ${COLORS.accent} 0%, transparent 66%); top:-18%; left:-10%; animation:acidA 20s ease-in-out infinite; }
        .acid::after { width:65vw; height:65vw; background:radial-gradient(circle, #e8001d 0%, transparent 64%); top:30%; right:-12%; animation:acidB 24s ease-in-out infinite; }
        .acid .blob3 { width:60vw; height:60vw; background:radial-gradient(circle, #c01a6f 0%, transparent 62%); bottom:-15%; left:25%; animation:acidC 28s ease-in-out infinite; }
        @keyframes acidA { 0%,100%{ transform:translate(0,0) scale(1); } 33%{ transform:translate(40vw,40vh) scale(1.3); } 66%{ transform:translate(18vw,75vh) scale(0.85); } }
        @keyframes acidB { 0%,100%{ transform:translate(0,0) scale(1.1); } 33%{ transform:translate(-40vw,30vh) scale(0.8); } 66%{ transform:translate(-22vw,-30vh) scale(1.25); } }
        @keyframes acidC { 0%,100%{ transform:translate(0,0) scale(1); } 25%{ transform:translate(-30vw,-40vh) scale(1.2); } 50%{ transform:translate(30vw,-60vh) scale(0.9); } 75%{ transform:translate(-20vw,-20vh) scale(1.15); } }


        .ticker-wrap { overflow:hidden; border-top:0.5px solid rgba(255,255,255,0.04); border-bottom:0.5px solid rgba(255,255,255,0.04); background:rgba(255,170,51,0.02); padding:10px 0; }
        .ticker-track { display:flex; width:max-content; animation:ticker 22s linear infinite; }
        .ticker-item { font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700; letter-spacing:2px; color:${COLORS.primary}; opacity:0.32; white-space:nowrap; text-transform:uppercase; }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }

        .filters { padding:16px 16px 10px; display:flex; gap:8px; flex-wrap:nowrap; overflow-x:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; max-width:1100px; margin:0 auto; }
        .filters::-webkit-scrollbar { display:none; }
        .pill { background:rgba(255,255,255,0.04); border:0.5px solid rgba(255,255,255,0.07); border-radius:100px; padding:8px 16px; font-size:13px; color:#665; cursor:pointer; font-family:'Syne',sans-serif; transition:all 0.2s; white-space:nowrap; flex-shrink:0; display:inline-flex; align-items:center; gap:6px; }
        .pill:active { transform:scale(0.94); }
        .pill.active { background:rgba(255,170,51,0.1); color:${COLORS.primary}; border-color:rgba(255,170,51,0.3); font-weight:500; }

        .section-label { font-size:11px; color:#3a2a1a; letter-spacing:1.5px; text-transform:uppercase; font-family:'Syne',sans-serif; padding:0 16px 10px; max-width:1100px; margin:0 auto; }
        .cards-wrap { padding:4px 12px 100px; max-width:1100px; margin:0 auto; }
        .grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:8px; }
        @media(min-width:600px){ .grid { grid-template-columns:repeat(3, 1fr); gap:12px; } }
        @media(min-width:900px){ .grid { grid-template-columns:repeat(4, 1fr); gap:16px; } }

        .card { border-radius:14px; cursor:pointer; position:relative; overflow:hidden; aspect-ratio:2/3; background:${COLORS.cardBg}; }
        .card:focus-visible { outline:2px solid ${COLORS.primary}; outline-offset:2px; }
        .card:active { transform:scale(0.96) !important; }
        @media(hover:hover){ .card:hover { transform:translateY(-4px) !important; box-shadow:0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(255,170,51,0.08); } }
        .card-bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
        .card-overlay { position:absolute; inset:0; background:linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.2) 55%, transparent 100%); }
        .card-content { position:absolute; inset:0; padding:10px; display:flex; flex-direction:column; justify-content:space-between; }
        .card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:4px; }
        .card-tag { font-size:9px; font-weight:600; padding:3px 7px; border-radius:100px; letter-spacing:0.8px; text-transform:uppercase; font-family:'Syne',sans-serif; backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }
        .card-price-badge { font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900; color:#fff; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); padding:3px 7px; border-radius:100px; border:0.5px solid rgba(255,255,255,0.1); white-space:nowrap; }
        .card-price-badge.free { color:${COLORS.primary}; border-color:rgba(255,170,51,0.35); }
        .card-date { font-size:9px; color:rgba(255,255,255,0.45); letter-spacing:0.6px; text-transform:uppercase; margin-bottom:3px; font-family:'Syne',sans-serif; display:flex; align-items:center; gap:3px; }
        .card-title { font-family:'Barlow Condensed',sans-serif; font-size:clamp(16px,4vw,22px); font-weight:900; color:#fff; text-transform:uppercase; line-height:1; margin-bottom:4px; }
        .card-venue { font-size:10px; color:rgba(255,255,255,0.4); font-family:'Syne',sans-serif; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; display:flex; align-items:center; gap:3px; }

        .tag-nightlife { background:rgba(255,170,51,0.12); color:${COLORS.primary}; border:0.5px solid rgba(255,170,51,0.25); }
        .tag-concert { background:rgba(255,102,0,0.12); color:${COLORS.accent}; border:0.5px solid rgba(255,102,0,0.25); }
        .tag-festival { background:rgba(255,200,80,0.1); color:${COLORS.highlight}; border:0.5px solid rgba(255,200,80,0.2); }
        .tag-other { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.5); border:0.5px solid rgba(255,255,255,0.1); }

        .skeleton { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; }
        @media(min-width:600px){ .skeleton { grid-template-columns:repeat(3,1fr); gap:12px; } }
        @media(min-width:900px){ .skeleton { grid-template-columns:repeat(4,1fr); gap:16px; } }
        .skel { aspect-ratio:2/3; border-radius:14px; background:linear-gradient(110deg, #0c0700 0%, #1a1000 50%, #0c0700 100%); background-size:200% 100%; animation:shimmer 1.6s linear infinite; }
        @keyframes shimmer { from{background-position:0% 0%} to{background-position:-200% 0%} }

        .empty { text-align:center; padding:60px 20px; color:#554; font-size:15px; font-family:'Syne',sans-serif; line-height:1.6; }
        .empty a { color:${COLORS.primary}; text-decoration:none; display:inline-flex; align-items:center; gap:4px; }
        .bottom { padding:12px 12px 20px; }
        .showing { font-size:11px; color:#332; letter-spacing:0.5px; font-family:'Syne',sans-serif; }
        .nav-desktop { display:none; }
        .nav-mobile { display:flex; }
        @media(min-width:680px){ .nav-desktop { display:flex; } .nav-mobile { display:none !important; } }

        @media (prefers-reduced-motion: reduce) {
          .card { transition:none !important; animation:none !important; }
          .acid::before, .acid::after, .acid .blob3 { animation:none !important; }
          .ticker-track, nav::after, .skel { animation:none !important; }
        }
      `}</style>

      <div className="acid" aria-hidden="true"><div className="blob3"/></div>
      <TouchBlot />

      <div className="page">
        <nav>
          <div className="nav-inner">
            <button ref={logoRef} className="logo" onClick={() => router.push('/')} aria-label="Pulse home">
              <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
            </button>
            <div className="nav-desktop">
              <NavActions/>
            </div>
            <div className="nav-mobile">
              <NavActions compact/>
            </div>
          </div>
        </nav>



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