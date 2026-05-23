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
  cover_image_url: string | null
  feed_video_url: string | null
  instagram_handle: string | null
  tiktok_url: string | null
  spotify_playlist_url: string | null
  ticket_tiers: Tier[]
}

const COLORS = {
  primary: '#ffaa33',
  accent: '#ff6600',
  highlight: '#ffc850',
  bg: '#000',
} as const

function priceLabel(tiers: Tier[]): string {
  if (!tiers || tiers.length === 0) return 'Free'
  const prices = tiers.map(t => Number(t.price) || 0)
  const min = Math.min(...prices), max = Math.max(...prices)
  if (min === 0 && max === 0) return 'Free'
  if (min === 0) return `Free–$${max}`
  if (min === max) return `$${min}`
  return `$${min}–$${max}`
}

function igUrl(handle: string): string {
  const clean = handle.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/+$/, '')
  return `https://www.instagram.com/${clean}/`
}

export default function Discover() {
  const router = useRouter()
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [audioReady, setAudioReady] = useState(false)
  const [nowPlaying, setNowPlaying] = useState<{ title: string; artist: string } | null>(null)
  const [muted, setMuted] = useState(false)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const cardRefs = useRef<(HTMLElement | null)[]>([])
  const previewCache = useRef<Record<string, string | null>>({})
  const metaCache = useRef<Record<string, { title: string; artist: string }>>({})

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

  useEffect(() => {
    const a = new Audio()
    a.loop = true
    a.preload = 'auto'
    audioRef.current = a
    return () => { a.pause(); a.src = '' }
  }, [])

  const getPreview = useCallback(async (ev: FeedEvent): Promise<string | null> => {
    if (!ev.spotify_playlist_url) return null
    if (ev.id in previewCache.current) return previewCache.current[ev.id]
    try {
      const res = await fetch(`/api/spotify-preview?url=${encodeURIComponent(ev.spotify_playlist_url)}`)
      const data = await res.json()
      previewCache.current[ev.id] = data.preview ?? null
      if (data.title) metaCache.current[ev.id] = { title: data.title, artist: data.artist ?? '' }
      return data.preview ?? null
    } catch {
      previewCache.current[ev.id] = null
      return null
    }
  }, [])

  const playFor = useCallback(async (index: number) => {
    const a = audioRef.current
    const ev = events[index]
    if (!a || !ev) return
    const preview = await getPreview(ev)
    if (!preview) {
      a.pause()
      setNowPlaying(null)
      return
    }
    if (a.src !== preview) a.src = preview
    a.muted = muted
    try {
      await a.play()
      setAudioReady(true)
      const meta = metaCache.current[ev.id]
      if (meta) setNowPlaying(meta)
    } catch {
      setAudioReady(false)
    }
  }, [events, getPreview, muted])

  useEffect(() => {
    if (loading || events.length === 0) return
    const scroller = scrollerRef.current
    if (!scroller) return
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.index)
            setActiveIndex(idx)
          }
        })
      },
      { root: scroller, threshold: [0.6] },
    )
    cardRefs.current.forEach(c => c && obs.observe(c))
    return () => obs.disconnect()
  }, [loading, events])

  useEffect(() => {
    if (loading || events.length === 0) return
    playFor(activeIndex)
    const next = events[activeIndex + 1]
    if (next) getPreview(next)
  }, [activeIndex, loading, events, playFor, getPreview])

  const unlockAudio = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    a.muted = false
    setMuted(false)
    playFor(activeIndex)
  }, [activeIndex, playFor])

  const openExternal = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [])

  const toggleMute = useCallback(() => {
    const a = audioRef.current
    if (!a) return
    const m = !muted
    a.muted = m
    setMuted(m)
    if (!m) { a.play().catch(() => {}); setAudioReady(true) }
  }, [muted])

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@400;500;600&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        html,body{background:${COLORS.bg};overflow:hidden;height:100%;}

        .feed-nav{position:fixed;top:0;left:0;right:0;z-index:50;padding:16px 18px;display:flex;align-items:center;justify-content:space-between;background:linear-gradient(to bottom,rgba(0,0,0,0.65),transparent);pointer-events:none;}
        .feed-nav button,.feed-nav img{pointer-events:auto;}
        .feed-logo{height:22px;width:auto;cursor:pointer;filter:drop-shadow(0 0 10px rgba(255,170,51,0.4));}
        @media(max-width:680px){.feed-logo{height:20px;}}
        .feed-right{display:flex;align-items:center;gap:10px;}
        .icon-btn{background:rgba(0,0,0,0.4);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:0.5px solid rgba(255,255,255,0.15);color:#fff;width:34px;height:34px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;}
        .icon-btn:active{transform:scale(0.92);}

        .scroller{height:100dvh;overflow-y:scroll;scroll-snap-type:y mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
        .scroller::-webkit-scrollbar{display:none;}

        .card{position:relative;height:100dvh;scroll-snap-align:start;scroll-snap-stop:always;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;cursor:pointer;}
        .card-media,.card-media-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;}
        .card-fallback{position:absolute;inset:0;z-index:0;background:radial-gradient(circle at 50% 32%, rgba(255,170,51,0.14), #0a0500 72%);}
        .card-scrim{position:absolute;inset:0;z-index:1;background:linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.4) 42%, rgba(0,0,0,0.06) 68%, rgba(0,0,0,0.4) 100%);}

        .card-body{position:relative;z-index:2;padding:0 20px 44px;max-width:920px;margin:0 auto;width:100%;display:flex;align-items:flex-end;justify-content:space-between;gap:18px;}
        .card-text{flex:1;min-width:0;}
        .kicker{font-family:'DM Sans',sans-serif;font-size:10px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${COLORS.primary};margin-bottom:10px;opacity:0.85;}
        .card-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(46px,13vw,86px);font-weight:900;line-height:0.86;color:#fff;text-transform:uppercase;text-shadow:0 4px 40px rgba(0,0,0,0.85);margin-bottom:10px;letter-spacing:-0.5px;}
        .card-tagline{font-family:'DM Sans',sans-serif;font-size:14px;color:rgba(255,255,255,0.82);line-height:1.4;margin-bottom:16px;max-width:88%;}
        .card-meta{display:flex;flex-wrap:wrap;gap:8px 16px;font-family:'DM Sans',sans-serif;font-size:13px;color:rgba(255,255,255,0.72);}
        .card-meta-item{display:inline-flex;align-items:center;gap:5px;}
        .card-meta-item i{color:${COLORS.primary};font-size:15px;}
        .card-price{font-family:'Barlow Condensed',sans-serif;font-weight:900;color:${COLORS.primary};font-size:16px;}

        .rail{display:flex;flex-direction:column;gap:14px;align-items:center;flex-shrink:0;padding-bottom:2px;}
        .bubble{width:48px;height:48px;border-radius:50%;background:rgba(18,11,0,0.5);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:0.5px solid rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.18s;color:#fff;}
        .bubble:hover{border-color:rgba(255,170,51,0.6);transform:scale(1.08);}
        .bubble:active{transform:scale(0.9);}
        .bubble i{font-size:21px;}
        .bubble.tickets{background:${COLORS.primary};border-color:${COLORS.primary};color:#000;box-shadow:0 0 20px rgba(255,170,51,0.45);}

        .np{position:fixed;top:58px;left:18px;z-index:40;display:flex;align-items:center;gap:9px;pointer-events:none;background:rgba(0,0,0,0.45);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:0.5px solid rgba(255,255,255,0.12);border-radius:100px;padding:7px 13px 7px 11px;max-width:64vw;}
        .np-eq{display:flex;align-items:flex-end;gap:2px;height:15px;}
        .np-eq span{width:2.5px;background:${COLORS.primary};border-radius:2px;animation:eq 0.9s ease-in-out infinite;}
        .np-eq span:nth-child(2){animation-delay:0.15s}
        .np-eq span:nth-child(3){animation-delay:0.3s}
        .np-eq span:nth-child(4){animation-delay:0.45s}
        @keyframes eq{0%,100%{height:4px}50%{height:15px}}
        .np-text{font-family:'DM Sans',sans-serif;font-size:11px;color:rgba(255,255,255,0.75);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

        .unlock{position:fixed;left:50%;bottom:calc(40px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:45;background:rgba(255,170,51,0.92);color:#000;border:none;border-radius:100px;padding:11px 20px;font-family:'DM Sans',sans-serif;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:7px;box-shadow:0 4px 24px rgba(255,170,51,0.4);animation:rise 0.4s cubic-bezier(0.16,1,0.3,1);}
        @keyframes rise{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}

        .scroll-hint{position:absolute;bottom:14px;left:50%;transform:translateX(-50%);z-index:3;color:rgba(255,255,255,0.4);font-size:22px;animation:bob 1.8s ease-in-out infinite;pointer-events:none;}
        @keyframes bob{0%,100%{transform:translate(-50%,0)}50%{transform:translate(-50%,7px)}}

        .empty,.loading{height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;color:#665;font-family:'DM Sans',sans-serif;padding:20px;text-align:center;}
        .empty-logo{height:46px;width:auto;opacity:0.9;margin-bottom:6px;}
        .empty-btn{background:${COLORS.primary};color:#000;border:none;border-radius:100px;padding:12px 26px;font-family:'DM Sans',sans-serif;font-weight:600;font-size:14px;cursor:pointer;}
        .spinner{width:30px;height:30px;border:2px solid ${COLORS.primary};border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}

        @media (prefers-reduced-motion: reduce){.scroll-hint,.spinner,.np-eq span{animation:none!important;}}
      `}</style>

      <div className="feed-nav">
        <img src="/pulse-word-tight.png" alt="pulse" className="feed-logo" onClick={() => router.push('/')}/>
        <div className="feed-right">
          {audioReady && (
            <button className="icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'}>
              <i className={`ti ${muted ? 'ti-volume-off' : 'ti-volume'}`} style={{fontSize:'17px'}} aria-hidden="true"/>
            </button>
          )}
          <button className="icon-btn" onClick={() => router.push('/')} aria-label="Close">
            <i className="ti ti-x" style={{fontSize:'17px'}} aria-hidden="true"/>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner"/></div>
      ) : events.length === 0 ? (
        <div className="empty">
          <img src="/pulse-logo.png" alt="pulse" className="empty-logo"/>
          <div>Nothing live yet. Check back soon.</div>
          <button className="empty-btn" onClick={() => router.push('/')}>Back home</button>
        </div>
      ) : (
        <>
          <div className="scroller" ref={scrollerRef}>
            {events.map((ev, i) => {
              const cat = ev.category ?? 'other'
              const date = ev.starts_at
                ? new Date(ev.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
                : 'TBD'
              const loc = [ev.venue_name, ev.city].filter(Boolean).join(', ')
              const price = priceLabel(ev.ticket_tiers)

              return (
                <section
                  key={ev.id}
                  className="card"
                  data-index={i}
                  ref={el => { cardRefs.current[i] = el }}
                  onClick={() => router.push(`/events/${ev.id}`)}
                >
                  {ev.feed_video_url ? (
                    <video className="card-media-video" src={ev.feed_video_url} autoPlay muted loop playsInline poster={ev.cover_image_url ?? undefined}/>
                  ) : ev.cover_image_url ? (
                    <img className="card-media" src={ev.cover_image_url} alt={ev.title} loading={i < 2 ? 'eager' : 'lazy'}/>
                  ) : (
                    <div className="card-fallback"/>
                  )}
                  <div className="card-scrim"/>

                  <div className="card-body">
                    <div className="card-text">
                      <div className="kicker">{cat}</div>
                      <h1 className="card-title">{ev.title}</h1>
                      {ev.tagline && <p className="card-tagline">{ev.tagline}</p>}
                      <div className="card-meta">
                        <span className="card-meta-item"><i className="ti ti-calendar" aria-hidden="true"/>{date}</span>
                        {loc && <span className="card-meta-item"><i className="ti ti-map-pin" aria-hidden="true"/>{loc}</span>}
                        <span className="card-meta-item"><i className="ti ti-ticket" aria-hidden="true"/><span className="card-price">{price}</span></span>
                      </div>
                    </div>

                    <div className="rail" onClick={e => e.stopPropagation()}>
                      {ev.instagram_handle && (
                        <button className="bubble" onClick={() => openExternal(igUrl(ev.instagram_handle!))} aria-label="Instagram">
                          <i className="ti ti-brand-instagram" aria-hidden="true"/>
                        </button>
                      )}
                      {ev.tiktok_url && (
                        <button className="bubble" onClick={() => openExternal(ev.tiktok_url!)} aria-label="TikTok">
                          <i className="ti ti-brand-tiktok" aria-hidden="true"/>
                        </button>
                      )}
                      <button className="bubble tickets" onClick={() => router.push(`/events/${ev.id}`)} aria-label="Tickets">
                        <i className="ti ti-ticket" aria-hidden="true"/>
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

          {audioReady && !muted && nowPlaying && (
            <div className="np">
              <div className="np-eq"><span/><span/><span/><span/></div>
              <div className="np-text">{nowPlaying.title}{nowPlaying.artist ? ` · ${nowPlaying.artist}` : ''}</div>
            </div>
          )}

          {!audioReady && (
            <button className="unlock" onClick={unlockAudio}>
              <i className="ti ti-volume" style={{fontSize:'16px'}} aria-hidden="true"/>
              Tap for sound
            </button>
          )}
        </>
      )}
    </>
  )
}