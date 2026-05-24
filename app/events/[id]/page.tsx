'use client'
import { useEffect, useState, useRef } from 'react'
import { useMagneticButton, usePageReveal, useNavLogo } from '../../lib/animations'
import TouchBlot from '../../components/TouchBlot'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import EventLounge from '../../components/EventLounge'

type Tier = { id: string; name: string; price: number; quantity: number; quantity_sold: number }
type EventData = {
  id: string
  host_id: string
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
  feed_video_url: string | null
  tagline: string | null
  instagram_handle: string | null
  tiktok_url: string | null
  spotify_playlist_url: string | null
  ticket_tiers: Tier[]
}

function spotifyEmbed(url: string): string | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('spotify.com')) return null
    const parts = u.pathname.split('/').filter(Boolean).filter(p => !/^intl-/i.test(p))
    if (parts.length < 2) return null
    const [type, id] = parts
    return `https://open.spotify.com/embed/${type}/${id.split('?')[0]}?autoplay=1`
  } catch {
    return null
  }
}

function igUrl(handle: string): string {
  const clean = handle.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/+$/, '')
  return `https://www.instagram.com/${clean}/`
}

const COLORS = {
  primary: '#ffaa33',
  accent: '#ff6600',
  highlight: '#ffc850',
  bg: '#000',
} as const

const FEE_RATE = 0.10 // internal only — not shown to customer

function safePrice(p: unknown): number {
  const n = Number(p)
  return isNaN(n) || n < 0 ? 0 : n
}

function displayPrice(price: number, qty: number): string {
  const p = safePrice(price)
  if (p === 0) return 'Free'
  return `$${(p * qty).toFixed(2)}`
}

// Converts trailing Arabic numbers in tier names to Roman numerals
// "GA 2" → "GA II", "GA 3" → "GA III", "GA" → "GA", "VIP 2" → "VIP II"
function toRomanTierName(name: string): string {
  const map: Record<string, string> = {
    '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V',
    '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X',
  }
  return name.replace(/\b(\d+)\b/g, (n) => map[n] ?? n)
}

