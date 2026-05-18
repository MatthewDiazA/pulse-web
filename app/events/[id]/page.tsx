'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

type Tier = { id: string; name: string; price: number; quantity: number; sold: number }
type Event = {
  id: string
  title: string
  description: string
  category: 'nightlife' | 'concert' | 'festival' | 'other'
  starts_at: string | null
  doors_at: string | null
  venue_name: string | null
  address: string | null
  city: string | null
  state: string | null
  is_21_plus: boolean
  dress_code: string | null
  cover_image_url: string | null
  ticket_tiers: Tier[]
}

const COLORS = {
  primary: '#ffaa33',
  accent: '#ff6600',
  highlight: '#ffc850',
  bg: '#000',
} as const

export default function EventDetail() {
  const router = useRouter()
  const params = useParams()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const fetchEvent = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('events')
        .select('*, ticket_tiers(*)')
        .eq('id', params.id)
        .single()

      if (data) {
        setEvent(data as Event)
      }
      setLoading(false)
    }
    fetchEvent()
  }, [params.id])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let raf = 0
    let t = 0

    const resize = () => {
      canvas.width = Math.round(canvas.offsetWidth * dpr)
      canvas.height = Math.round(canvas.offsetHeight * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      const W = canvas.offsetWidth
      const H = canvas.offsetHeight
      const cx = W / 2

      ctx.fillStyle = 'rgba(0,0,0,0.15)'
      ctx.fillRect(0, 0, W, H)

      // psychedelic spiraling dots
      for (let i = 0; i < 120; i++) {
        const angle = (i / 120) * Math.PI * 2 + t * 0.3
        const spiral = 10 + i * 1.8 + Math.sin(t * 0.8 + i * 0.2) * 30
        const x = cx + spiral * Math.cos(angle + Math.sin(t * 0.4 + i * 0.15))
        const y = H * 0.35 + spiral * Math.sin(angle + Math.cos(t * 0.35 + i * 0.12))
        const hue = 28 + Math.sin(t * 0.5 + i * 0.08) * 18
        const size = 1.5 + Math.sin(t * 2 + i * 0.4) * 0.8
        const alpha = 0.25 + 0.4 * Math.sin(t * 1.5 + i * 0.2)
        ctx.beginPath()
        ctx.arc(x, y, size, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue},100%,60%,${alpha})`
        ctx.fill()
      }

      // pulsing rings
      for (let i = 0; i < 5; i++) {
        const rad = 15 + i * 45 + Math.sin(t + i * 0.7) * 12
        const hue = 28 + i * 8
        ctx.beginPath()
        ctx.arc(cx, H * 0.35, rad, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${hue},100%,60%,${0.08 + 0.04 * Math.sin(t * 0.9 + i)})`
        ctx.lineWidth = 0.6
        ctx.stroke()
      }

      t += 0.014
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [])

  if (loading) {
    return (
      <div style={{minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#665'}}>
        Loading...
      </div>
    )
  }

  if (!event) {
    return (
      <div style={{minHeight: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: '#665'}}>
        Event not found
        <button onClick={() => router.push('/')} style={{padding: '10px 20px', background: COLORS.primary, color: '#000', border: 'none', borderRadius: '100px', cursor: 'pointer'}}>
          Go home
        </button>
      </div>
    )
  }

  const date = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : 'TBD'
  const time = event.starts_at
    ? new Date(event.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : ''

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        body { background:${COLORS.bg}; color:#f0f0f0; font-family:'DM Sans',sans-serif; overflow-x:hidden; }
        
        nav { padding:14px 20px; background:rgba(0,0,0,0.95); position:sticky; top:0; z-index:100; display:flex; align-items:center; gap:14px; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); border-bottom:1px solid rgba(255,170,51,0.1); }
        .back-btn { background:none; border:none; color:#665; cursor:pointer; font-size:13px; font-family:'DM Sans',sans-serif; display:inline-flex; align-items:center; gap:4px; transition:color 0.15s; }
        .back-btn:hover { color:#f0f0f0; }
        .logo { font-family:'Nunito',sans-serif; font-size:24px; font-weight:900; letter-spacing:-0.5px; color:${COLORS.primary}; cursor:pointer; text-transform:lowercase; filter:drop-shadow(0 0 8px rgba(255,170,51,0.3)); }

        .hero { position:relative; height:480px; overflow:hidden; }
        .hero-canvas { position:absolute; inset:0; width:100%; height:100%; }
        .hero-overlay { position:absolute; inset:0; background:linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.4) 50%, ${COLORS.bg} 100%); }
        .hero-content { position:relative; z-index:2; height:100%; display:flex; flex-direction:column; justify-content:flex-end; padding:0 20px 40px; max-width:900px; margin:0 auto; }
        .category-badge { display:inline-block; padding:4px 12px; background:rgba(255,170,51,0.12); border:0.5px solid rgba(255,170,51,0.25); border-radius:100px; font-size:10px; letter-spacing:1px; text-transform:uppercase; color:${COLORS.primary}; margin-bottom:12px; font-weight:600; }
        .event-title { font-family:'Barlow Condensed',sans-serif; font-size:clamp(32px,8vw,64px); font-weight:900; line-height:0.95; color:#fff; text-transform:uppercase; margin-bottom:16px; text-shadow:0 2px 20px rgba(0,0,0,0.5); }
        .event-meta { display:flex; flex-wrap:wrap; gap:20px; font-size:14px; color:rgba(255,255,255,0.7); }
        .meta-item { display:flex; align-items:center; gap:6px; }

        .content { max-width:900px; margin:0 auto; padding:40px 20px 100px; }
        .section { margin-bottom:48px; }
        .section-title { font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:900; letter-spacing:1px; text-transform:uppercase; color:#fff; margin-bottom:20px; }
        .description { font-size:15px; line-height:1.8; color:#aaa; }

        .info-grid { display:grid; gap:16px; }
        .info-card { background:rgba(255,255,255,0.03); border:0.5px solid rgba(255,255,255,0.08); border-radius:12px; padding:18px; }
        .info-label { font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#665; margin-bottom:8px; font-weight:500; }
        .info-value { font-size:16px; color:#f0f0f0; font-weight:500; }
        .info-sub { font-size:13px; color:#888; margin-top:4px; }

        .tiers-grid { display:grid; gap:14px; }
        .tier-card { background:rgba(255,255,255,0.03); border:0.5px solid rgba(255,255,255,0.08); border-radius:14px; padding:20px; transition:all 0.2s; }
        .tier-card:active { transform:scale(0.98); }
        .tier-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:14px; }
        .tier-name { font-size:18px; font-weight:600; color:#fff; }
        .tier-price { font-family:'Barlow Condensed',sans-serif; font-size:26px; font-weight:900; color:${COLORS.primary}; }
        .tier-price.free { color:${COLORS.highlight}; }
        .tier-avail { font-size:12px; color:#665; }
        .buy-btn { width:100%; background:${COLORS.primary}; color:#000; border:none; border-radius:100px; padding:14px; font-size:15px; font-weight:700; font-family:'Nunito',sans-serif; cursor:pointer; box-shadow:0 0 18px rgba(255,170,51,0.3); transition:all 0.15s; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
        .buy-btn:active { transform:scale(0.96); }
        .buy-btn:disabled { opacity:0.3; cursor:not-allowed; }

        .badge-21 { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:rgba(255,102,0,0.12); border:0.5px solid rgba(255,102,0,0.25); border-radius:100px; font-size:12px; color:${COLORS.accent}; font-weight:600; }
        .badge-dress { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; background:rgba(255,200,80,0.1); border:0.5px solid rgba(255,200,80,0.2); border-radius:100px; font-size:12px; color:${COLORS.highlight}; font-weight:500; }

        @media(min-width:600px){ .info-grid { grid-template-columns:repeat(2,1fr); } .tiers-grid { grid-template-columns:repeat(2,1fr); } }
      `}</style>

      <nav>
        <button className="back-btn" onClick={() => router.push('/')}>
          <i className="ti ti-arrow-left" style={{fontSize:'14px'}} aria-hidden="true"/>
          Back
        </button>
        <button className="logo" onClick={() => router.push('/')}>pulse</button>
      </nav>

      <div className="hero">
        <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true"/>
        <div className="hero-overlay"/>
        <div className="hero-content">
          <span className="category-badge">{event.category}</span>
          <h1 className="event-title">{event.title}</h1>
          <div className="event-meta">
            <div className="meta-item">
              <i className="ti ti-calendar" style={{fontSize:'16px'}} aria-hidden="true"/>
              {date}
            </div>
            {time && (
              <div className="meta-item">
                <i className="ti ti-clock" style={{fontSize:'16px'}} aria-hidden="true"/>
                {time}
              </div>
            )}
            <div className="meta-item">
              <i className="ti ti-map-pin" style={{fontSize:'16px'}} aria-hidden="true"/>
              {event.venue_name ?? event.city ?? 'TBD'}
            </div>
          </div>
        </div>
      </div>

      <div className="content">
        {event.description && (
          <div className="section">
            <h2 className="section-title">About this event</h2>
            <p className="description">{event.description}</p>
          </div>
        )}

        <div className="section">
          <h2 className="section-title">Tickets</h2>
          <div className="tiers-grid">
            {event.ticket_tiers && event.ticket_tiers.length > 0 ? (
              event.ticket_tiers.map(tier => {
                const available = tier.quantity - (tier.sold || 0)
                const soldOut = available <= 0
                return (
                  <div key={tier.id} className="tier-card">
                    <div className="tier-header">
                      <div>
                        <div className="tier-name">{tier.name}</div>
                        <div className="tier-avail">
                          {soldOut ? 'Sold out' : `${available} available`}
                        </div>
                      </div>
                      <div className={`tier-price ${tier.price === 0 ? 'free' : ''}`}>
                        {tier.price === 0 ? 'Free' : `$${tier.price}`}
                      </div>
                    </div>
                    <button className="buy-btn" disabled={soldOut}>
                      <i className="ti ti-ticket" style={{fontSize:'16px'}} aria-hidden="true"/>
                      {soldOut ? 'Sold out' : 'Get tickets'}
                    </button>
                  </div>
                )
              })
            ) : (
              <div style={{color:'#665', fontSize:'14px'}}>No tickets available yet</div>
            )}
          </div>
        </div>

        <div className="section">
          <h2 className="section-title">Details</h2>
          <div className="info-grid">
            <div className="info-card">
              <div className="info-label">Venue</div>
              <div className="info-value">{event.venue_name ?? 'TBD'}</div>
              {event.address && <div className="info-sub">{event.address}</div>}
              {event.city && event.state && (
                <div className="info-sub">{event.city}, {event.state}</div>
              )}
            </div>

            {event.doors_at && (
              <div className="info-card">
                <div className="info-label">Doors open</div>
                <div className="info-value">
                  {new Date(event.doors_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            )}

            {event.is_21_plus && (
              <div className="info-card">
                <div className="info-label">Age restriction</div>
                <div className="badge-21">
                  <i className="ti ti-alert-circle" style={{fontSize:'14px'}} aria-hidden="true"/>
                  21+ only · Valid ID required
                </div>
              </div>
            )}

            {event.dress_code && (
              <div className="info-card">
                <div className="info-label">Dress code</div>
                <div className="badge-dress">
                  <i className="ti ti-hanger" style={{fontSize:'14px'}} aria-hidden="true"/>
                  {event.dress_code}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}