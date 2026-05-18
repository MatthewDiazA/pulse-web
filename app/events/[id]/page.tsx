'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

type Tier = { id: string; name: string; price: number; quantity: number; sold: number }
type EventData = {
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

const FEE_RATE = 0.10

function safePrice(p: unknown): number {
  const n = Number(p)
  return isNaN(n) || n < 0 ? 0 : n
}

function totalWithFee(price: number, qty: number): string {
  const p = safePrice(price)
  if (p === 0) return 'Free'
  const total = (p + p * FEE_RATE) * qty
  return `$${total.toFixed(2)}`
}

function feeForOne(price: number): string {
  const p = safePrice(price)
  if (p === 0) return ''
  return `$${(p * FEE_RATE).toFixed(2)} fee`
}

function basePrice(price: number): string {
  const p = safePrice(price)
  if (p === 0) return 'Free'
  return `$${p.toFixed(2)}`
}

export default function EventDetail() {
  const router = useRouter()
  const params = useParams()
  const [event, setEvent] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [buyingTier, setBuyingTier] = useState<string | null>(null)
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({})
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const supabase = createClient()
    let alive = true
    supabase
      .from('events')
      .select('*, ticket_tiers(*)')
      .eq('id', params.id)
      .single()
      .then(({ data }) => {
        if (!alive) return
        if (data) setEvent(data as EventData)
        setLoading(false)
      })
    return () => { alive = false }
  }, [params.id])

  // Saint Pablo animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
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
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(0, 0, W, H)

      const cols = W < 600 ? 8 : 12
      const rows = W < 600 ? 5 : 7
      const sx = W / (cols + 1)
      const sy = (H * 0.75) / (rows + 1)

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = sx * (c + 1)
          const by = 15 + sy * (r + 1)
          const wave = Math.sin(t * 1.3 + c * 0.5 + r * 0.7) * 0.5 + 0.5
          const pulse = Math.sin(t * 2.4 + (c + r) * 0.3) * 0.3 + 0.7
          const intensity = wave * pulse
          const hue = 28 + Math.sin(t * 0.4 + c * 0.14) * 14
          const sat = 90 + intensity * 10
          const light = 30 + intensity * 42
          const alpha = 0.1 + intensity * 0.72

          ctx.fillStyle = `hsla(${hue},${sat}%,${light}%,${alpha * 0.2})`
          ctx.beginPath()
          ctx.arc(bx, by, 6 + intensity * 10, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = `hsla(${hue},${sat}%,${light + 15}%,${alpha * 0.5})`
          ctx.beginPath()
          ctx.arc(bx, by, 3 + intensity * 4, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = `hsla(${hue},${sat}%,${light + 30}%,${alpha})`
          ctx.beginPath()
          ctx.arc(bx, by, 2, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      for (let i = 0; i < 8; i++) {
        const baseAngle = -Math.PI * 0.82 + (i / 7) * Math.PI * 0.64
        const sway = Math.sin(t * 0.55 + i * 0.8) * 0.07
        const angle = baseAngle + sway
        const len = H * 1.3
        const ex = cx + Math.cos(angle) * len
        const ey = Math.sin(angle) * len
        const rayA = 0.02 + 0.018 * Math.sin(t * 0.7 + i)
        const grad = ctx.createLinearGradient(cx, 0, ex, ey)
        grad.addColorStop(0, `rgba(255,150,30,${rayA * 5})`)
        grad.addColorStop(0.3, `rgba(255,100,10,${rayA})`)
        grad.addColorStop(1, 'rgba(255,60,0,0)')
        ctx.beginPath()
        ctx.moveTo(cx - 15, 0)
        ctx.lineTo(cx + 15, 0)
        ctx.lineTo(ex + 40, ey)
        ctx.lineTo(ex - 40, ey)
        ctx.closePath()
        ctx.fillStyle = grad
        ctx.fill()
      }

      for (let i = 0; i < 50; i++) {
        const angle = (i / 50) * Math.PI * 2 + t * 0.22
        const spiral = 15 + i * 2.5 + Math.sin(t * 0.8 + i * 0.22) * 20
        const x = cx + spiral * Math.cos(angle + Math.sin(t * 0.3 + i * 0.1))
        const y = H * 0.4 + spiral * Math.sin(angle + Math.cos(t * 0.25 + i * 0.08)) * 0.55
        const hue = 22 + Math.sin(t * 0.45 + i * 0.1) * 18
        const sz = 1.2 + Math.sin(t * 2 + i * 0.5) * 0.5
        const a = 0.12 + 0.28 * Math.sin(t * 1.4 + i * 0.2)
        ctx.beginPath()
        ctx.arc(x, y, sz, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${hue},100%,65%,${a})`
        ctx.fill()
      }

      const fog = ctx.createRadialGradient(cx, H * 0.45, 0, cx, H * 0.45, W * 0.5)
      fog.addColorStop(0, `rgba(255,120,20,${0.04 + 0.025 * Math.sin(t * 0.6)})`)
      fog.addColorStop(0.5, `rgba(255,80,0,${0.015 + 0.01 * Math.sin(t * 0.4)})`)
      fog.addColorStop(1, 'rgba(255,50,0,0)')
      ctx.fillStyle = fog
      ctx.fillRect(0, 0, W, H)

      const crowd = ctx.createLinearGradient(0, H * 0.75, 0, H)
      crowd.addColorStop(0, 'rgba(0,0,0,0)')
      crowd.addColorStop(1, `rgba(255,70,5,${0.035 + 0.02 * Math.sin(t * 0.3)})`)
      ctx.fillStyle = crowd
      ctx.fillRect(0, H * 0.75, W, H * 0.25)
    }

    const loop = () => {
      t += 0.014
      drawFrame()
      raf = requestAnimationFrame(loop)
    }

    if (prefersReduced) drawFrame()
    else loop()

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf)
      else if (!prefersReduced) loop()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
      cancelAnimationFrame(raf)
    }
  }, [])

  const handleBuyTicket = async (tier: Tier) => {
    setBuyingTier(tier.id)
    const qty = selectedQty[tier.id] || 1
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierId: tier.id,
          eventId: event?.id,
          quantity: qty,
          userId: user.id,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(data.error ?? 'Something went wrong')
      }
    } catch {
      alert('Failed to start checkout. Please try again.')
    } finally {
      setBuyingTier(null)
    }
  }

  if (loading) {
    return (
      <>
        <style>{`body{background:#000;margin:0;}`}</style>
        <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{width:'28px',height:'28px',border:`2px solid ${COLORS.primary}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </>
    )
  }

  if (!event) {
    return (
      <>
        <style>{`body{background:#000;margin:0;}`}</style>
        <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'16px',fontFamily:'DM Sans,sans-serif',color:'#665'}}>
          <div style={{fontSize:'48px',opacity:0.3}}>404</div>
          <div>Event not found</div>
          <button onClick={() => router.push('/')} style={{padding:'12px 24px',background:COLORS.primary,color:'#000',border:'none',borderRadius:'100px',cursor:'pointer',fontSize:'14px',fontWeight:700,fontFamily:'Nunito,sans-serif'}}>Go home</button>
        </div>
      </>
    )
  }

  const date = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })
    : 'TBD'
  const time = event.starts_at
    ? new Date(event.starts_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })
    : ''
  const doorsTime = event.doors_at
    ? new Date(event.doors_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })
    : null
  const location = [event.venue_name, event.city, event.state].filter(Boolean).join(', ')

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@700;900&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:${COLORS.bg};color:#f0f0f0;font-family:'DM Sans',sans-serif;overflow-x:hidden;}

        nav{padding:14px 20px;background:rgba(0,0,0,0.95);position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:14px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);}
        nav::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,${COLORS.accent},${COLORS.primary},${COLORS.highlight},transparent);background-size:300% 100%;animation:navGlow 5s ease-in-out infinite;}
        @keyframes navGlow{0%{background-position:0% 50%;opacity:0.2}50%{background-position:100% 50%;opacity:0.8}100%{background-position:0% 50%;opacity:0.2}}
        .back-btn{background:none;border:none;color:#665;cursor:pointer;font-size:13px;font-family:'DM Sans',sans-serif;display:inline-flex;align-items:center;gap:4px;transition:color 0.15s;}
        .back-btn:hover{color:#f0f0f0;}
        .nav-logo{font-family:'Nunito',sans-serif;font-size:24px;font-weight:900;color:${COLORS.primary};cursor:pointer;text-transform:lowercase;filter:drop-shadow(0 0 8px rgba(255,170,51,0.4));background:none;border:none;padding:0;}

        .hero{position:relative;height:480px;overflow:hidden;}
        .hero-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0;}
        .hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;}
        .hero-overlay{position:absolute;inset:0;z-index:2;background:linear-gradient(to bottom,rgba(0,0,0,0.15) 0%,rgba(0,0,0,0.55) 55%,${COLORS.bg} 100%);}
        .hero-content{position:relative;z-index:3;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:0 20px 36px;max-width:900px;margin:0 auto;}
        .cat-badge{display:inline-flex;padding:4px 12px;background:rgba(255,170,51,0.14);border:0.5px solid rgba(255,170,51,0.28);border-radius:100px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${COLORS.primary};margin-bottom:12px;font-weight:600;width:fit-content;}
        .ev-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(34px,9vw,68px);font-weight:900;line-height:0.92;color:#fff;text-transform:uppercase;margin-bottom:14px;text-shadow:0 4px 30px rgba(0,0,0,0.7);}
        .ev-meta{display:flex;flex-wrap:wrap;gap:16px;font-size:13px;color:rgba(255,255,255,0.7);}
        .meta-item{display:flex;align-items:center;gap:5px;}

        .content{max-width:900px;margin:0 auto;padding:36px 20px 120px;}
        .two-col{display:grid;gap:36px;}
        @media(min-width:700px){.two-col{grid-template-columns:1fr 340px;}}

        .section{margin-bottom:32px;}
        .sec-title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#fff;margin-bottom:14px;}
        .desc{font-size:14px;line-height:1.85;color:#999;}

        .details-compact{display:flex;flex-wrap:wrap;gap:8px;}
        .detail-chip{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:rgba(255,255,255,0.03);border:0.5px solid rgba(255,255,255,0.08);border-radius:10px;font-size:13px;color:#ccc;}
        .detail-chip i{color:${COLORS.primary};font-size:14px;}
        .detail-chip.warn{background:rgba(255,102,0,0.08);border-color:rgba(255,102,0,0.18);color:${COLORS.accent};}
        .detail-chip.dress{background:rgba(255,200,80,0.06);border-color:rgba(255,200,80,0.14);color:${COLORS.highlight};}

        .tickets-panel{position:sticky;top:80px;}
        .ticket-card{background:rgba(255,255,255,0.03);border:0.5px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;margin-bottom:12px;transition:border-color 0.2s;}
        .ticket-card:hover{border-color:rgba(255,170,51,0.15);}
        .tier-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;}
        .tier-name{font-size:16px;font-weight:600;color:#fff;}
        .tier-price{font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:900;color:${COLORS.primary};line-height:1;}
        .tier-price.free{color:${COLORS.highlight};}
        .tier-breakdown{font-size:11px;color:#554;text-align:right;}
        .tier-avail{font-size:12px;color:#665;margin:6px 0 12px;}
        .qty-row{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
        .qty-label{font-size:12px;color:#776;}
        .qty-select{background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 10px;color:#f0f0f0;font-size:14px;font-family:'DM Sans',sans-serif;outline:none;cursor:pointer;-webkit-appearance:none;}
        .buy-btn{width:100%;background:${COLORS.primary};color:#000;border:none;border-radius:100px;padding:14px;font-size:15px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;box-shadow:0 0 20px rgba(255,170,51,0.3);transition:all 0.15s;display:inline-flex;align-items:center;justify-content:center;gap:8px;}
        .buy-btn:hover{box-shadow:0 0 30px rgba(255,170,51,0.45);}
        .buy-btn:active{transform:scale(0.96);}
        .buy-btn:disabled{opacity:0.35;cursor:not-allowed;box-shadow:none;}
        .soldout-btn{width:100%;background:rgba(255,255,255,0.05);color:#554;border:0.5px solid rgba(255,255,255,0.08);border-radius:100px;padding:14px;font-size:15px;font-weight:600;font-family:'DM Sans',sans-serif;cursor:not-allowed;text-align:center;}
        .fee-note{font-size:11px;color:#554;text-align:center;margin-top:6px;}

        @media(prefers-reduced-motion:reduce){nav::after{animation:none!important;}}
      `}</style>

      <nav>
        <button className="back-btn" onClick={() => router.back()}>
          <i className="ti ti-arrow-left" style={{fontSize:'15px'}} aria-hidden="true"/>
          Back
        </button>
        <button className="nav-logo" onClick={() => router.push('/')}>pulse</button>
      </nav>

      <div className="hero">
        <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true"/>
        {event.cover_image_url && (
          <img src={event.cover_image_url} className="hero-img" alt={event.title}/>
        )}
        <div className="hero-overlay"/>
        <div className="hero-content">
          <div className="cat-badge">{event.category}</div>
          <h1 className="ev-title">{event.title}</h1>
          <div className="ev-meta">
            <span className="meta-item">
              <i className="ti ti-calendar" style={{fontSize:'15px',color:COLORS.primary}} aria-hidden="true"/>
              {date}
            </span>
            {time && (
              <span className="meta-item">
                <i className="ti ti-clock" style={{fontSize:'15px',color:COLORS.primary}} aria-hidden="true"/>
                {time}
              </span>
            )}
            {location && (
              <span className="meta-item">
                <i className="ti ti-map-pin" style={{fontSize:'15px',color:COLORS.primary}} aria-hidden="true"/>
                {location}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="content">
        <div className="two-col">
          <div>
            {event.description && (
              <div className="section">
                <h2 className="sec-title">About</h2>
                <p className="desc">{event.description}</p>
              </div>
            )}

            <div className="section">
              <h2 className="sec-title">Details</h2>
              <div className="details-compact">
                <div className="detail-chip">
                  <i className="ti ti-calendar-event" aria-hidden="true"/>
                  {date}{time ? ` · ${time}` : ''}
                </div>
                {doorsTime && (
                  <div className="detail-chip">
                    <i className="ti ti-door" aria-hidden="true"/>
                    Doors {doorsTime}
                  </div>
                )}
                {event.venue_name && (
                  <div className="detail-chip">
                    <i className="ti ti-building" aria-hidden="true"/>
                    {event.venue_name}
                  </div>
                )}
                {event.address && (
                  <div className="detail-chip">
                    <i className="ti ti-map-pin" aria-hidden="true"/>
                    {event.address}{event.city ? `, ${event.city}` : ''}{event.state ? ` ${event.state}` : ''}
                  </div>
                )}
                {event.is_21_plus && (
                  <div className="detail-chip warn">
                    <i className="ti ti-id" aria-hidden="true"/>
                    21+ · ID required
                  </div>
                )}
                {event.dress_code && (
                  <div className="detail-chip dress">
                    <i className="ti ti-hanger" aria-hidden="true"/>
                    {event.dress_code}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="tickets-panel">
            <h2 className="sec-title">Tickets</h2>
            {event.ticket_tiers && event.ticket_tiers.length > 0 ? (
              event.ticket_tiers.map(tier => {
                const price = safePrice(tier.price)
                const available = tier.quantity - (tier.sold || 0)
                const soldOut = available <= 0
                const qty = selectedQty[tier.id] || 1
                const isBuying = buyingTier === tier.id

                return (
                  <div key={tier.id} className="ticket-card">
                    <div className="tier-row">
                      <div className="tier-name">{tier.name}</div>
                      <div>
                        <div className={`tier-price ${price === 0 ? 'free' : ''}`}>
                          {totalWithFee(price, 1)}
                        </div>
                        {price > 0 && (
                          <div className="tier-breakdown">{basePrice(price)} + {feeForOne(price)}</div>
                        )}
                      </div>
                    </div>
                    <div className="tier-avail">
                      {soldOut ? 'Sold out' : available <= 20 ? `Only ${available} left` : `${available} available`}
                    </div>

                    {!soldOut && (
                      <div className="qty-row">
                        <span className="qty-label">Qty</span>
                        <select
                          className="qty-select"
                          value={qty}
                          onChange={e => setSelectedQty(prev => ({...prev, [tier.id]: parseInt(e.target.value)}))}
                        >
                          {Array.from({length: Math.min(available, 10)}).map((_, i) => (
                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                          ))}
                        </select>
                        {price > 0 && qty > 1 && (
                          <span className="qty-label">Total: {totalWithFee(price, qty)}</span>
                        )}
                      </div>
                    )}

                    {soldOut ? (
                      <div className="soldout-btn">Sold out</div>
                    ) : (
                      <button
                        className="buy-btn"
                        disabled={isBuying}
                        onClick={() => handleBuyTicket(tier)}
                      >
                        <i className="ti ti-ticket" style={{fontSize:'16px'}} aria-hidden="true"/>
                        {isBuying
                          ? 'Processing...'
                          : price === 0
                            ? 'RSVP — Free'
                            : `Get tickets · ${totalWithFee(price, qty)}`}
                      </button>
                    )}
                    {price > 0 && !soldOut && (
                      <div className="fee-note">Includes 10% service fee</div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="ticket-card" style={{textAlign:'center',padding:'36px 20px'}}>
                <div style={{fontSize:'14px',color:'#665',marginBottom:'8px'}}>Tickets not available yet</div>
                <div style={{fontSize:'12px',color:'#443'}}>Check back soon</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}