export default function EventDetail() {
  const router = useRouter()
  const params = useParams()
  const logoRef = useNavLogo<HTMLButtonElement>()
  const buyBtnRef = useMagneticButton<HTMLButtonElement>()
  usePageReveal({ selectors: ['.cat-badge', '.ev-title', '.ev-meta', '.section', '.tickets-panel'], delay: 0.2 })
  const [event, setEvent] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [buyingTier, setBuyingTier] = useState<string | null>(null)
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({})
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  // Spotify autoplay state
  const [soundOpen, setSoundOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null | undefined>(undefined)
  const [soundMeta, setSoundMeta] = useState<{ title: string; artist: string } | null>(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
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

  // Resolve Spotify preview MP3 once the event is loaded
  useEffect(() => {
    if (!event?.spotify_playlist_url) { setPreviewUrl(null); return }
    let alive = true
    fetch(`/api/spotify-preview?url=${encodeURIComponent(event.spotify_playlist_url)}`)
      .then(r => r.json())
      .then(d => {
        if (!alive) return
        setPreviewUrl(d.preview ?? null)
        if (d.title) setSoundMeta({ title: d.title, artist: d.artist ?? '' })
      })
      .catch(() => { if (alive) setPreviewUrl(null) })
    return () => { alive = false }
  }, [event?.spotify_playlist_url])

  // Create the audio element
  useEffect(() => {
    const a = new Audio()
    a.loop = true
    audioRef.current = a
    return () => { a.pause(); a.src = '' }
  }, [])

  const toggleSound = () => {
    const a = audioRef.current
    if (!a || !previewUrl) return
    if (playing) {
      a.pause()
      setPlaying(false)
    } else {
      if (a.src !== previewUrl) a.src = previewUrl
      a.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }
  }

  // Fetch current user + admin status
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setCurrentUser(data.user)
        const { data: admin } = await supabase
          .from('admins')
          .select('user_id')
          .eq('user_id', data.user.id)
          .single()
        if (admin) setIsAdmin(true)
      }
    })
  }, [])

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
        <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'16px',fontFamily:'Syne,sans-serif',color:'#665'}}>
          <div style={{fontSize:'48px',opacity:0.3}}>404</div>
          <div>Event not found</div>
          <button onClick={() => router.push('/')} style={{padding:'12px 24px',background:COLORS.primary,color:'#000',border:'none',borderRadius:'100px',cursor:'pointer',fontSize:'14px',fontWeight:700,fontFamily:'Syne,sans-serif'}}>Go home</button>
        </div>
      </>
    )
  }

  const date = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:'UTC' })
    : 'TBD'
  const time = event.starts_at
    ? new Date(event.starts_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone:'UTC' })
    : ''
  const doorsTime = event.doors_at
    ? new Date(event.doors_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', timeZone:'UTC' })
    : null
  const location = [event.venue_name, event.city, event.state].filter(Boolean).join(', ')
  const hasSocial = event.instagram_handle || event.tiktok_url

  return (
    <>
      <TouchBlot />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Syne:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:${COLORS.bg};color:#f0f0f0;font-family:'Syne',sans-serif;overflow-x:hidden;}
        nav{padding:14px 20px;background:rgba(0,0,0,0.95);position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:14px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);}
        nav::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,${COLORS.accent},${COLORS.primary},${COLORS.highlight},transparent);background-size:300% 100%;animation:navGlow 5s ease-in-out infinite;}
        @keyframes navGlow{0%{background-position:0% 50%;opacity:0.2}50%{background-position:100% 50%;opacity:0.8}100%{background-position:0% 50%;opacity:0.2}}
        .back-btn{background:none;border:none;color:#665;cursor:pointer;font-size:13px;font-family:'Syne',sans-serif;display:inline-flex;align-items:center;gap:4px;transition:color 0.15s;}
        .back-btn:hover{color:#f0f0f0;}
        .nav-logo{cursor:pointer;background:none;border:none;padding:0;flex:1;display:flex;justify-content:center;line-height:0;}
        .nav-logo .logo-img{height:22px;width:auto;filter:drop-shadow(0 0 10px rgba(255,170,51,0.4));}
        @media(max-width:680px){.nav-logo .logo-img{height:20px;}}
        .edit-event-btn{background:rgba(255,170,51,0.1);border:0.5px solid rgba(255,170,51,0.3);color:${COLORS.primary};font-size:13px;font-family:'Syne',sans-serif;font-weight:600;padding:7px 14px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all 0.15s;white-space:nowrap;}
        .edit-event-btn:hover{background:rgba(255,170,51,0.16);border-color:rgba(255,170,51,0.5);}
        .edit-event-btn:active{transform:scale(0.96);}
        .hero{position:relative;height:480px;overflow:hidden;}
        .hero-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0;}
        .hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;}
        .hero-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;}
        .hero-overlay{position:absolute;inset:0;z-index:2;background:linear-gradient(to bottom,rgba(0,0,0,0.15) 0%,rgba(0,0,0,0.55) 55%,${COLORS.bg} 100%);}
        .hero-content{position:relative;z-index:3;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:0 20px 36px;max-width:900px;margin:0 auto;}
        .cat-badge{display:inline-flex;padding:4px 12px;background:rgba(255,170,51,0.14);border:0.5px solid rgba(255,170,51,0.28);border-radius:100px;font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${COLORS.primary};margin-bottom:12px;font-weight:600;width:fit-content;}
        .ev-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(34px,9vw,68px);font-weight:900;line-height:0.92;color:#fff;text-transform:uppercase;margin-bottom:14px;text-shadow:0 4px 30px rgba(0,0,0,0.7);}
        .ev-meta{display:flex;flex-wrap:wrap;gap:16px;font-size:13px;color:rgba(255,255,255,0.7);}
        .meta-item{display:flex;align-items:center;gap:5px;}
        .content{max-width:900px;margin:0 auto;padding:36px 20px 120px;}
        .two-col{display:grid;gap:36px;}
        @media(min-width:700px){.two-col{grid-template-columns:1fr 340px;}}
        .section{margin-bottom:28px;}
        .sec-title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:900;letter-spacing:1px;text-transform:uppercase;color:#fff;margin-bottom:14px;}
        .desc{font-size:14px;line-height:1.85;color:#999;}
        .details-compact{display:flex;flex-wrap:wrap;gap:8px;}
        .detail-chip{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;background:rgba(255,255,255,0.03);border:0.5px solid rgba(255,255,255,0.08);border-radius:10px;font-size:13px;color:#ccc;}
        .detail-chip i{color:${COLORS.primary};font-size:14px;}
        .detail-chip.warn{background:rgba(255,102,0,0.08);border-color:rgba(255,102,0,0.18);color:${COLORS.accent};}
        .detail-chip.dress{background:rgba(255,200,80,0.06);border-color:rgba(255,200,80,0.14);color:${COLORS.highlight};}
        /* compact inline social links under details */
        .social-links{display:flex;gap:10px;margin-top:14px;}
        .social-link{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);color:#ccc;font-size:19px;cursor:pointer;transition:all 0.15s;text-decoration:none;}
        .social-link:hover{border-color:rgba(255,170,51,0.4);color:${COLORS.primary};transform:translateY(-1px);}
        /* compact sound bar */
        .sound-bar{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.03);border:0.5px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 14px;cursor:pointer;transition:all 0.15s;}
        .sound-bar:hover{border-color:rgba(255,170,51,0.3);}
        .sound-play{width:40px;height:40px;border-radius:50%;background:${COLORS.primary};color:#000;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;}
        .sound-info{flex:1;min-width:0;}
        .sound-label{font-family:'Syne',sans-serif;font-size:13px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .sound-sub{font-family:'Syne',sans-serif;font-size:11px;color:#776;margin-top:1px;}
        .sound-eq{display:flex;align-items:flex-end;gap:2px;height:16px;flex-shrink:0;}
        .sound-eq span{width:3px;background:${COLORS.primary};border-radius:2px;animation:eq 0.9s ease-in-out infinite;}
        .sound-eq span:nth-child(2){animation-delay:0.15s}
        .sound-eq span:nth-child(3){animation-delay:0.3s}
        .sound-eq span:nth-child(4){animation-delay:0.45s}
        @keyframes eq{0%,100%{height:4px}50%{height:16px}}
        .spotify-fallback{border-radius:12px;overflow:hidden;border:0.5px solid rgba(255,255,255,0.08);margin-top:4px;}
        .tickets-panel{position:sticky;top:80px;}
        .ticket-card{background:rgba(255,255,255,0.03);border:0.5px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;margin-bottom:12px;transition:border-color 0.2s;}
        .ticket-card:hover{border-color:rgba(255,170,51,0.15);}
        .tier-row{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;}
        .tier-name{font-size:16px;font-weight:600;color:#fff;}
        .tier-price{font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:900;color:${COLORS.primary};line-height:1;}
        .tier-price.free{color:${COLORS.highlight};}
        .tier-avail{font-size:12px;color:#665;margin:6px 0 12px;}
        .qty-row{display:flex;align-items:center;gap:10px;margin-bottom:12px;}
        .qty-label{font-size:12px;color:#776;}
        .qty-select{background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 10px;color:#f0f0f0;font-size:14px;font-family:'Syne',sans-serif;outline:none;cursor:pointer;-webkit-appearance:none;}
        .buy-btn{width:100%;background:${COLORS.primary};color:#000;border:none;border-radius:100px;padding:14px;font-size:15px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;box-shadow:0 0 20px rgba(255,170,51,0.3);transition:all 0.15s;display:inline-flex;align-items:center;justify-content:center;gap:8px;}
        .buy-btn:hover{box-shadow:0 0 30px rgba(255,170,51,0.45);}
        .buy-btn:active{transform:scale(0.96);}
        .buy-btn:disabled{opacity:0.35;cursor:not-allowed;box-shadow:none;}
        .soldout-btn{width:100%;background:rgba(255,255,255,0.05);color:#554;border:0.5px solid rgba(255,255,255,0.08);border-radius:100px;padding:14px;font-size:15px;font-weight:600;font-family:'Syne',sans-serif;cursor:not-allowed;text-align:center;}
        .comment-form{background:rgba(255,255,255,0.03);border:0.5px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;margin-bottom:24px;}
        .comment-top-row{display:flex;gap:10px;margin-bottom:12px;align-items:center;}
        .avatar-btn{width:40px;height:40px;border-radius:50%;border:1.5px solid rgba(255,170,51,0.3);display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;transition:all 0.15s;flex-shrink:0;position:relative;}
        .avatar-btn:hover{border-color:rgba(255,170,51,0.6);transform:scale(1.05);}
        .avatar-picker{position:absolute;top:48px;left:0;background:#1a1000;border:0.5px solid rgba(255,170,51,0.25);border-radius:12px;padding:10px;display:grid;grid-template-columns:repeat(6,1fr);gap:6px;z-index:50;box-shadow:0 12px 40px rgba(0,0,0,0.8);}
        .avatar-option{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;border:1.5px solid transparent;transition:all 0.15s;}
        .avatar-option:hover{transform:scale(1.15);}
        .avatar-option.selected{border-color:${COLORS.primary};background:rgba(255,170,51,0.1);}
        .comment-input{width:100%;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 14px;color:#fff;font-size:14px;font-family:'Syne',sans-serif;outline:none;resize:none;min-height:70px;}
        .comment-input:focus{border-color:rgba(255,170,51,0.3);}
        .comment-input::placeholder{color:#444;}
        .post-btn{background:${COLORS.primary};color:#000;border:none;border-radius:100px;padding:10px 24px;font-size:13px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;margin-top:10px;transition:all 0.15s;float:right;}
        .post-btn:hover{box-shadow:0 0 16px rgba(255,170,51,0.3);}
        .post-btn:active{transform:scale(0.96);}
        .post-btn:disabled{opacity:0.3;cursor:not-allowed;}
        .comment-list{display:flex;flex-direction:column;gap:12px;}
        .comment-card{display:flex;gap:12px;padding:16px;background:rgba(255,255,255,0.02);border:0.5px solid rgba(255,255,255,0.06);border-radius:12px;transition:border-color 0.2s;}
        .comment-card:hover{border-color:rgba(255,255,255,0.1);}
        .comment-avatar{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
        .comment-body{flex:1;min-width:0;}
        .comment-header{display:flex;align-items:center;gap:8px;margin-bottom:4px;}
        .comment-name{font-size:13px;font-weight:600;color:#f0f0f0;cursor:pointer;transition:color 0.15s;}
        .comment-name:hover{color:${COLORS.primary};}
        .comment-time{font-size:11px;color:#443;}
        .comment-text{font-size:14px;color:#bbb;line-height:1.6;}
        .comment-actions{display:flex;gap:12px;margin-top:6px;}
        .comment-action{font-size:11px;color:#554;background:none;border:none;cursor:pointer;font-family:'Syne',sans-serif;transition:color 0.15s;padding:0;}
        .comment-action:hover{color:#f0f0f0;}
        .comment-action.delete:hover{color:#ff6666;}
        .edit-input{width:100%;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,170,51,0.3);border-radius:8px;padding:8px 12px;color:#fff;font-size:14px;font-family:'Syne',sans-serif;outline:none;resize:none;min-height:50px;margin-top:6px;}
        .edit-actions{display:flex;gap:8px;margin-top:6px;}
        .edit-save{font-size:12px;color:#000;background:${COLORS.primary};border:none;border-radius:6px;padding:5px 14px;cursor:pointer;font-family:'Syne',sans-serif;font-weight:600;}
        .edit-cancel{font-size:12px;color:#888;background:none;border:0.5px solid rgba(255,255,255,0.1);border-radius:6px;padding:5px 14px;cursor:pointer;font-family:'Syne',sans-serif;}
        .login-prompt{text-align:center;padding:20px;background:rgba(255,255,255,0.02);border:0.5px solid rgba(255,255,255,0.06);border-radius:12px;margin-bottom:24px;}
        .login-prompt-text{font-size:14px;color:#665;margin-bottom:10px;}
        .login-prompt-btn{background:${COLORS.primary};color:#000;border:none;border-radius:100px;padding:10px 24px;font-size:13px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;transition:all 0.15s;}
        .login-prompt-btn:hover{box-shadow:0 0 16px rgba(255,170,51,0.3);}
        @media(max-width:700px){
          .hero{height:62vh;min-height:380px;}
          .content{padding:24px 18px 90px;}
          .two-col{gap:24px;}
          .ev-meta{gap:10px 14px;}
        }
        @media(prefers-reduced-motion:reduce){nav::after,.sound-eq span{animation:none!important;}}
      `}</style>

      <nav>
        <button className="back-btn" onClick={() => router.back()}>
          <i className="ti ti-arrow-left" style={{fontSize:'15px'}} aria-hidden="true"/>
          Back
        </button>
        <button ref={logoRef} className="nav-logo" onClick={() => router.push('/')} aria-label="Pulse home">
          <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
        </button>
        {(isAdmin || currentUser?.id === event.host_id) ? (
          <button className="edit-event-btn" onClick={() => router.push(`/host/edit/${event.id}`)}>
            <i className="ti ti-pencil" style={{fontSize:'14px'}} aria-hidden="true"/>
            Edit
          </button>
        ) : (
          <div style={{width:'60px'}}/>
        )}
      </nav>

      <div className="hero">
        <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true"/>
        {event.feed_video_url ? (
          <video
            className="hero-video"
            src={event.feed_video_url}
            autoPlay
            muted
            loop
            playsInline
            poster={event.cover_image_url ?? undefined}
          />
        ) : event.cover_image_url ? (
          <img src={event.cover_image_url} className="hero-img" alt={event.title}/>
        ) : null}
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

            {/* Sound — compact bar, autoplays preview when available */}
            {event.spotify_playlist_url && (
              <div className="section">
                <h2 className="sec-title">Sound</h2>
                {previewUrl ? (
                  <div className="sound-bar" onClick={toggleSound}>
                    <div className="sound-play">
                      <i className={`ti ${playing ? 'ti-player-pause-filled' : 'ti-player-play-filled'}`} aria-hidden="true"/>
                    </div>
                    <div className="sound-info">
                      <div className="sound-label">{soundMeta?.title ?? 'Preview the night'}</div>
                      <div className="sound-sub">{soundMeta?.artist || 'Tap to play a 30-second preview'}</div>
                    </div>
                    {playing && (
                      <div className="sound-eq"><span/><span/><span/><span/></div>
                    )}
                  </div>
                ) : previewUrl === null ? (
                  // No preview available — fall back to the compact Spotify embed
                  spotifyEmbed(event.spotify_playlist_url) && (
                    <div className="spotify-fallback">
                      <iframe
                        src={spotifyEmbed(event.spotify_playlist_url)!}
                        width="100%"
                        height="152"
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        title="Spotify player"
                        style={{display:'block'}}
                      />
                    </div>
                  )
                ) : (
                  <div className="sound-bar" style={{cursor:'default',opacity:0.6}}>
                    <div className="sound-play"><i className="ti ti-loader-2" aria-hidden="true"/></div>
                    <div className="sound-info"><div className="sound-label">Loading sound…</div></div>
                  </div>
                )}
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

              {/* tiny inline social icon-links under the details */}
              {hasSocial && (
                <div className="social-links">
                  {event.instagram_handle && (
                    <a className="social-link" href={igUrl(event.instagram_handle)} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                      <i className="ti ti-brand-instagram" aria-hidden="true"/>
                    </a>
                  )}
                  {event.tiktok_url && (
                    <a className="social-link" href={event.tiktok_url} target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                      <i className="ti ti-brand-tiktok" aria-hidden="true"/>
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="tickets-panel">
            <h2 className="sec-title">Tickets</h2>
            {event.ticket_tiers && event.ticket_tiers.length > 0 ? (
              [...event.ticket_tiers].sort((a, b) => safePrice(a.price) - safePrice(b.price)).map(tier => {
                const price = safePrice(tier.price)
                const available = tier.quantity - (tier.quantity_sold || 0)
                const soldOut = available <= 0
                const qty = selectedQty[tier.id] || 1
                const isBuying = buyingTier === tier.id
                return (
                  <div key={tier.id} className="ticket-card">
                    <div className="tier-row">
                      <div className="tier-name">{toRomanTierName(tier.name)}</div>
                      <div>
                        <div className={`tier-price ${price === 0 ? 'free' : ''}`}>
                          {displayPrice(price, 1)}
                        </div>
                      </div>
                    </div>
                    {soldOut && (
                      <div className="tier-avail">Sold out</div>
                    )}
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
                          <span className="qty-label">Total: {displayPrice(price, qty)}</span>
                        )}
                      </div>
                    )}
                    {soldOut ? (
                      <div className="soldout-btn">Sold out</div>
                    ) : (
                      <button
                        ref={buyBtnRef}
                        className="buy-btn"
                        disabled={isBuying}
                        onClick={() => handleBuyTicket(tier)}
                      >
                        <i className="ti ti-ticket" style={{fontSize:'16px'}} aria-hidden="true"/>
                        {isBuying
                          ? 'Processing...'
                          : price === 0
                            ? 'RSVP — Free'
                            : `Get tickets · ${displayPrice(price, qty)}`}
                      </button>
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

      {event && (
        <EventLounge
          eventId={event.id}
          eventTitle={event.title}
          hostId={event.host_id}
        />
      )}
    </>
  )
}