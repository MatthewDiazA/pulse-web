'use client'
import { useEffect, useState, useRef } from 'react'
import { useMagneticButton, usePageReveal, useNavLogo } from '../../lib/animations'
import TouchBlot from '../../components/TouchBlot'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { usePageView } from '../../lib/usePageView'
import FlipCounter from '../../components/FlipCounter'
import { loadFlyerPalette, NEUTRAL_PALETTE, type FlyerPalette } from '../../lib/flyerColor'

type Tier = {
  id: string
  name: string
  price: number
  quantity: number
  quantity_sold: number
  // Optional — only present if you add the column later. Ignored when absent.
  available_at?: string | null
}
type Act = { name: string; role?: string; time?: string }
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
  ends_at: string | null
  lineup: string | Act[] | null
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

// Page ground. The accent is not fixed — it's pulled from each event's flyer (see flyerColor.ts)
const BG = '#000'
const FEE_RATE = 0.10

// Tier release rule. 'ladder' = a tier stays locked until every cheaper tier is
// sold out. Set to false if you ever want all tiers on sale at once.
const LADDER_RELEASE = true

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
  const m = d.getUTCMinutes()
  const suffix = d.getUTCHours() >= 12 ? 'pm' : 'am'
  const h = d.getUTCHours() % 12 || 12
  return m === 0 ? `${h}${suffix}` : `${h}:${String(m).padStart(2, '0')}${suffix}`
}

function toRomanTierName(name: string): string {
  const map: Record<string, string> = {
    '1': 'I', '2': 'II', '3': 'III', '4': 'IV', '5': 'V',
    '6': 'VI', '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X',
  }
  return name.replace(/\b(\d+)\b/g, n => map[n] ?? n)
}

const remainingOf = (t: Tier) => t.quantity - (t.quantity_sold || 0)

// Times are stored as wall-clock in UTC fields (the page renders with timeZone UTC),
// so "today/tomorrow" compares the event's UTC calendar day to the viewer's local day.
function relativeDay(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000)
  if (diff === 0) return 'Tonight'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1 && diff < 7) return `This ${d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}`
  return null
}

