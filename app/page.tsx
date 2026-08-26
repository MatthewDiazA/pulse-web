'use client'
import React, { useEffect, useState, useRef } from 'react'
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
  bg: '#000',
  cardBg: '#080808',
} as const

// A show counts as "upcoming" until 12 hours after doors.
const GRACE_MS = 12 * 60 * 60 * 1000

function isUpcoming(e: Event, cutoff: number): boolean {
  if (!e.starts_at) return true                 // undated events stay in the live set
  return new Date(e.starts_at).getTime() >= cutoff
}

// Upcoming shows first, soonest to furthest out.
// Then past shows, most recent to oldest — the archive trailing behind.
function orderEvents(list: Event[]): Event[] {
  const cutoff = Date.now() - GRACE_MS
  const t = (e: Event) => (e.starts_at ? new Date(e.starts_at).getTime() : Infinity)

  const upcoming = list.filter(e => isUpcoming(e, cutoff)).sort((a, b) => t(a) - t(b))
  const past = list.filter(e => !isUpcoming(e, cutoff)).sort((a, b) => t(b) - t(a))

  return [...upcoming, ...past]
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

function NavActions() {
  const user = useUser()
  const router = useRouter()
  const name = displayName(user)

  if (user) {
    const initials = (user.user_metadata?.full_name ?? user.email ?? 'U').slice(0, 2).toUpperCase()
    return (
      <div className="nav-actions">
        <a
          href="/host/create"
          className="nav-plus"
          aria-label="Create event"
          title="Create event"
          onClick={e => { e.preventDefault(); router.push('/host/create') }}
        >
          +
        </a>
        <a
          href="/account"
          className="nav-avatar"
          onClick={e => { e.preventDefault(); router.push('/account') }}
          aria-label={`Account: ${name ?? 'user'}`}
        >
          {initials}
        </a>
      </div>
    )
  }

  return (
    <a
      href="/login"
      className="nav-signin"
      onClick={e => { e.preventDefault(); router.push('/login') }}
    >
      sign in
    </a>
  )
}

function CardPlaceholder({ index }: { index: number }) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 200 250"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid slice"
      style={{position: 'absolute', inset: 0}}
      aria-hidden="true"
    >
      <rect width="200" height="250" fill={COLORS.cardBg}/>
      <g stroke="rgba(255,255,255,0.09)" strokeWidth="0.4" fill="none">
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <circle key={i} cx="100" cy="125" r={12 + i * 13}/>
        ))}
      </g>
      <line x1="0" y1="125" x2="200" y2="125" stroke={COLORS.primary} strokeWidth="0.4" opacity="0.35"/>
      <text
        x="100" y="128"
        textAnchor="middle"
        fill="rgba(255,255,255,0.22)"
        fontFamily="'Barlow Condensed',sans-serif"
        fontSize="11"
        letterSpacing="4"
      >
        {String(index + 1).padStart(3, '0')}
      </text>
    </svg>
  )
}

