'use client'
import { useEffect, useState, useRef } from 'react'
import { useMagneticButton, usePageReveal, useNavLogo } from '../../lib/animations'
import TouchBlot from '../../components/TouchBlot'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { usePageView } from '../../lib/usePageView'
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
    // theme=0 renders the dark variant instead of the artwork-tinted default
    return `https://open.spotify.com/embed/${type}/${id.split('?')[0]}?theme=0`
  } catch { return null }
}

function igUrl(handle: string): string {
  const clean = handle.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/+$/, '')
  return `https://www.instagram.com/${clean}/`
}

const COLORS = { primary: '#ffaa33', bg: '#000' } as const
const FEE_RATE = 0.10

function safePrice(p: unknown): number {
  const n = Number(p)
  return isNaN(n) || n < 0 ? 0 : n
}

// $10 not $10.00 — trailing zeros read like a receipt
function money(n: number): string {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`
}

function displayPrice(price: number, qty: number): string {
  const p = safePrice(price)
  if (p === 0) return 'free'
  return money(p * qty)
}

// "10:00 PM" -> "10pm", "10:30 PM" -> "10:30pm"
function shortTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const h = d.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'UTC' }).replace(/\s?(AM|PM)/i, '')
  const m = d.toLocaleTimeString('en-US', { minute: '2-digit', timeZone: 'UTC' })
  const suffix = d.toLocaleTimeString('en-US', { hour: 'numeric', timeZone: 'UTC' }).slice(-2).toLowerCase()
  return m === '00' ? `${h}${suffix}` : `${h}:${m}${suffix}`
}

function toRomanTierName(name: string): string {
  const map: Record<string, string> = {
    '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V',
    '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X',
  }
  return name.replace(/\b(\d+)\b/g, n => map[n] ?? n)
}

export default function EventDetail() {
  const router = useRouter()
  const params = useParams()
  const eventId = params.id as string
  const logoRef = useNavLogo<HTMLButtonElement>()
  usePageReveal({ selectors: ['.ev-title', '.ev-meta', '.section', '.tickets-panel'], delay: 0.2 })
  const [event, setEvent] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [buyingTier, setBuyingTier] = useState<string | null>(null)
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({})
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null | undefined>(undefined)
  const [soundMeta, setSoundMeta] = useState<{ title: string; artist: string } | null>(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Guest list link — host/admin only
  const [guestLink, setGuestLink] = useState<string | null>(null)
  const [genningLink, setGenningLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [linkSheetOpen, setLinkSheetOpen] = useState(false)

  // Guest list manager — host/admin only
  const [manageOpen, setManageOpen] = useState(false)
  const [guests, setGuests] = useState<{ ticket_id: string; user_id: string | null; name: string; email: string; is_checked_in: boolean }[]>([])
  const [guestSearch, setGuestSearch] = useState('')
  const [loadingGuests, setLoadingGuests] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Per-button magnetic effect via useMagneticButton applied individually
  const BuyButton = ({ tier, isBuying, onClick }: { tier: Tier; isBuying: boolean; onClick: () => void }) => {
    const ref = useMagneticButton<HTMLButtonElement>({ strength: 0.2 })
    const price = safePrice(tier.price)
    const label = isBuying ? 'processing…' : price === 0 ? 'rsvp · free' : 'get tickets'
    return (
      <button ref={ref} className="buy-btn" disabled={isBuying} onClick={onClick}>
        {label}
      </button>
    )
  }

  useEffect(() => {
    const supabase = createClient()
    let alive = true
    supabase.from('events').select('*, ticket_tiers(*)').eq('id', params.id).single()
      .then(({ data }) => { if (!alive) return; if (data) setEvent(data as EventData); setLoading(false) })
    return () => { alive = false }
  }, [params.id])

  useEffect(() => {
    if (!event?.spotify_playlist_url) { setPreviewUrl(null); return }
    let alive = true
    fetch(`/api/spotify-preview?url=${encodeURIComponent(event.spotify_playlist_url)}`)
      .then(r => r.json())
      .then(d => { if (!alive) return; setPreviewUrl(d.preview ?? null); if (d.title) setSoundMeta({ title: d.title, artist: d.artist ?? '' }) })
      .catch(() => { if (alive) setPreviewUrl(null) })
    return () => { alive = false }
  }, [event?.spotify_playlist_url])

  useEffect(() => {
    const a = new Audio()
    a.loop = true
    audioRef.current = a
    return () => { a.pause(); a.src = '' }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setCurrentUser(data.user)
        const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', data.user.id).single()
        if (admin) setIsAdmin(true)
      }
      setAuthReady(true)
    })
  }, [])

  // Hero canvas — only visible when there's no cover image or video
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0, t = 0, W = 0, H = 0
    const resize = () => { W = canvas.offsetWidth; H = canvas.offsetHeight; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    resize()
    window.addEventListener('resize', resize)
    const drawFrame = () => {
      const cx = W / 2
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.fillRect(0, 0, W, H)
      const cols = W < 600 ? 8 : 12, rows = W < 600 ? 5 : 7
      const sx = W / (cols + 1), sy = (H * 0.75) / (rows + 1)
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = sx * (c + 1), by = 15 + sy * (r + 1)
          const wave = Math.sin(t * 1.3 + c * 0.5 + r * 0.7) * 0.5 + 0.5
          const pulse = Math.sin(t * 2.4 + (c + r) * 0.3) * 0.3 + 0.7
          const intensity = wave * pulse
          const light = 30 + intensity * 42, alpha = 0.1 + intensity * 0.5
          ctx.fillStyle = `hsla(0,0%,${light}%,${alpha * 0.18})`; ctx.beginPath(); ctx.arc(bx, by, 6 + intensity * 10, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = `hsla(0,0%,${light + 20}%,${alpha * 0.4})`; ctx.beginPath(); ctx.arc(bx, by, 2.5 + intensity * 3, 0, Math.PI * 2); ctx.fill()
        }
      }
      const fog = ctx.createRadialGradient(cx, H * 0.45, 0, cx, H * 0.45, W * 0.5)
      fog.addColorStop(0, 'rgba(255,255,255,0.035)'); fog.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = fog; ctx.fillRect(0, 0, W, H)
    }
    const loop = () => { t += 0.014; drawFrame(); raf = requestAnimationFrame(loop) }
    if (prefersReduced) drawFrame(); else loop()
    const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (!prefersReduced) loop() }
    document.addEventListener('visibilitychange', onVis)
    return () => { window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis); cancelAnimationFrame(raf) }
  }, [])

  const handleBuyTicket = async (tier: Tier) => {
    setBuyingTier(tier.id)
    const qty = selectedQty[tier.id] || 1
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    try {
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tierId: tier.id, eventId: event?.id, quantity: qty, userId: user.id }) })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else alert(data.error ?? 'Something went wrong')
    } catch { alert('Failed to start checkout. Please try again.') }
    finally { setBuyingTier(null) }
  }

  const isHostOrAdmin = isAdmin || currentUser?.id === event?.host_id || currentUser?.email === 'mad2288@columbia.edu'
  // Only record a view once auth has resolved and we've confirmed it's a real visitor
  const trackable = authReady && !loading && !isHostOrAdmin
  usePageView(`/events/${eventId}`, eventId, trackable)

  const generateGuestLink = async () => {
    if (!event || !currentUser) return
    if (guestLink) { setLinkSheetOpen(true); return }
    setGenningLink(true)
    try {
      const supabase = createClient()
      // Reuse the existing broadcast link for this event if one exists
      const { data: existing } = await supabase
        .from('guest_invites')
        .select('token')
        .eq('event_id', event.id)
        .limit(1)
      let token = existing?.[0]?.token as string | undefined
      if (!token) {
        token = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
        const { error } = await supabase.from('guest_invites').insert({
          event_id: event.id,
          token,
          created_by: currentUser.id,
        })
        if (error) { alert('Could not generate link: ' + error.message); setGenningLink(false); return }
      }
      setGuestLink(`${window.location.origin}/gl/${token}`)
      setLinkSheetOpen(true)
    } catch {
      alert('Something went wrong')
    }
    setGenningLink(false)
  }

  const copyGuestLink = async () => {
    if (!guestLink) return
    try { await navigator.clipboard.writeText(guestLink); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 2200) } catch {}
  }

  const openGuestManager = async () => {
    if (!event || !currentUser) return
    setManageOpen(true)
    setLoadingGuests(true)
    try {
      const res = await fetch('/api/claim-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', eventId: event.id, requesterId: currentUser.id }),
      })
      const data = await res.json()
      setGuests(data.guests ?? [])
    } catch {}
    setLoadingGuests(false)
  }

  const removeGuest = async (ticketId: string) => {
    if (!event || !currentUser) return
    setRemovingId(ticketId)
    try {
      const res = await fetch('/api/claim-guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', eventId: event.id, requesterId: currentUser.id, ticketId }),
      })
      if (res.ok) setGuests(g => g.filter(x => x.ticket_id !== ticketId))
    } catch {}
    setRemovingId(null)
  }

  if (loading) return (
    <>
      <style>{`body{background:#000;margin:0;}`}</style>
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{width:'22px',height:'22px',border:`1px solid rgba(255,255,255,0.5)`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  )

  if (!event) return (
    <>
      <style>{`body{background:#000;margin:0;}`}</style>
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'18px',fontFamily:'Syne,sans-serif',color:'rgba(255,255,255,0.4)'}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'64px',opacity:0.25,lineHeight:1}}>404</div>
        <div style={{fontSize:'13px',letterSpacing:'1px'}}>event not found</div>
        <button onClick={() => router.push('/')} style={{padding:'11px 22px',background:'transparent',color:'#fff',border:'0.5px solid rgba(255,255,255,0.25)',cursor:'pointer',fontSize:'12px',fontFamily:'Syne,sans-serif',letterSpacing:'1px'}}>go home</button>
      </div>
    </>
  )

  const date = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:'UTC' }).toLowerCase()
    : 'tba'
  const time = shortTime(event.starts_at)
  const doorsTime = shortTime(event.doors_at)
  const street = [event.address, event.city].filter(Boolean).join(', ')
  const hasSocial = event.instagram_handle || event.tiktok_url

  // One flyer line: everything a poster would print, in poster order
  const metaLine = [date, time, event.venue_name?.toLowerCase(), street?.toLowerCase()].filter(Boolean).join('  ·  ')

  const cheapest = event.ticket_tiers?.length
    ? [...event.ticket_tiers].sort((a, b) => safePrice(a.price) - safePrice(b.price))[0]
    : null
  const allSoldOut = !!event.ticket_tiers?.length &&
    event.ticket_tiers.every(t => t.quantity - (t.quantity_sold || 0) <= 0)

  return (
    <>
      <TouchBlot intensity={0.4} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Syne:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:${COLORS.bg};color:#f0f0f0;font-family:'Syne',sans-serif;overflow-x:hidden;}

        /* NAV — admin tools are neutral. Amber belongs to the buy button alone. */
        nav{padding:14px 20px;background:rgba(0,0,0,0.9);position:sticky;top:0;z-index:100;display:flex;align-items:center;gap:14px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(255,255,255,0.08);}
        .back-btn{background:none;border:none;color:rgba(255,255,255,0.45);cursor:pointer;font-size:12px;font-family:'Syne',sans-serif;letter-spacing:0.5px;transition:color 0.15s;}
        .back-btn:hover{color:#fff;}
        .nav-logo{cursor:pointer;background:none;border:none;padding:0;flex:1;display:flex;justify-content:center;line-height:0;}
        .nav-logo .logo-img{height:19px;width:auto;}
        .admin-tools{display:flex;gap:8px;align-items:center;}
        .tool-btn{background:none;border:0.5px solid rgba(255,255,255,0.16);color:rgba(255,255,255,0.55);font-size:11px;font-family:'Syne',sans-serif;letter-spacing:0.5px;padding:6px 11px;cursor:pointer;transition:all 0.15s;white-space:nowrap;}
        .tool-btn:hover{border-color:rgba(255,255,255,0.4);color:#fff;}
        .tool-btn:disabled{opacity:0.3;cursor:not-allowed;}

        .gl-backdrop{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.8);display:flex;align-items:flex-end;justify-content:center;}
        .gl-sheet{width:100%;max-width:460px;background:#080808;border:0.5px solid rgba(255,255,255,0.1);padding:12px 22px 36px;}
        .gl-drag{width:36px;height:3px;background:rgba(255,255,255,0.12);margin:0 auto 22px;}
        .gl-sheet-title{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#fff;margin-bottom:6px;}
        .gl-sheet-desc{font-size:12px;color:rgba(255,255,255,0.35);line-height:1.6;margin-bottom:18px;}
        .gl-url-row{display:flex;gap:8px;margin-bottom:12px;}
        .gl-url-input{flex:1;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);padding:11px 12px;font-size:12px;color:rgba(255,255,255,0.65);font-family:'Syne',sans-serif;outline:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .gl-copy-btn{padding:11px 18px;background:#fff;color:#000;border:none;font-size:12px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;white-space:nowrap;}
        .gl-copy-btn.copied{background:#5ec888;}
        .gl-close-btn{width:100%;padding:12px;background:transparent;border:0.5px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);font-size:12px;font-family:'Syne',sans-serif;cursor:pointer;margin-top:4px;}
        .gm-search{width:100%;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);padding:10px 12px;font-size:13px;color:#fff;font-family:'Syne',sans-serif;outline:none;margin-bottom:12px;}
        .gm-search::placeholder{color:rgba(255,255,255,0.25);}
        .gm-list{max-height:46vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}
        .gm-row{display:flex;align-items:center;gap:11px;padding:9px 11px;border:0.5px solid rgba(255,255,255,0.07);}
        .gm-av{width:28px;height:28px;border-radius:50%;border:0.5px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:rgba(255,255,255,0.5);flex-shrink:0;font-family:'Syne',sans-serif;}
        .gm-info{flex:1;min-width:0;}
        .gm-name{font-size:13px;font-weight:600;color:#f0f0f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .gm-email{font-size:11px;color:rgba(255,255,255,0.28);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .gm-in{font-size:9px;font-weight:700;letter-spacing:1.5px;color:#5ec888;text-transform:uppercase;flex-shrink:0;font-family:'Barlow Condensed',sans-serif;}
        .gm-remove{background:none;border:0.5px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);padding:5px 11px;font-size:11px;font-family:'Syne',sans-serif;cursor:pointer;flex-shrink:0;}
        .gm-remove:hover{border-color:rgba(255,120,120,0.5);color:rgba(255,140,140,0.9);}
        .gm-remove:disabled{opacity:0.4;cursor:default;}
        .gm-empty{font-size:13px;color:rgba(255,255,255,0.3);padding:10px 0;}

        .hero{position:relative;height:520px;overflow:hidden;}
        .hero-canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0;}
        .hero-img,.hero-video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;}
        .hero-overlay{position:absolute;inset:0;z-index:2;background:linear-gradient(to bottom,rgba(0,0,0,0.1) 0%,rgba(0,0,0,0.5) 58%,${COLORS.bg} 100%);}
        .hero-content{position:relative;z-index:3;height:100%;display:flex;flex-direction:column;justify-content:flex-end;padding:0 20px 40px;max-width:900px;margin:0 auto;}
        .ev-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(46px,11vw,86px);font-weight:700;line-height:0.9;color:#fff;letter-spacing:-1px;margin-bottom:18px;}
        /* One line, no icons. Typography carries it. */
        .ev-meta{font-family:'Syne',sans-serif;font-size:12px;letter-spacing:1.5px;color:rgba(255,255,255,0.62);padding-top:14px;border-top:0.5px solid rgba(255,255,255,0.18);}

        .content{max-width:900px;margin:0 auto;padding:44px 20px 140px;position:relative;z-index:1;}
        .two-col{display:grid;gap:44px;}
        @media(min-width:700px){.two-col{grid-template-columns:1fr 320px;}}
        .section{margin-bottom:38px;}
        .sec-title{font-family:'Syne',sans-serif;font-size:10px;font-weight:500;letter-spacing:3px;color:rgba(255,255,255,0.25);margin-bottom:16px;}
        .desc{font-size:14px;line-height:1.95;color:rgba(255,255,255,0.6);}

        /* Info rows replace the chip cluster — no icons, no boxes */
        .info-row{display:flex;justify-content:space-between;gap:20px;padding:11px 0;border-bottom:0.5px solid rgba(255,255,255,0.07);font-size:12px;}
        .info-row:first-child{border-top:0.5px solid rgba(255,255,255,0.07);}
        .info-k{color:rgba(255,255,255,0.3);letter-spacing:1.5px;}
        .info-v{color:rgba(255,255,255,0.72);text-align:right;}
        .text-links{display:flex;gap:18px;margin-top:20px;}
        .text-link{font-size:11px;letter-spacing:1.5px;color:rgba(255,255,255,0.4);text-decoration:none;border-bottom:0.5px solid rgba(255,255,255,0.18);padding-bottom:2px;transition:color 0.15s;}
        .text-link:hover{color:#fff;}

        .spotify-wrap{border:0.5px solid rgba(255,255,255,0.09);}

        .tickets-panel{position:sticky;top:80px;}
        .ticket-card{border:0.5px solid rgba(255,255,255,0.12);padding:22px;margin-bottom:12px;}
        .tier-name{font-size:11px;font-weight:500;letter-spacing:2.5px;color:rgba(255,255,255,0.45);margin-bottom:10px;}
        .tier-price{font-family:'Barlow Condensed',sans-serif;font-size:52px;font-weight:700;color:#fff;line-height:0.9;letter-spacing:-1px;}
        .tier-sub{font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:1px;margin:8px 0 18px;}
        /* Bar only — no remaining count */
        .avail-bar{height:2px;background:rgba(255,255,255,0.08);overflow:hidden;margin-bottom:18px;}
        .avail-fill{height:100%;background:rgba(255,255,255,0.4);transition:width 0.5s ease;}
        .avail-fill.low{background:${COLORS.primary};}
        .qty-row{display:flex;align-items:center;gap:12px;margin-bottom:16px;}
        .qty-label{font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:1.5px;}
        .qty-select{background:transparent;border:0.5px solid rgba(255,255,255,0.18);padding:7px 10px;color:#f0f0f0;font-size:13px;font-family:'Syne',sans-serif;outline:none;cursor:pointer;-webkit-appearance:none;}

        /* The one amber object on the page */
        .buy-btn{width:100%;background:${COLORS.primary};color:#000;border:none;padding:16px 20px;font-size:13px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;letter-spacing:1.5px;transition:background 0.15s;text-align:center;display:block;}
        .buy-btn:hover{background:#ffc040;}
        .buy-btn:active{transform:scale(0.995);}
        .buy-btn:disabled{opacity:0.35;cursor:not-allowed;}
        .soldout-btn{width:100%;background:none;color:rgba(255,255,255,0.3);border:0.5px solid rgba(255,255,255,0.1);padding:16px;font-size:12px;font-family:'Syne',sans-serif;letter-spacing:1.5px;cursor:not-allowed;text-align:center;}

        /* Mobile: tickets sit far below the fold. This scrolls to them. */
        .mobile-buy{display:none;}
        @media(max-width:699px){
          .mobile-buy{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:90;align-items:center;justify-content:space-between;gap:14px;padding:12px 18px calc(12px + env(safe-area-inset-bottom));background:rgba(0,0,0,0.92);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-top:0.5px solid rgba(255,255,255,0.12);}
          .mobile-buy-price{font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:700;color:#fff;line-height:1;}
          .mobile-buy-btn{background:${COLORS.primary};color:#000;border:none;padding:13px 22px;font-size:12px;font-weight:700;font-family:'Syne',sans-serif;letter-spacing:1.5px;cursor:pointer;}
          .hero{height:64vh;min-height:400px;}
          .content{padding:30px 18px 120px;}
          .two-col{gap:32px;}
        }
      `}</style>

      <nav>
        <button className="back-btn" onClick={() => router.back()}>← back</button>
        <button ref={logoRef} className="nav-logo" onClick={() => router.push('/')} aria-label="Pulse home">
          <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
        </button>
        {isHostOrAdmin ? (
          <div className="admin-tools">
            <button className="tool-btn" onClick={generateGuestLink} disabled={genningLink}>link</button>
            <button className="tool-btn" onClick={openGuestManager}>guests</button>
            <button className="tool-btn" onClick={() => router.push(`/host/edit/${event.id}`)}>edit</button>
          </div>
        ) : <div style={{width:'50px'}}/>}
      </nav>

      <div className="hero">
        <canvas ref={canvasRef} className="hero-canvas" aria-hidden="true"/>
        {event.feed_video_url ? (
          <video className="hero-video" src={event.feed_video_url} autoPlay muted loop playsInline poster={event.cover_image_url ?? undefined}/>
        ) : event.cover_image_url ? (
          <img src={event.cover_image_url} className="hero-img" alt={event.title}/>
        ) : null}
        <div className="hero-overlay"/>
        <div className="hero-content">
          <h1 className="ev-title">{event.title.toLowerCase()}</h1>
          <div className="ev-meta">{metaLine}</div>
        </div>
      </div>

      <div className="content">
        <div className="two-col">
          <div>
            {event.description && (
              <div className="section">
                <h2 className="sec-title">about</h2>
                <p className="desc">{event.description}</p>
              </div>
            )}

            {event.spotify_playlist_url && spotifyEmbed(event.spotify_playlist_url) && (
              <div className="section">
                <h2 className="sec-title">sound</h2>
                <div className="spotify-wrap">
                  <iframe src={spotifyEmbed(event.spotify_playlist_url)!} width="100%" height="80" frameBorder="0" allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="Spotify player" style={{display:'block'}}/>
                </div>
              </div>
            )}

            <div className="section">
              <h2 className="sec-title">info</h2>
              {doorsTime && (
                <div className="info-row"><span className="info-k">doors</span><span className="info-v">{doorsTime}</span></div>
              )}
              {event.is_21_plus && (
                <div className="info-row"><span className="info-k">age</span><span className="info-v">21+ · valid id at door</span></div>
              )}
              {event.dress_code && (
                <div className="info-row"><span className="info-k">dress</span><span className="info-v">{event.dress_code.toLowerCase()}</span></div>
              )}
              {street && (
                <div className="info-row"><span className="info-k">address</span><span className="info-v">{street.toLowerCase()}{event.state ? ` ${event.state.toLowerCase()}` : ''}</span></div>
              )}
              {hasSocial && (
                <div className="text-links">
                  {event.instagram_handle && <a className="text-link" href={igUrl(event.instagram_handle)} target="_blank" rel="noopener noreferrer">instagram</a>}
                  {event.tiktok_url && <a className="text-link" href={event.tiktok_url} target="_blank" rel="noopener noreferrer">tiktok</a>}
                </div>
              )}
            </div>
          </div>

          <div className="tickets-panel" id="tickets">
            <h2 className="sec-title">tickets</h2>
            {event.ticket_tiers && event.ticket_tiers.length > 0 ? (
              [...event.ticket_tiers].sort((a, b) => safePrice(a.price) - safePrice(b.price)).map(tier => {
                const price = safePrice(tier.price)
                const available = tier.quantity - (tier.quantity_sold || 0)
                const soldOut = available <= 0
                const qty = selectedQty[tier.id] || 1
                const isBuying = buyingTier === tier.id
                // Door tier: hide the availability bar (still sells, still goes sold-out)
                const hideAvailability = tier.name.trim().toLowerCase() === 'door'
                const soldPct = tier.quantity > 0
                  ? Math.max(2, ((tier.quantity - available) / tier.quantity) * 100)
                  : 0
                return (
                  <div key={tier.id} className="ticket-card">
                    <div className="tier-name">{toRomanTierName(tier.name).toLowerCase()}</div>
                    <div className="tier-price">{displayPrice(price, qty > 1 ? qty : 1)}</div>
                    <div className="tier-sub">
                      {soldOut ? 'sold out' : price === 0 ? 'free admission' : `per ticket${qty > 1 ? ` · ${qty} tickets` : ''}`}
                    </div>
                    {!soldOut && !hideAvailability && (
                      <div className="avail-bar">
                        <div className={`avail-fill ${available <= 12 ? 'low' : ''}`} style={{width:`${soldPct}%`}}/>
                      </div>
                    )}
                    {!soldOut && (
                      <div className="qty-row">
                        <span className="qty-label">qty</span>
                        <select className="qty-select" value={qty} onChange={e => setSelectedQty(prev => ({...prev, [tier.id]: parseInt(e.target.value)}))}>
                          {Array.from({length: Math.min(available, 10)}).map((_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}
                        </select>
                      </div>
                    )}
                    {soldOut ? (
                      <div className="soldout-btn">sold out</div>
                    ) : (
                      <BuyButton tier={tier} isBuying={isBuying} onClick={() => handleBuyTicket(tier)}/>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="ticket-card" style={{textAlign:'center',padding:'36px 20px'}}>
                <div style={{fontSize:'13px',color:'rgba(255,255,255,0.4)',marginBottom:'8px'}}>tickets not available yet</div>
                <div style={{fontSize:'11px',color:'rgba(255,255,255,0.22)',letterSpacing:'1px'}}>check back soon</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {cheapest && !allSoldOut && (
        <div className="mobile-buy">
          <div>
            <div className="mobile-buy-price">{displayPrice(safePrice(cheapest.price), 1)}</div>
          </div>
          <button
            className="mobile-buy-btn"
            onClick={() => document.getElementById('tickets')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            get tickets
          </button>
        </div>
      )}

      {event && <EventLounge eventId={event.id} eventTitle={event.title} hostId={event.host_id}/>}

      {linkSheetOpen && guestLink && (
        <div className="gl-backdrop" onClick={() => setLinkSheetOpen(false)}>
          <div className="gl-sheet" onClick={e => e.stopPropagation()}>
            <div className="gl-drag"/>
            <div className="gl-sheet-title">guest list link</div>
            <p className="gl-sheet-desc">Anyone who opens this link gets a free guest ticket. Share it in your story, DMs, or group chat.</p>
            <div className="gl-url-row">
              <input className="gl-url-input" readOnly value={guestLink} onFocus={e => e.currentTarget.select()}/>
              <button className={`gl-copy-btn ${linkCopied ? 'copied' : ''}`} onClick={copyGuestLink}>
                {linkCopied ? 'copied' : 'copy'}
              </button>
            </div>
            <button className="gl-close-btn" onClick={() => setLinkSheetOpen(false)}>done</button>
          </div>
        </div>
      )}

      {manageOpen && (
        <div className="gl-backdrop" onClick={() => setManageOpen(false)}>
          <div className="gl-sheet" onClick={e => e.stopPropagation()}>
            <div className="gl-drag"/>
            <div className="gl-sheet-title">guest list</div>
            <p className="gl-sheet-desc">
              {loadingGuests
                ? 'Loading…'
                : `${guests.length} ${guests.length === 1 ? 'guest' : 'guests'}${guests.filter(g => g.is_checked_in).length ? ` · ${guests.filter(g => g.is_checked_in).length} checked in` : ''}`}
            </p>
            <input className="gm-search" placeholder="Search guests…" value={guestSearch} onChange={e => setGuestSearch(e.target.value)}/>
            <div className="gm-list">
              {loadingGuests ? (
                <div className="gm-empty">Loading guests…</div>
              ) : guests.length === 0 ? (
                <div className="gm-empty">No one has claimed a guest spot yet.</div>
              ) : (
                guests
                  .filter(g => {
                    const q = guestSearch.toLowerCase()
                    return !q || g.name.toLowerCase().includes(q) || g.email.toLowerCase().includes(q)
                  })
                  .map(g => (
                    <div key={g.ticket_id} className="gm-row">
                      <div className="gm-av">{(g.name || 'G').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</div>
                      <div className="gm-info">
                        <div className="gm-name">{g.name}</div>
                        {g.email && <div className="gm-email">{g.email}</div>}
                      </div>
                      {g.is_checked_in && <span className="gm-in">In</span>}
                      <button className="gm-remove" disabled={removingId === g.ticket_id} onClick={() => removeGuest(g.ticket_id)}>
                        {removingId === g.ticket_id ? '…' : 'remove'}
                      </button>
                    </div>
                  ))
              )}
            </div>
            <button className="gl-close-btn" onClick={() => setManageOpen(false)}>done</button>
          </div>
        </div>
      )}
    </>
  )
}