// Floating (no timezone) calendar stamp, matching how times are stored: 20260605T210000
function calStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00`
}

function parseLineup(raw: EventData['lineup']): Act[] {
  try {
    const list = typeof raw === 'string' ? JSON.parse(raw) : raw
    return Array.isArray(list) ? list.filter((a: Act) => a?.name?.trim()) : []
  } catch { return [] }
}

// "12AM - 1AM" -> minutes after 8am-ish, so 1am sorts after 11pm
function setStart(time?: string): { label: string; order: number } | null {
  const m = time?.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (!m) return null
  let h = parseInt(m[1]) % 12
  if (m[3]?.toLowerCase() === 'pm') h += 12
  if (h < 8) h += 24
  const label = `${parseInt(m[1])}${m[2] && m[2] !== '00' ? `:${m[2]}` : ''}${m[3] ? m[3].toUpperCase() : ''}`
  return { label, order: h * 60 + (m[2] ? parseInt(m[2]) : 0) }
}

const isHeadliner = (a: Act) => /headlin/i.test(a.role ?? '')


export default function EventDetail() {
  const router = useRouter()
  const params = useParams()
  const eventId = params.id as string
  const logoRef = useNavLogo<HTMLButtonElement>()
  usePageReveal({ selectors: ['.poster', '.ev-head', '.fact-bar', '.section'], delay: 0.15 })
  const [event, setEvent] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [buyingTier, setBuyingTier] = useState<string | null>(null)
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({})
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null | undefined>(undefined)
  const [soundMeta, setSoundMeta] = useState<{ title: string; artist: string } | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [palette, setPalette] = useState<FlyerPalette>(NEUTRAL_PALETTE)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [shared, setShared] = useState(false)
  const [calOpen, setCalOpen] = useState(false)

  // Guest list link — host/admin only
  const [guestLink, setGuestLink] = useState<string | null>(null)
  const [genningLink, setGenningLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [linkSheetOpen, setLinkSheetOpen] = useState(false)
  const [glCount, setGlCount] = useState(1)

  // Guest list manager — host/admin only
  const [manageOpen, setManageOpen] = useState(false)
  const [guests, setGuests] = useState<{ ticket_id: string; user_id: string | null; name: string; email: string; is_checked_in: boolean }[]>([])
  const [guestSearch, setGuestSearch] = useState('')
  const [loadingGuests, setLoadingGuests] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Per-button magnetic effect via useMagneticButton applied individually
  const BuyButton = ({ tier, qty, isBuying, onClick }: { tier: Tier; qty: number; isBuying: boolean; onClick: () => void }) => {
    const ref = useMagneticButton<HTMLButtonElement>({ strength: 0.2 })
    const price = safePrice(tier.price)
    const label = isBuying ? 'processing…' : price === 0 ? 'rsvp · free' : `get tickets · ${money(price * qty)}`
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

  // Tint the page with the flyer's own colors
  useEffect(() => {
    if (!event?.cover_image_url) return
    let alive = true
    loadFlyerPalette(event.cover_image_url).then(p => { if (alive) setPalette(p) })
    return () => { alive = false }
  }, [event?.cover_image_url])

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

  // Each tap mints a fresh single-use link; whoever claims it gets glCount tickets
  const generateGuestLink = async () => {
    if (!event || !currentUser) return
    setGenningLink(true)
    setLinkCopied(false)
    try {
      const supabase = createClient()
      const token = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
      const { error } = await supabase.from('guest_invites').insert({
        event_id: event.id,
        token,
        created_by: currentUser.id,
        ticket_count: glCount,
      })
      if (error) { alert('Could not generate link: ' + error.message); setGenningLink(false); return }
      setGuestLink(`${window.location.origin}/gl/${token}`)
    } catch {
      alert('Something went wrong')
    }
    setGenningLink(false)
  }

  // Native share sheet on phones; copy the link everywhere else
  const shareEvent = async () => {
    if (!event) return
    const url = window.location.href
    try {
      if (navigator.share) { await navigator.share({ title: event.title, url }); return }
      await navigator.clipboard.writeText(url)
      setShared(true); setTimeout(() => setShared(false), 2000)
    } catch {}
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
      <style>{`body{background:${BG};margin:0;}`}</style>
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{width:'22px',height:'22px',border:`1px solid rgba(255,255,255,0.5)`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </>
  )

  if (!event) return (
    <>
      <style>{`body{background:${BG};margin:0;}`}</style>
      <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'18px',fontFamily:'Syne,sans-serif',color:'rgba(255,255,255,0.4)'}}>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:'64px',opacity:0.25,lineHeight:1}}>404</div>
        <div style={{fontSize:'13px',letterSpacing:'1px'}}>event not found</div>
        <button onClick={() => router.push('/')} style={{padding:'11px 22px',background:'transparent',color:'#fff',border:'0.5px solid rgba(255,255,255,0.25)',cursor:'pointer',fontSize:'12px',fontFamily:'Syne,sans-serif',letterSpacing:'1px'}}>go home</button>
      </div>
    </>
  )

  const date = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', timeZone:'UTC' })
    : 'TBA'
  const time = shortTime(event.starts_at)
  const doorsTime = shortTime(event.doors_at)
  const street = [event.address, event.city].map(x => x?.trim()).filter(Boolean).join(', ')
  const hasSocial = event.instagram_handle || event.tiktok_url

  // Airport-code style city tag for the location tile: Austin -> AUS
  const cityCode = event.city ? event.city.replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() : 'MAP'
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent([event.venue_name, street, event.state].filter(Boolean).join(' '))}`
  const longAbout = (event.description ?? '').length > 260
  const rel = relativeDay(event.starts_at)

  // Calendar: .ics for Apple/Outlook, template link for Google
  const calStart = event.starts_at ? new Date(event.starts_at) : null
  const calEnd = event.ends_at ? new Date(event.ends_at) : calStart ? new Date(calStart.getTime() + 5 * 3600000) : null
  const googleCalUrl = calStart && calEnd
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${calStamp(calStart)}/${calStamp(calEnd)}&location=${encodeURIComponent([event.venue_name, street, event.state].filter(Boolean).join(', '))}&details=${encodeURIComponent(`Tickets: ${typeof window !== 'undefined' ? window.location.href : ''}`)}`
    : null

  const lineup = parseLineup(event.lineup)
  const hasSetTimes = lineup.some(a => setStart(a.time))
  const timetable = hasSetTimes
    ? [...lineup].sort((a, b) => (setStart(a.time)?.order ?? 9999) - (setStart(b.time)?.order ?? 9999))
    : []
  const headliners = lineup.filter(isHeadliner)
  const support = lineup.filter(a => !isHeadliner(a))

  const sortedTiers = [...(event.ticket_tiers ?? [])].sort((a, b) => safePrice(a.price) - safePrice(b.price))

  // A tier is locked when a scheduled release hasn't arrived, or — under the
  // ladder rule — when any cheaper tier still has inventory left.
  const lockInfoFor = (tier: Tier, index: number): { locked: boolean; reason: string } => {
    if (tier.available_at) {
      const opensAt = new Date(tier.available_at).getTime()
      if (!isNaN(opensAt) && Date.now() < opensAt) {
        const d = new Date(opensAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()
        return { locked: true, reason: `opens ${d}` }
      }
    }
    if (LADDER_RELEASE && index > 0) {
      const blocker = sortedTiers.slice(0, index).find(t => remainingOf(t) > 0)
      if (blocker) {
        return { locked: true, reason: `opens when ${toRomanTierName(blocker.name).toLowerCase()} sells out` }
      }
    }
    return { locked: false, reason: '' }
  }

  // Mobile bar should quote the cheapest tier someone can actually buy
  const buyableTier = sortedTiers.find((t, i) => remainingOf(t) > 0 && !lockInfoFor(t, i).locked) ?? null
  // Social proof only once it's real
  const going = sortedTiers.reduce((n, t) => n + (t.quantity_sold || 0), 0)

  return (
    <>
      <TouchBlot intensity={0.4} palette={[palette.accent, palette.accent2]} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Syne:wght@400;500;600;700;800&display=swap');
        :root{--accent:${palette.accent};--accent-2:${palette.accent2};--ink:${palette.ink};--accent-rgb:${palette.rgb};}
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:${BG};color:#f0f0f0;font-family:'Syne',sans-serif;overflow-x:hidden;}
        /* Film grain over the whole page so it reads printed, not rendered */
        body::after{content:'';position:fixed;inset:0;z-index:95;pointer-events:none;opacity:0.05;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}

        /* Equal side columns keep the logo on the true center, whatever sits left or right of it */
        nav{padding:14px 20px;background:rgba(0,0,0,0.85);position:sticky;top:0;z-index:100;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:14px;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(255,255,255,0.08);}
        .back-btn{justify-self:start;background:none;border:none;color:rgba(255,255,255,0.45);cursor:pointer;font-size:12px;font-family:'Syne',sans-serif;letter-spacing:0.5px;transition:color 0.15s;}
        .back-btn:hover{color:#fff;}
        .nav-logo{cursor:pointer;background:none;border:none;padding:0;display:flex;justify-content:center;line-height:0;}
        .nav-logo .logo-img{height:19px;width:auto;}
        .admin-tools{justify-self:end;display:flex;gap:8px;align-items:center;}
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

        /* AMBIENT — the flyer, blurred huge behind the page, so every event has its own room */
        .ambient{position:absolute;top:0;left:0;right:0;height:900px;z-index:0;overflow:hidden;pointer-events:none;-webkit-mask-image:linear-gradient(#000 30%,transparent);mask-image:linear-gradient(#000 30%,transparent);}
        .ambient-img{position:absolute;inset:-80px;background-size:cover;background-position:center;filter:blur(70px) saturate(1.35) brightness(0.55);transform:scale(1.1);}
        .ambient-tint{position:absolute;inset:0;background:radial-gradient(80% 60% at 50% 0%,rgba(var(--accent-rgb),0.22),transparent 70%);transition:background 0.8s;}

        .page{position:relative;z-index:1;max-width:1120px;margin:0 auto;padding:20px 20px 150px;display:grid;grid-template-columns:minmax(0,1fr);gap:26px;}
        @media(min-width:900px){
          .page{grid-template-columns:minmax(0,440px) minmax(0,1fr);gap:56px;padding:48px 32px 120px;align-items:start;}
          .poster-col{position:sticky;top:88px;}
        }

        /* POSTER — the flyer shown whole, as printed */
        .poster{position:relative;width:100%;max-width:440px;margin:0 auto;border-radius:16px;overflow:hidden;background:#111;box-shadow:0 30px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.08);}
        .poster img,.poster video{display:block;width:100%;height:auto;max-height:72vh;object-fit:cover;}
        .poster-empty{aspect-ratio:4/5;position:relative;}
        .hero-canvas{position:absolute;inset:0;width:100%;height:100%;}

        /* HEAD */
        .ev-head{display:flex;flex-direction:column;gap:12px;}
        .ev-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(44px,12vw,80px);font-weight:900;text-transform:uppercase;line-height:0.88;color:#fff;letter-spacing:-0.5px;text-wrap:balance;}
        .ev-sub{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;font-size:13px;color:rgba(255,255,255,0.55);}
        .going{display:inline-flex;align-items:center;gap:7px;color:rgba(255,255,255,0.8);font-weight:600;}
        .going::before{content:'';width:6px;height:6px;border-radius:50%;background:#5ec888;box-shadow:0 0 8px #5ec888;}

        /* THE BAR — the night's key facts, in the flyer's color */
        .fact-bar{display:flex;align-items:stretch;background:var(--accent);color:var(--ink);border-radius:12px;overflow:hidden;transition:background 0.8s;}
        .fact{flex:1;min-width:0;padding:12px 14px;border-left:1px solid color-mix(in srgb,var(--ink) 18%,transparent);}
        .fact:first-child{border-left:none;}
        .fact-k{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;opacity:0.65;margin-bottom:3px;}
        .fact-v{font-family:'Barlow Condensed',sans-serif;font-size:20px;font-weight:700;text-transform:uppercase;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        @media(max-width:899px){.fact-bar{margin:0 -20px;border-radius:0;}.fact{padding:13px 16px;}}

        /* SECTIONS */
        .info-col{display:flex;flex-direction:column;gap:26px;min-width:0;}
        .section{display:flex;flex-direction:column;gap:14px;}
        .sec-title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#fff;line-height:1;}
        .desc{font-size:15px;line-height:1.75;color:rgba(255,255,255,0.72);white-space:pre-line;}
        .desc.clamped{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;}
        .more-btn{align-self:flex-start;background:none;border:none;padding:0;color:#fff;font-size:13px;font-weight:600;font-family:'Syne',sans-serif;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.3);}

        .details{display:flex;flex-direction:column;border-radius:14px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);}
        .detail{display:flex;align-items:center;gap:14px;padding:14px 16px;border-top:1px solid rgba(255,255,255,0.06);text-decoration:none;color:inherit;}
        .detail:first-child{border-top:none;}
        /* Typographic tiles: the info itself, set like a flyer, in the flyer's color */
        .detail-ic{width:64px;height:40px;border-radius:10px;background:rgba(var(--accent-rgb),0.13);border:1px solid rgba(var(--accent-rgb),0.28);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--accent);font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:700;letter-spacing:0.5px;line-height:1;white-space:nowrap;transition:color 0.8s,background 0.8s,border-color 0.8s;}
        .detail-txt{flex:1;min-width:0;}
        .detail-k{font-size:14px;font-weight:600;color:#fff;}
        .detail-v{font-size:12px;color:rgba(255,255,255,0.5);margin-top:2px;}
        .detail-go{font-size:12px;font-weight:600;color:var(--accent);white-space:nowrap;}

        button.detail{width:100%;background:none;border:none;border-top:1px solid rgba(255,255,255,0.06);font:inherit;text-align:left;cursor:pointer;}
        button.detail:first-child{border-top:none;}
        button.detail:disabled{cursor:default;}
        .cal-opts{display:flex;gap:8px;padding:0 16px 14px 82px;flex-wrap:wrap;}
        .cal-opt{padding:9px 14px;border-radius:999px;background:rgba(var(--accent-rgb),0.13);border:1px solid rgba(var(--accent-rgb),0.28);color:var(--accent);font-size:12px;font-weight:600;text-decoration:none;}

        /* LINEUP — poster billing, or a timetable when the host gave set times */
        .billing{display:flex;flex-direction:column;gap:8px;}
        .bill-head{font-family:'Barlow Condensed',sans-serif;font-size:clamp(32px,9vw,44px);font-weight:900;text-transform:uppercase;line-height:0.92;color:#fff;letter-spacing:-0.3px;}
        .bill-rest{font-family:'Barlow Condensed',sans-serif;font-size:21px;font-weight:700;text-transform:uppercase;line-height:1.3;color:rgba(255,255,255,0.72);}
        .bill-rest.solo{font-size:26px;color:#fff;}
        .bill-sep{color:var(--accent);}
        .lineup-name{text-transform:uppercase;}
        .lineup-name.head{color:var(--accent);}
        .head-chip{font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink);background:var(--accent);padding:4px 8px;border-radius:999px;}

        .socials{display:flex;gap:10px;flex-wrap:wrap;}
        .social{padding:10px 16px;border-radius:999px;border:1px solid rgba(255,255,255,0.14);color:#fff;text-decoration:none;font-size:13px;font-weight:600;transition:border-color 0.15s;}
        .social:hover{border-color:rgba(255,255,255,0.4);}

        .spotify-wrap{border-radius:12px;overflow:hidden;}

        .share-btn{background:none;border:0.5px solid rgba(255,255,255,0.16);color:rgba(255,255,255,0.75);font-size:11px;font-family:'Syne',sans-serif;padding:6px 11px;cursor:pointer;white-space:nowrap;}

        /* TICKETS — a real ticket: header with price, perforated tear line with notches, footer with checkout */
        .ticket{filter:drop-shadow(0 18px 40px rgba(0,0,0,0.55));}
        /* The notches are true cutouts (masks), so they show whatever is behind the card */
        .tickets{display:flex;flex-direction:column;gap:14px;}
        .ticket-top,.ticket-bottom{--notch:11px;position:relative;background:#141414;}
        .ticket-top{border-radius:14px 14px 0 0;padding:22px 22px 20px;background:linear-gradient(160deg,rgba(var(--accent-rgb),0.16) 0%,#141414 60%);border-bottom:2px dashed rgba(255,255,255,0.12);
          -webkit-mask:radial-gradient(circle var(--notch) at 0 100%,#0000 98%,#000) left/51% 100% no-repeat,radial-gradient(circle var(--notch) at 100% 100%,#0000 98%,#000) right/51% 100% no-repeat;
                  mask:radial-gradient(circle var(--notch) at 0 100%,#0000 98%,#000) left/51% 100% no-repeat,radial-gradient(circle var(--notch) at 100% 100%,#0000 98%,#000) right/51% 100% no-repeat;}
        .ticket-top::before{content:'';position:absolute;top:0;left:22px;right:22px;height:3px;border-radius:0 0 3px 3px;background:var(--accent);transition:background 0.8s;}
        .ticket-bottom{border-radius:0 0 14px 14px;padding:18px 22px 22px;
          -webkit-mask:radial-gradient(circle var(--notch) at 0 0,#0000 98%,#000) left/51% 100% no-repeat,radial-gradient(circle var(--notch) at 100% 0,#0000 98%,#000) right/51% 100% no-repeat;
                  mask:radial-gradient(circle var(--notch) at 0 0,#0000 98%,#000) left/51% 100% no-repeat,radial-gradient(circle var(--notch) at 100% 0,#0000 98%,#000) right/51% 100% no-repeat;}
        .tier-row{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;}
        .tier-name{font-size:12px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#fff;margin-bottom:6px;}
        .tier-sub{font-size:11px;color:rgba(255,255,255,0.45);letter-spacing:0.5px;}
        .tier-sub.low{color:var(--accent);font-weight:600;}
        .tier-price{font-family:'Barlow Condensed',sans-serif;font-size:48px;font-weight:700;color:#fff;line-height:0.85;letter-spacing:-0.5px;white-space:nowrap;}
        .avail-bar{height:3px;border-radius:2px;background:rgba(255,255,255,0.08);overflow:hidden;margin-top:18px;}
        .avail-fill{height:100%;background:var(--accent);transition:width 0.5s ease,background 0.8s;}
        .checkout-row{display:flex;gap:10px;align-items:stretch;}
        .stepper{display:flex;align-items:center;border:1px solid rgba(255,255,255,0.14);border-radius:10px;flex-shrink:0;}
        .stepper button{width:36px;height:100%;min-height:48px;background:none;border:none;color:#fff;font-size:18px;cursor:pointer;font-family:'Syne',sans-serif;}
        .stepper button:disabled{color:rgba(255,255,255,0.2);cursor:default;}
        .stepper span{min-width:20px;text-align:center;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;}
        .tier-next{margin-top:12px;font-size:11px;color:rgba(255,255,255,0.5);}
        .tier-next b{color:#fff;font-weight:700;}
        .state-pill{display:block;width:100%;text-align:center;padding:15px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:rgba(255,255,255,0.4);}

        /* Not released yet / sold out — visible, priced, and plainly not for sale */
        .ticket.dim .ticket-top{background:#101010;}
        .ticket.dim .ticket-top::before{background:rgba(255,255,255,0.12);}
        .ticket.dim .ticket-bottom{background:#101010;}
        .ticket.dim .tier-name{color:rgba(255,255,255,0.45);}
        .ticket.dim .tier-price{color:rgba(255,255,255,0.25);}
        .ticket.soldout .tier-price{text-decoration:line-through;text-decoration-thickness:2px;}

        /* The buy button wears the flyer color */
        .buy-btn{flex:1;min-height:48px;background:var(--accent);color:var(--ink);border:none;border-radius:10px;padding:14px 18px;font-size:13px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;letter-spacing:1px;transition:background 0.8s,filter 0.15s,box-shadow 0.15s;text-align:center;white-space:nowrap;}
        .buy-btn:hover{filter:brightness(1.08);box-shadow:0 0 24px rgba(var(--accent-rgb),0.35);}
        .buy-btn:active{transform:scale(0.995);}
        .buy-btn:disabled{opacity:0.35;cursor:not-allowed;}

        /* Mobile: tickets sit far below the fold. This scrolls to them. */
        .mobile-buy{display:none;}
        @media(max-width:899px){
          .mobile-buy{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:90;align-items:center;justify-content:space-between;gap:14px;padding:12px 18px calc(12px + env(safe-area-inset-bottom));background:rgba(0,0,0,0.92);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-top:0.5px solid rgba(255,255,255,0.12);}
          .mobile-buy-k{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:3px;}
          .mobile-buy-price{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:#fff;line-height:1;}
          .mobile-buy-btn{background:var(--accent);color:var(--ink);border:none;border-radius:8px;padding:13px 22px;font-size:12px;font-weight:700;font-family:'Syne',sans-serif;letter-spacing:1.5px;cursor:pointer;transition:background 0.8s;}
        }
      `}</style>

      <nav>
        <button className="back-btn" onClick={() => router.back()}>← back</button>
        <button ref={logoRef} className="nav-logo" onClick={() => router.push('/')} aria-label="Pulse home">
          <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
        </button>
        <div className="admin-tools">
          {isHostOrAdmin && <>
            <button className="tool-btn" onClick={() => { setGuestLink(null); setGlCount(1); setLinkSheetOpen(true) }}>link</button>
            <button className="tool-btn" onClick={openGuestManager}>guests</button>
            <button className="tool-btn" onClick={() => router.push(`/host/edit/${event.id}`)}>edit</button>
          </>}
          <button className="share-btn" onClick={shareEvent}>{shared ? 'copied' : 'share'}</button>
        </div>
      </nav>

      {event.cover_image_url && (
        <div className="ambient" aria-hidden="true">
          <div className="ambient-img" style={{backgroundImage:`url(${event.cover_image_url})`}}/>
          <div className="ambient-tint"/>
        </div>
      )}

      <main className="page">
        <div className="poster-col">
          <div className="poster" data-flyer style={{viewTransitionName:'flyer'}}>
            {event.feed_video_url ? (
              <video src={event.feed_video_url} autoPlay muted loop playsInline poster={event.cover_image_url ?? undefined}/>
            ) : event.cover_image_url ? (
              <img src={event.cover_image_url} alt={`${event.title} flyer`}/>
            ) : (
              <div className="poster-empty"><canvas ref={canvasRef} className="hero-canvas" aria-hidden="true"/></div>
            )}
          </div>
        </div>

        <div className="info-col">
          <header className="ev-head">
            <h1 className="ev-title">{event.title}</h1>
            {going >= 10 && (
              <div className="ev-sub"><span className="going">{going} going</span></div>
            )}
          </header>

          <div className="fact-bar">
            <div className="fact"><div className="fact-k">{rel ? date : 'date'}</div><div className="fact-v">{rel ?? date}</div></div>
            {time && <div className="fact"><div className="fact-k">{doorsTime ? 'doors' : 'time'}</div><div className="fact-v">{doorsTime || time}</div></div>}
            {event.venue_name && <div className="fact"><div className="fact-k">venue</div><div className="fact-v">{event.venue_name}</div></div>}
          </div>

          {lineup.length > 0 && (
            <section className="section">
              <h2 className="sec-title">Lineup</h2>
              {hasSetTimes ? (
                <div className="details">
                  {timetable.map((a, i) => (
                    <div key={i} className="detail">
                      <span className="detail-ic">{setStart(a.time)?.label ?? 'TBA'}</span>
                      <span className="detail-txt">
                        <div className={`detail-k lineup-name ${isHeadliner(a) ? 'head' : ''}`}>{a.name}</div>
                        {a.time && <div className="detail-v">{a.time.toLowerCase()}</div>}
                      </span>
                      {isHeadliner(a) && <span className="head-chip">Headliner</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="billing">
                  {headliners.map((a, i) => <div key={i} className="bill-head">{a.name}</div>)}
                  {support.length > 0 && (
                    <div className={`bill-rest ${headliners.length ? '' : 'solo'}`}>
                      {support.map((a, i) => (
                        <span key={i}>{i > 0 && <span className="bill-sep"> · </span>}{a.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {event.description && (
            <section className="section">
              <h2 className="sec-title">About</h2>
              <p className={`desc ${longAbout && !aboutOpen ? 'clamped' : ''}`}>{event.description}</p>
              {longAbout && <button className="more-btn" onClick={() => setAboutOpen(o => !o)}>{aboutOpen ? 'Show less' : 'Read more'}</button>}
            </section>
          )}

          <section className="section" id="tickets">
            <h2 className="sec-title">Tickets</h2>
            <div className="tickets">
            {sortedTiers.length > 0 ? (
              sortedTiers.map((tier, index) => {
                const price = safePrice(tier.price)
                const available = remainingOf(tier)
                const soldOut = available <= 0
                const { locked, reason } = lockInfoFor(tier, index)
                // The price the buyer faces once this tier is gone
                const nextTier = !soldOut && !locked ? sortedTiers.slice(index + 1).find(t => remainingOf(t) > 0 && safePrice(t.price) > price) : undefined
                const maxQty = Math.min(available, 10)
                const qty = Math.min(selectedQty[tier.id] || 1, Math.max(1, maxQty))
                const setQty = (n: number) => setSelectedQty(prev => ({ ...prev, [tier.id]: n }))
                const isBuying = buyingTier === tier.id
                // Door tier: hide the availability bar (still sells, still goes sold-out)
                const hideAvailability = tier.name.trim().toLowerCase() === 'door'
                const low = !soldOut && !locked && !hideAvailability && available <= 12
                const soldPct = tier.quantity > 0
                  ? Math.max(2, ((tier.quantity - available) / tier.quantity) * 100)
                  : 0
                return (
                  <div key={tier.id} className={`ticket ${soldOut ? 'dim soldout' : locked ? 'dim' : ''}`}>
                    <div className="ticket-top">
                      <div className="tier-row">
                        <div>
                          <div className="tier-name">{toRomanTierName(tier.name)}</div>
                          <div className={`tier-sub ${low ? 'low' : ''}`}>
                            {soldOut ? 'sold out' : locked ? reason : low ? `only ${available} left` : price === 0 ? 'free admission' : 'general admission'}
                          </div>
                        </div>
                        <div className="tier-price">
                          {displayPrice(price, 1)}
                        </div>
                      </div>
                      {!soldOut && !locked && !hideAvailability && (
                        <div className="avail-bar"><div className="avail-fill" style={{width:`${soldPct}%`}}/></div>
                      )}
                      {nextTier && (
                        <div className="tier-next">Price goes up to <b>{money(safePrice(nextTier.price))}</b> after this tier</div>
                      )}
                    </div>
                    <div className="ticket-bottom">
                      {soldOut ? (
                        <div className="state-pill">sold out</div>
                      ) : locked ? (
                        <div className="state-pill">not yet released</div>
                      ) : (
                        <div className="checkout-row">
                          <div className="stepper">
                            <button type="button" aria-label="Fewer tickets" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
                            <span aria-live="polite">{qty}</span>
                            <button type="button" aria-label="More tickets" disabled={qty >= maxQty} onClick={() => setQty(qty + 1)}>+</button>
                          </div>
                          <BuyButton tier={tier} qty={qty} isBuying={isBuying} onClick={() => handleBuyTicket(tier)}/>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="ticket dim">
                <div className="ticket-top" style={{textAlign:'center'}}>
                  <div className="tier-name">tickets not available yet</div>
                </div>
                <div className="ticket-bottom"><div className="state-pill">check back soon</div></div>
              </div>
            )}
            </div>
          </section>

          <section className="section">
            <h2 className="sec-title">Details</h2>
            <div className="details">
              {(event.venue_name || street) && (
                <a className="detail" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  <span className="detail-ic">{cityCode}</span>
                  <span className="detail-txt">
                    <div className="detail-k">{event.venue_name || street}</div>
                    {street && <div className="detail-v">{street}{event.state ? `, ${event.state}` : ''}</div>}
                  </span>
                  <span className="detail-go">Maps ↗</span>
                </a>
              )}
              <button type="button" className="detail" onClick={() => setCalOpen(o => !o)} disabled={!calStart} aria-expanded={calOpen}>
                <span className="detail-ic">{(time || 'TBA').toUpperCase()}</span>
                <span className="detail-txt">
                  <div className="detail-k">{rel ? `${rel} · ` : ''}{date}{time ? ` · ${time}` : ''}</div>
                  {doorsTime && <div className="detail-v">Doors open {doorsTime}</div>}
                </span>
                {calStart && <span className="detail-go">{calOpen ? 'Close' : 'Add to cal'}</span>}
              </button>
              {calOpen && calStart && (
                <div className="cal-opts">
                  <a className="cal-opt" href={`/api/ics?id=${event.id}`}>Apple / Outlook</a>
                  {googleCalUrl && <a className="cal-opt" href={googleCalUrl} target="_blank" rel="noopener noreferrer">Google Calendar</a>}
                </div>
              )}
              {event.is_21_plus && (
                <div className="detail">
                  <span className="detail-ic">21+</span>
                  <span className="detail-txt"><div className="detail-k">21+</div><div className="detail-v">Valid ID required at the door</div></span>
                </div>
              )}
              {event.dress_code && (
                <div className="detail">
                  <span className="detail-ic">FIT</span>
                  <span className="detail-txt"><div className="detail-k">Dress code</div><div className="detail-v">{event.dress_code}</div></span>
                </div>
              )}
            </div>
          </section>

          {event.spotify_playlist_url && spotifyEmbed(event.spotify_playlist_url) && (
            <section className="section">
              <h2 className="sec-title">Sound</h2>
              <div className="spotify-wrap">
                <iframe src={spotifyEmbed(event.spotify_playlist_url)!} width="100%" height="152" frameBorder="0" allow="clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" title="Spotify player" style={{display:'block'}}/>
              </div>
            </section>
          )}

          {hasSocial && (
            <div className="socials">
              {event.instagram_handle && <a className="social" href={igUrl(event.instagram_handle)} target="_blank" rel="noopener noreferrer">Instagram</a>}
              {event.tiktok_url && <a className="social" href={event.tiktok_url} target="_blank" rel="noopener noreferrer">TikTok</a>}
            </div>
          )}
        </div>
      </main>

      {buyableTier && (
        <div className="mobile-buy">
          <div>
            <div className="mobile-buy-k">{toRomanTierName(buyableTier.name)}</div>
            <div className="mobile-buy-price">{displayPrice(safePrice(buyableTier.price), 1)}</div>
          </div>
          <button
            className="mobile-buy-btn"
            onClick={() => document.getElementById('tickets')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            get tickets
          </button>
        </div>
      )}

      {linkSheetOpen && (
        <div className="gl-backdrop" onClick={() => setLinkSheetOpen(false)}>
          <div className="gl-sheet" onClick={e => e.stopPropagation()}>
            <div className="gl-drag"/>
            <div className="gl-sheet-title">guest list link</div>
            <p className="gl-sheet-desc">
              {guestLink
                ? `This link works once — whoever claims it gets ${glCount} free guest ${glCount === 1 ? 'ticket' : 'tickets'} in their account. Generate a new link for the next person.`
                : 'Pick how many guest tickets the person who claims this link gets, then generate it.'}
            </p>
            {!guestLink && <FlipCounter value={glCount} onChange={setGlCount} label="tickets on this link"/>}
            {guestLink && (
              <div className="gl-url-row">
                <input className="gl-url-input" readOnly value={guestLink} onFocus={e => e.currentTarget.select()}/>
                <button className={`gl-copy-btn ${linkCopied ? 'copied' : ''}`} onClick={copyGuestLink}>
                  {linkCopied ? 'copied' : 'copy'}
                </button>
              </div>
            )}
            {guestLink
              ? <button className="gl-close-btn" onClick={() => { setGuestLink(null); setLinkCopied(false) }}>new link</button>
              : <button className="gl-copy-btn" style={{width:'100%',marginBottom:'4px'}} onClick={generateGuestLink} disabled={genningLink}>{genningLink ? 'generating…' : 'generate link'}</button>}
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