function getPrice(event: Event): string {
  const tiers = event.ticket_tiers ?? []
  const prices = tiers.map(t => Number(t.price)).filter(p => !isNaN(p) && p >= 0)
  if (!prices.length) return 'free'
  const min = Math.min(...prices), max = Math.max(...prices)
  if (min === 0) return 'free'
  const fmt = (n: number) => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`)
  return min === max ? fmt(min) : `${fmt(min)}+`
}

function shortDate(iso: string | null): string {
  if (!iso) return 'tba'
  return new Date(iso)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    .toLowerCase()
}

// Extracted so each card owns its own ref + tilt state.
// Hooks can't run inside a .map() — same pattern as BuyButton on the event page.
function EventCard({ event, index, tilt, past, onOpen }: {
  event: Event; index: number; tilt: boolean; past: boolean; onOpen: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const date = shortDate(event.starts_at)
  const price = getPrice(event)

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!tilt) return
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const cx = (e.clientX - r.left) / r.width - 0.5
    const cy = (e.clientY - r.top) / r.height - 0.5
    el.style.transform =
      `perspective(1400px) translate3d(0,-3px,0)` +
      ` rotateX(${(-cy * 5).toFixed(2)}deg) rotateY(${(cx * 5).toFixed(2)}deg)`
  }
  const onEnter = () => { if (tilt && ref.current) ref.current.style.transition = 'none' }
  const onLeave = () => {
    const el = ref.current; if (!el) return
    el.style.transition = 'transform 0.6s cubic-bezier(.2,.8,.2,1)'
    el.style.transform = ''
    const clear = () => { el.style.transition = ''; el.removeEventListener('transitionend', clear) }
    el.addEventListener('transitionend', clear)
  }

  return (
    <article
      ref={ref}
      className={`card ${past ? 'card-past' : ''}`}
      tabIndex={0}
      role="link"
      aria-label={`${event.title}, ${date}, ${past ? 'past event' : price}`}
      onClick={onOpen}
      onPointerMove={onMove}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen() } }}
    >
      <div className="frame">
        {event.cover_image_url
          ? <img src={event.cover_image_url} className="frame-img" alt="" loading="lazy"/>
          : <CardPlaceholder index={index}/>
        }
      </div>

      {/* Caption sits under the art, museum-label style — nothing covers the flyer */}
      <div className="caption">
        <div className="caption-rule"/>
        <div className="caption-row">
          <span className="caption-date">{date}</span>
          <span className="caption-price">{past ? '' : price}</span>
        </div>
        <div className="caption-title">{event.title.toLowerCase()}</div>
        <div className="caption-venue">{(event.venue_name ?? event.city ?? 'tba').toLowerCase()}</div>
      </div>
    </article>
  )
}

export default function Home() {
  const router = useRouter()
  const [events, setEvents] = useState<Event[]>([])
  usePageView('/')
  const [loading, setLoading] = useState(true)
  const [tiltOn, setTiltOn] = useState(false)
  const gridRef = useStaggerReveal<HTMLDivElement>({ selector: '.card', stagger: 0.07, trigger: 'mount', deps: [loading] })
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
        setEvents(orderEvents((data ?? []) as Event[]))
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  // Tilt only on real mouse + no reduced motion
  useEffect(() => {
    setTiltOn(
      window.matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  }, [])

  const cutoff = Date.now() - GRACE_MS

  // Ticker reads the soonest upcoming event — nothing to update by hand.
  const next = events.find(e => isUpcoming(e, cutoff))
  const tickerText = next
    ? `${next.title} · ${shortDate(next.starts_at)} · ${next.venue_name ?? next.city ?? 'houston'} · `.toLowerCase()
    : 'houston · house & electronic · '

  const upcomingCount = events.filter(e => isUpcoming(e, cutoff)).length

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Syne:wght@400;500;600;700;800&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        html, body { background:${COLORS.bg}; min-height:100vh; overflow-x:hidden; }
        .page { position:relative; z-index:1; background:${COLORS.bg}; min-height:100vh; }

        /* NAV — no glow, no label. Wordmark, plus, avatar. */
        nav { padding:26px 0 20px; background:transparent; position:sticky; top:0; z-index:100;
              backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); }
        .nav-inner { display:flex; align-items:center; justify-content:space-between; padding:0 28px; max-width:1120px; margin:0 auto; }
        .logo { background:none; border:none; padding:0; cursor:pointer; line-height:0; display:inline-flex; }
        .logo-img { height:19px; width:auto; }
        .nav-actions { display:flex; align-items:center; gap:18px; }
        .nav-plus { color:rgba(255,255,255,0.75); font-family:'Syne',sans-serif; font-size:20px; font-weight:600;
                    line-height:1; text-decoration:none; width:26px; height:26px; display:inline-flex;
                    align-items:center; justify-content:center; transition:color 0.2s; }
        .nav-plus:hover { color:${COLORS.primary}; }
        .nav-avatar { width:28px; height:28px; border-radius:50%; background:transparent;
                      border:0.5px solid rgba(255,255,255,0.2); display:inline-flex; align-items:center;
                      justify-content:center; font-family:'Syne',sans-serif; font-size:9px; font-weight:700;
                      letter-spacing:0.5px; color:rgba(255,255,255,0.5); text-decoration:none; flex-shrink:0; }
        .nav-signin { color:#fff; font-size:12px; font-weight:600; text-decoration:none; font-family:'Syne',sans-serif;
                      letter-spacing:0.3px; border-bottom:1px solid rgba(255,255,255,0.3); padding-bottom:2px; }

        /* TICKER — quieter, lowercase, reads as a wire feed not a marquee */
        .ticker-wrap { overflow:hidden; border-top:0.5px solid rgba(255,255,255,0.07);
                       border-bottom:0.5px solid rgba(255,255,255,0.07); padding:11px 0; }
        .ticker-track { display:flex; width:max-content; animation:ticker 34s linear infinite; }
        .ticker-item { font-family:'Syne',sans-serif; font-size:10px; font-weight:500; letter-spacing:3.5px;
                       color:rgba(255,255,255,0.3); white-space:nowrap; }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }

        .section-label { font-family:'Syne',sans-serif; font-size:10px; letter-spacing:3px;
                         color:rgba(255,255,255,0.28); padding:38px 28px 22px; max-width:1120px; margin:0 auto; }
        .section-label b { color:rgba(255,255,255,0.55); font-weight:500; }

        /* GRID — few shows, big cards. Never a catalog of thumbnails. */
        .cards-wrap { padding:0 28px 120px; max-width:1120px; margin:0 auto; }
        .grid { display:grid; grid-template-columns:1fr; gap:52px 34px; }
        @media(min-width:620px){ .grid { grid-template-columns:repeat(2, 1fr); } }
        @media(min-width:1080px){ .grid { grid-template-columns:repeat(3, 1fr); } }

        .card { cursor:pointer; position:relative; background:none; transform-origin:center; will-change:transform; }
        .card:focus-visible { outline:1px solid ${COLORS.primary}; outline-offset:8px; }
        .frame { position:relative; overflow:hidden; aspect-ratio:4/5; background:${COLORS.cardBg};
                 border:0.5px solid rgba(255,255,255,0.09); }
        .frame-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
                     transition:transform 0.7s cubic-bezier(.2,.8,.2,1); }
        @media(hover:hover){ .card:hover .frame-img { transform:scale(1.03); } }
        @media(hover:hover){ .card:hover .caption-title { color:${COLORS.primary}; } }

        /* Museum label under the art */
        .caption { padding-top:14px; }
        .caption-rule { height:1px; background:rgba(255,255,255,0.12); margin-bottom:12px; }
        .caption-row { display:flex; justify-content:space-between; align-items:baseline; margin-bottom:7px; }
        .caption-date { font-family:'Syne',sans-serif; font-size:10px; letter-spacing:2.5px;
                        color:rgba(255,255,255,0.42); }
        .caption-price { font-family:'Syne',sans-serif; font-size:10px; letter-spacing:1.5px; color:${COLORS.primary}; }
        .caption-title { font-family:'Barlow Condensed',sans-serif; font-size:clamp(30px,4.5vw,44px); font-weight:700;
                         color:#fff; line-height:0.94; letter-spacing:-0.5px; transition:color 0.25s; }
        .caption-venue { font-family:'Syne',sans-serif; font-size:11px; color:rgba(255,255,255,0.35);
                         letter-spacing:0.5px; margin-top:6px; }

        /* Past shows read as archive. Grey does the work — no badge needed. */
        .card-past .frame-img, .card-past .frame svg { filter:grayscale(1); opacity:0.4; }
        .card-past .frame { border-color:rgba(255,255,255,0.05); }
        .card-past .caption-title { color:rgba(255,255,255,0.4); font-weight:400; }
        .card-past .caption-date, .card-past .caption-venue { color:rgba(255,255,255,0.22); }
        @media(hover:hover){ .card-past:hover .frame-img { filter:grayscale(0.2); opacity:0.85; } }

        .skeleton { display:grid; grid-template-columns:1fr; gap:52px 34px; }
        @media(min-width:620px){ .skeleton { grid-template-columns:repeat(2,1fr); } }
        @media(min-width:1080px){ .skeleton { grid-template-columns:repeat(3,1fr); } }
        .skel { aspect-ratio:4/5; background:#080808; border:0.5px solid rgba(255,255,255,0.06); }

        .empty { padding:70px 0; color:rgba(255,255,255,0.3); font-size:13px; font-family:'Syne',sans-serif;
                 letter-spacing:0.5px; }
        .empty a { color:${COLORS.primary}; text-decoration:none; }

        @media (prefers-reduced-motion: reduce) {
          .card, .frame-img { transition:none !important; }
          .ticker-track { animation:none !important; }
        }
      `}</style>

      <TouchBlot />

      <div className="page">
        <nav>
          <div className="nav-inner">
            <button ref={logoRef} className="logo" onClick={() => router.push('/')} aria-label="Pulse home">
              <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
            </button>
            <NavActions/>
          </div>
        </nav>

        <div className="ticker-wrap" aria-hidden="true">
          <div className="ticker-track">
            <span className="ticker-item">{tickerText.repeat(6)}</span>
            <span className="ticker-item">{tickerText.repeat(6)}</span>
          </div>
        </div>

        <section aria-label="Events">
          <div className="section-label">
            houston — <b>{upcomingCount === 0 ? 'no dates announced' : `${upcomingCount} upcoming`}</b>
          </div>

          <div className="cards-wrap">
            {loading ? (
              <div className="skeleton" aria-busy="true" aria-label="Loading events">
                {Array.from({length: 3}).map((_, i) => <div key={i} className="skel"/>)}
              </div>
            ) : events.length === 0 ? (
              <div className="empty">
                nothing announced.{' '}
                <a href="/host/create" onClick={e => { e.preventDefault(); router.push('/host/create') }}>create the first</a>
              </div>
            ) : (
              <div className="grid" ref={gridRef}>
                {events.map((event, index) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    index={index}
                    tilt={tiltOn}
                    past={!isUpcoming(event, cutoff)}
                    onOpen={() => router.push(`/events/${event.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  )
}