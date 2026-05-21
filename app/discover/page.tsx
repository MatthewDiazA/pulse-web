'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'

type Tier = { id: string; price: number }
type FeedEvent = {
  id: string
  title: string
  tagline: string | null
  category: 'nightlife' | 'concert' | 'festival' | 'other'
  starts_at: string | null
  venue_name: string | null
  city: string | null
  state: string | null
  cover_image_url: string | null
  feed_video_url: string | null
  instagram_handle: string | null
  tiktok_url: string | null
  spotify_playlist_url: string | null
  is_21_plus: boolean | null
  ticket_tiers: Tier[]
}

const COLORS = {
  primary: '#ffaa33',
  accent: '#ff6600',
  highlight: '#ffc850',
  bg: '#000',
} as const

const CATEGORY_LABEL: Record<string, string> = {
  nightlife: 'Nightlife', concert: 'Concert', festival: 'Festival', other: 'Event',
}

function priceLabel(tiers: Tier[]): string {
  if (!tiers || tiers.length === 0) return 'Free'
  const prices = tiers.map(t => Number(t.price) || 0)
  const min = Math.min(...prices), max = Math.max(...prices)
  if (min === 0 && max === 0) return 'Free'
  if (min === 0) return `Free–$${max}`
  if (min === max) return `$${min}`
  return `$${min}–$${max}`
}

// Build a Spotify embed URL from any Spotify link (playlist / artist / track / album)
function spotifyEmbed(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('spotify.com')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const [type, id] = parts
    return `https://open.spotify.com/embed/${type}/${id}`
  } catch {
    return null
  }
}

// Header line that adapts to the day, per the brief's dynamic header idea
function feedHeader(): string {
  const day = new Date().getDay()
  if (day === 5 || day === 6) return 'Happening this weekend'
  if (day === 0) return 'Closing out the weekend'
  return 'Coming up in Houston'
}

export default function Discover() {
  const router = useRouter()
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSpotify, setActiveSpotify] = useState<string | null>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('events')
        .select('*, ticket_tiers(id, price)')
        .eq('status', 'published')
        .order('starts_at', { ascending: true })
      setEvents((data ?? []) as FeedEvent[])
      setLoading(false)
    }
    load()
  }, [])

  const openExternal = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  const igUrl = (handle: string) => {
    const clean = handle.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/+$/, '')
    return `https://www.instagram.com/${clean}/`
  }

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        html,body{background:${COLORS.bg};overflow:hidden;height:100%;}

        .feed-nav{position:fixed;top:0;left:0;right:0;z-index:50;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(to bottom,rgba(0,0,0,0.7),transparent);pointer-events:none;}
        .feed-nav button{pointer-events:auto;}
        .feed-logo{font-family:'Nunito',sans-serif;font-size:24px;font-weight:900;color:${COLORS.primary};cursor:pointer;text-transform:lowercase;filter:drop-shadow(0 0 8px rgba(255,170,51,0.5));background:none;border:none;}
        .feed-header-pill{font-family:'DM Sans',sans-serif;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#fff;background:rgba(0,0,0,0.4);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:0.5px solid rgba(255,255,255,0.15);padding:6px 14px;border-radius:100px;}
        .feed-close{background:rgba(0,0,0,0.4);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:0.5px solid rgba(255,255,255,0.15);color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;}

        .scroller{height:100dvh;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
        .scroller::-webkit-scrollbar{display:none;}

        .card{position:relative;height:100dvh;scroll-snap-align:start;scroll-snap-stop:always;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;cursor:pointer;}
        .card-media,.card-media-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;}
        .card-fallback{position:absolute;inset:0;z-index:0;background:radial-gradient(circle at 50% 35%, rgba(255,170,51,0.12), #0a0500 70%);}
        .card-scrim{position:absolute;inset:0;z-index:1;background:linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.45) 38%, rgba(0,0,0,0.1) 65%, rgba(0,0,0,0.35) 100%);}

        .card-body{position:relative;z-index:2;padding:0 20px 40px;max-width:900px;margin:0 auto;width:100%;display:flex;align-items:flex-end;justify-content:space-between;gap:16px;}
        .card-text{flex:1;min-width:0;}
        .genre-pill{display:inline-flex;align-items:center;gap:5px;font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${COLORS.primary};background:rgba(255,170,51,0.14);border:0.5px solid rgba(255,170,51,0.3);padding:4px 11px;border-radius:100px;margin-bottom:12px;}
        .card-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(40px,11vw,72px);font-weight:900;line-height:0.9;color:#fff;text-transform:uppercase;text-shadow:0 4px 30px rgba(0,0,0,0.8);margin-bottom:8px;}
        .card-tagline{font-family:'DM Sans',sans-serif;font-size:14px;color:rgba(255,255,255,0.8);line-height:1.4;margin-bottom:14px;max-width:90%;}
        .card-meta{display:flex;flex-wrap:wrap;gap:14px;font-family:'DM Sans',sans-serif;font-size:13px;color:rgba(255,255,255,0.7);}
        .card-meta-item{display:inline-flex;align-items:center;gap:5px;}
        .card-meta-item i{color:${COLORS.primary};font-size:15px;}
        .card-price{font-family:'Barlow Condensed',sans-serif;font-weight:900;color:${COLORS.primary};}

        .rail{display:flex;flex-direction:column;gap:16px;align-items:center;flex-shrink:0;padding-bottom:4px;}
        .bubble{width:52px;height:52px;border-radius:50%;background:rgba(20,12,0,0.55);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:0.5px solid rgba(255,170,51,0.25);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all 0.18s;color:#fff;}
        .bubble:hover{border-color:rgba(255,170,51,0.6);background:rgba(40,24,0,0.7);transform:scale(1.06);}
        .bubble:active{transform:scale(0.92);}
        .bubble i{font-size:21px;}
        .bubble.tickets{background:${COLORS.primary};border-color:${COLORS.primary};color:#000;box-shadow:0 0 18px rgba(255,170,51,0.4);}
        .bubble.tickets:hover{background:${COLORS.highlight};}
        .bubble-label{font-family:'DM Sans',sans-serif;font-size:8px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;margin-top:1px;}

        .scroll-hint{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);z-index:3;color:rgba(255,255,255,0.4);font-size:20px;animation:bob 1.8s ease-in-out infinite;pointer-events:none;}
        @keyframes bob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,6px)}}

        .spotify-overlay{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn 0.2s ease;}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .spotify-box{width:100%;max-width:420px;}
        .spotify-close{display:flex;justify-content:flex-end;margin-bottom:12px;}
        .spotify-close button{background:rgba(255,255,255,0.1);border:0.5px solid rgba(255,255,255,0.2);color:#fff;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;}

        .empty,.loading{height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:#665;font-family:'DM Sans',sans-serif;padding:20px;text-align:center;}
        .empty-title{font-family:'Barlow Condensed',sans-serif;font-size:30px;font-weight:900;color:#f0f0f0;text-transform:uppercase;}
        .empty-btn{background:${COLORS.primary};color:#000;border:none;border-radius:100px;padding:12px 26px;font-family:'Nunito',sans-serif;font-weight:700;font-size:14px;cursor:pointer;margin-top:8px;}
        .spinner{width:30px;height:30px;border:2px solid ${COLORS.primary};border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}

        @media (prefers-reduced-motion: reduce){.scroll-hint,.spinner{animation:none!important;}}
      `}</style>

      <div className="feed-nav">
        <button className="feed-logo" onClick={() => router.push('/')}>pulse</button>
        <span className="feed-header-pill">{feedHeader()}</span>
        <button className="feed-close" onClick={() => router.push('/')} aria-label="Close">
          <i className="ti ti-x" style={{fontSize:'17px'}} aria-hidden="true"/>
        </button>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"/></div>
      ) : events.length === 0 ? (
        <div className="empty">
          <div className="empty-title">No events yet</div>
          <div>Check back soon — Houston's just getting started.</div>
          <button className="empty-btn" onClick={() => router.push('/')}>Back home</button>
        </div>
      ) : (
        <div className="scroller" ref={scrollerRef}>
          {events.map((ev, i) => {
            const cat = ev.category ?? 'other'
            const date = ev.starts_at
              ? new Date(ev.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
              : 'TBD'
            const loc = [ev.venue_name, ev.city].filter(Boolean).join(', ')
            const price = priceLabel(ev.ticket_tiers)
            const embed = ev.spotify_playlist_url ? spotifyEmbed(ev.spotify_playlist_url) : null

            return (
              <section
                key={ev.id}
                className="card"
                onClick={() => router.push(`/events/${ev.id}`)}
              >
                {ev.feed_video_url ? (
                  <video
                    className="card-media-video"
                    src={ev.feed_video_url}
                    autoPlay muted loop playsInline
                    poster={ev.cover_image_url ?? undefined}
                  />
                ) : ev.cover_image_url ? (
                  <img className="card-media" src={ev.cover_image_url} alt={ev.title} loading={i < 2 ? 'eager' : 'lazy'}/>
                ) : (
                  <div className="card-fallback"/>
                )}
                <div className="card-scrim"/>

                <div className="card-body">
                  <div className="card-text">
                    <span className="genre-pill">{CATEGORY_LABEL[cat] ?? 'Event'}</span>
                    <h1 className="card-title">{ev.title}</h1>
                    {ev.tagline && <p className="card-tagline">{ev.tagline}</p>}
                    <div className="card-meta">
                      <span className="card-meta-item">
                        <i className="ti ti-calendar" aria-hidden="true"/>{date}
                      </span>
                      {loc && (
                        <span className="card-meta-item">
                          <i className="ti ti-map-pin" aria-hidden="true"/>{loc}
                        </span>
                      )}
                      <span className="card-meta-item">
                        <i className="ti ti-ticket" aria-hidden="true"/>
                        <span className="card-price">{price}</span>
                      </span>
                    </div>
                  </div>

                  <div className="rail" onClick={e => e.stopPropagation()}>
                    {ev.instagram_handle && (
                      <button className="bubble" onClick={() => openExternal(igUrl(ev.instagram_handle!))} aria-label="Instagram">
                        <i className="ti ti-brand-instagram" aria-hidden="true"/>
                        <span className="bubble-label">Vibe</span>
                      </button>
                    )}
                    {ev.tiktok_url && (
                      <button className="bubble" onClick={() => openExternal(ev.tiktok_url!)} aria-label="TikTok">
                        <i className="ti ti-brand-tiktok" aria-hidden="true"/>
                        <span className="bubble-label">Energy</span>
                      </button>
                    )}
                    {embed && (
                      <button className="bubble" onClick={() => setActiveSpotify(embed)} aria-label="Spotify">
                        <i className="ti ti-brand-spotify" aria-hidden="true"/>
                        <span className="bubble-label">Sound</span>
                      </button>
                    )}
                    <button className="bubble tickets" onClick={() => router.push(`/events/${ev.id}`)} aria-label="Tickets">
                      <i className="ti ti-ticket" aria-hidden="true"/>
                      <span className="bubble-label">Tickets</span>
                    </button>
                  </div>
                </div>

                {i === 0 && events.length > 1 && (
                  <div className="scroll-hint"><i className="ti ti-chevron-down" aria-hidden="true"/></div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {activeSpotify && (
        <div className="spotify-overlay" onClick={() => setActiveSpotify(null)}>
          <div className="spotify-box" onClick={e => e.stopPropagation()}>
            <div className="spotify-close">
              <button onClick={() => setActiveSpotify(null)} aria-label="Close">
                <i className="ti ti-x" aria-hidden="true"/>
              </button>
            </div>
            <iframe
              src={activeSpotify}
              width="100%"
              height="352"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              style={{borderRadius: '12px'}}
              title="Spotify player"
            />
          </div>
        </div>
      )}
    </>
  )
}