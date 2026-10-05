'use client'
import { useEffect, useState, useRef } from 'react'
import { usePageReveal, useNavLogo } from '../../lib/animations'
import TouchBlot from '../../components/TouchBlot'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import { usePageView } from '../../lib/usePageView'
import FlipCounter from '../../components/FlipCounter'
import { loadFlyer, NEUTRAL_PALETTE, type FlyerPalette, type FlyerInfo } from '../../lib/flyerColor'
import { authFetch } from '../../lib/authFetch'

type AppliedPromo = { code: string; kind: 'percent' | 'amount'; value: number; label: string }
type HostPromo = { id: string; code: string; kind: 'percent' | 'amount'; value: number; max_uses: number | null; uses: number; expires_at: string | null; active: boolean }

// Mirrors applyPromo in lib/promo.ts (the server re-applies it at checkout)
function discounted(price: number, p: Pick<AppliedPromo, 'kind' | 'value'> | null): number {
  if (!p) return price
  const off = p.kind === 'percent' ? price * (Math.min(100, p.value) / 100) : p.value
  return Math.max(0, Math.round((price - off) * 100) / 100)
}

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
function setStart(time?: string): { order: number } | null {
  const m = time?.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (!m) return null
  let h = parseInt(m[1]) % 12
  if (m[3]?.toLowerCase() === 'pm') h += 12
  if (h < 8) h += 24
  return { order: h * 60 + (m[2] ? parseInt(m[2]) : 0) }
}

// Hosts type descriptions with hard line breaks mid-sentence ("makes his\nreturn").
// Keep blank-line paragraphs; join a single break when the next line continues in lowercase.
function aboutParagraphs(text: string): string[] {
  return text.trim().split(/\n\s*\n/).map(p => p.replace(/\n(?=[a-z])/g, ' ').trim()).filter(Boolean)
}

const isHeadliner = (a: Act) => /headlin/i.test(a.role ?? '')

// Small line icons for the details list
const svgProps = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const IcPin = () => <svg {...svgProps}><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
const IcClock = () => <svg {...svgProps}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
const IcId = () => <svg {...svgProps}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6.5 16c.6-1.4 1.5-2 2.5-2s1.9.6 2.5 2M14 10h4M14 13h3"/></svg>
const IcAt = () => <svg {...svgProps}><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/></svg>
const IcPlay = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>
const IcPause = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
const IcShirt = () => <svg {...svgProps}><path d="M8 3l-5 3 2 4 2-1v12h10V9l2 1 2-4-5-3a4 4 0 0 1-8 0z"/></svg>


export default function EventDetail() {
  const router = useRouter()
  const params = useParams()
  const eventId = params.id as string
  const logoRef = useNavLogo<HTMLButtonElement>()
  usePageReveal({ selectors: ['.poster', '.ev-head', '.section'], delay: 0.15 })
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
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [palette, setPalette] = useState<FlyerPalette>(NEUTRAL_PALETTE)
  // Set only when the uploaded flyer has a solid frame to crop off
  const [flyer, setFlyer] = useState<FlyerInfo | null>(null)
  const [aboutOpen, setAboutOpen] = useState(false)
  const [shared, setShared] = useState(false)
  const [calOpen, setCalOpen] = useState(false)
  // Free tickets without an account: where to send them
  const [guestSheet, setGuestSheet] = useState<Tier | null>(null)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')
  const [guestError, setGuestError] = useState('')

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
  // Removing a guest takes two taps (Remove → Confirm) so a slip doesn't cancel someone's tickets
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  // Ticket type the buyer picked (defaults to the cheapest one on sale)
  const [pickedTierId, setPickedTierId] = useState<string | null>(null)

  // Host tools live in one Manage sheet
  const [hostMenuOpen, setHostMenuOpen] = useState(false)

  // Promo codes — buyer side
  const [promo, setPromo] = useState<AppliedPromo | null>(null)
  const [promoOpen, setPromoOpen] = useState(false)
  const [promoInput, setPromoInput] = useState('')
  const [promoError, setPromoError] = useState('')
  const [applyingPromo, setApplyingPromo] = useState(false)

  // Promo codes — host side
  const [promosOpen, setPromosOpen] = useState(false)
  const [promos, setPromos] = useState<HostPromo[]>([])
  const [loadingPromos, setLoadingPromos] = useState(false)
  const [pForm, setPForm] = useState({ code: '', kind: 'percent' as 'percent' | 'amount', value: '', max_uses: '', expires: '' })
  const [pError, setPError] = useState('')
  const [pSaving, setPSaving] = useState(false)
  const [confirmDeletePromo, setConfirmDeletePromo] = useState<string | null>(null)

  // The one checkout button: solid white, shows the total for the picked ticket and quantity
  const BuyButton = ({ tier, qty, isBuying, onClick }: { tier: Tier; qty: number; isBuying: boolean; onClick: () => void }) => {
    const price = discounted(safePrice(tier.price), promo)
    const label = isBuying ? 'Processing…' : price === 0 ? `Get ${qty > 1 ? `${qty} tickets` : 'ticket'} · Free` : `Get ${qty > 1 ? `${qty} tickets` : 'ticket'} · ${money(price * qty)}`
    return (
      <button className="buy-btn" disabled={isBuying} onClick={onClick}>
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
    loadFlyer(event.cover_image_url).then(f => { if (!alive) return; setPalette(f.palette); if (f.trim) setFlyer(f) })
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
    audioRef.current = a
    const onTime = () => setProgress(a.duration ? a.currentTime / a.duration : 0)
    const onEnd = () => { setPlaying(false); setProgress(0) }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnd); a.pause(); a.src = '' }
  }, [])

  // Our own play button for the 30s Spotify preview (the embed looked bolted on)
  const togglePlay = () => {
    const a = audioRef.current
    if (!a || !previewUrl) return
    if (a.src !== previewUrl) a.src = previewUrl
    if (a.paused) a.play().then(() => setPlaying(true)).catch(() => {})
    else { a.pause(); setPlaying(false) }
  }

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

  // No account needed: signed-out buyers give a name + email first (free tickets are emailed
  // right away; paid ones continue to Stripe with that email prefilled).
  const handleBuyTicket = async (tier: Tier, guest?: { buyerName: string; buyerEmail: string }) => {
    const qty = selectedQty[tier.id] || 1
    const { data: { user } } = await createClient().auth.getUser()
    if (!user && !guest) { setGuestError(''); setGuestSheet(tier); return }
    setBuyingTier(tier.id)
    try {
      const res = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tierId: tier.id, eventId: event?.id, quantity: qty, ...(user ? { userId: user.id } : guest), ...(promo ? { promoCode: promo.code } : {}) }) })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else if (guest) setGuestError(data.error ?? 'Something went wrong')
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
    setConfirmRemove(null)
    try {
      const res = await authFetch('/api/claim-guest', {
        method: 'POST',
        body: JSON.stringify({ action: 'list', eventId: event.id }),
      })
      const data = await res.json()
      setGuests(data.guests ?? [])
    } catch {}
    setLoadingGuests(false)
  }

  const removeGuest = async (ticketId: string) => {
    if (!event || !currentUser) return
    if (confirmRemove !== ticketId) { setConfirmRemove(ticketId); return }
    setRemovingId(ticketId)
    try {
      const res = await authFetch('/api/claim-guest', {
        method: 'POST',
        body: JSON.stringify({ action: 'remove', eventId: event.id, ticketId }),
      })
      if (res.ok) setGuests(g => g.filter(x => x.ticket_id !== ticketId))
    } catch {}
    setConfirmRemove(null)
    setRemovingId(null)
  }

  // ── Promo codes ──
  const applyPromoCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event || !promoInput.trim()) return
    setApplyingPromo(true)
    setPromoError('')
    try {
      const res = await fetch('/api/promo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: event.id, code: promoInput }) })
      const d = await res.json()
      if (res.ok) { setPromo(d); setPromoOpen(false) } else setPromoError(d.error ?? 'That code isn’t valid.')
    } catch { setPromoError('Couldn’t check that code. Try again.') }
    setApplyingPromo(false)
  }

  const openPromos = async () => {
    if (!event) return
    setPromosOpen(true)
    setLoadingPromos(true)
    setPError('')
    try {
      const res = await authFetch(`/api/host/promos?eventId=${event.id}`)
      const d = await res.json()
      setPromos(d.promos ?? [])
    } catch {}
    setLoadingPromos(false)
  }

  const createPromo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event) return
    setPSaving(true)
    setPError('')
    try {
      const res = await authFetch('/api/host/promos', {
        method: 'POST',
        body: JSON.stringify({
          eventId: event.id,
          code: pForm.code,
          kind: pForm.kind,
          value: pForm.value,
          max_uses: pForm.max_uses,
          // Expiry date means "through the end of that day"
          expires_at: pForm.expires ? new Date(`${pForm.expires}T23:59:59`).toISOString() : null,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setPromos(p => [d.promo, ...p])
        setPForm({ code: '', kind: pForm.kind, value: '', max_uses: '', expires: '' })
      } else setPError(d.error ?? 'Couldn’t create the code.')
    } catch { setPError('Couldn’t create the code.') }
    setPSaving(false)
  }

  const togglePromo = async (p: HostPromo) => {
    if (!event) return
    const res = await authFetch('/api/host/promos', { method: 'PATCH', body: JSON.stringify({ eventId: event.id, id: p.id, active: !p.active }) })
    if (res.ok) setPromos(list => list.map(x => x.id === p.id ? { ...x, active: !p.active } : x))
  }

  const deletePromo = async (p: HostPromo) => {
    if (!event) return
    if (confirmDeletePromo !== p.id) { setConfirmDeletePromo(p.id); return }
    const res = await authFetch(`/api/host/promos?eventId=${event.id}&id=${p.id}`, { method: 'DELETE' })
    if (res.ok) setPromos(list => list.filter(x => x.id !== p.id))
    setConfirmDeletePromo(null)
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

  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent([event.venue_name, street, event.state].filter(Boolean).join(' '))}`
  const longAbout = (event.description ?? '').length > 260
  const rel = relativeDay(event.starts_at)
  // One line each for when and where, right under the title — every fact appears once on the page
  const monthDay = event.starts_at ? new Date(event.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : null
  const whenLine = [rel && monthDay ? `${rel}, ${monthDay}` : date, time].filter(Boolean).join(' · ')
    + (doorsTime && doorsTime !== time ? ` · doors ${doorsTime}` : '')
  const whereLine = [event.venue_name, event.city].map(x => x?.trim()).filter(Boolean).join(', ')

  // Calendar: .ics for Apple/Outlook, template link for Google
  const calStart = event.starts_at ? new Date(event.starts_at) : null
  const calEnd = event.ends_at ? new Date(event.ends_at) : calStart ? new Date(calStart.getTime() + 5 * 3600000) : null
  const googleCalUrl = calStart && calEnd
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${calStamp(calStart)}/${calStamp(calEnd)}&location=${encodeURIComponent([event.venue_name, street, event.state].filter(Boolean).join(', '))}&details=${encodeURIComponent(`Tickets: ${typeof window !== 'undefined' ? window.location.href : ''}`)}`
    : null

  const lineup = parseLineup(event.lineup)
  const hasSetTimes = lineup.some(a => setStart(a.time))
  const lineupRows = hasSetTimes
    ? [...lineup].sort((a, b) => (setStart(a.time)?.order ?? 9999) - (setStart(b.time)?.order ?? 9999))
    : [...lineup.filter(isHeadliner), ...lineup.filter(a => !isHeadliner(a))]

  const sortedTiers = [...(event.ticket_tiers ?? [])].sort((a, b) => safePrice(a.price) - safePrice(b.price))

  // A tier is locked when a scheduled release hasn't arrived, or — under the
  // ladder rule — when any cheaper tier still has inventory left.
  const lockInfoFor = (tier: Tier, index: number): { locked: boolean; reason: string } => {
    if (tier.available_at) {
      const opensAt = new Date(tier.available_at).getTime()
      if (!isNaN(opensAt) && Date.now() < opensAt) {
        const d = new Date(opensAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toLowerCase()
        return { locked: true, reason: `Opens ${d}` }
      }
    }
    if (LADDER_RELEASE && index > 0) {
      const blocker = sortedTiers.slice(0, index).find(t => remainingOf(t) > 0)
      if (blocker) {
        return { locked: true, reason: `Opens when ${blocker.name.trim()} sells out` }
      }
    }
    return { locked: false, reason: '' }
  }

  // Mobile bar should quote the cheapest tier someone can actually buy
  const buyableTier = sortedTiers.find((t, i) => remainingOf(t) > 0 && !lockInfoFor(t, i).locked) ?? null
  // What the checkout button and sticky bar sell: the picked ticket type, else the cheapest on sale
  const selectedTier = sortedTiers.find((t, i) => t.id === pickedTierId && remainingOf(t) > 0 && !lockInfoFor(t, i).locked) ?? buyableTier
  const selQty = selectedTier ? Math.min(selectedQty[selectedTier.id] || 1, Math.max(1, Math.min(remainingOf(selectedTier), 10))) : 1
  const selUnit = selectedTier ? discounted(safePrice(selectedTier.price), promo) : 0

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
        .tool-btn{background:none;border:0.5px solid rgba(255,255,255,0.16);color:rgba(255,255,255,0.55);font-size:11px;font-family:'Syne',sans-serif;letter-spacing:0.5px;padding:6px 11px;cursor:pointer;transition:all 0.15s;white-space:nowrap;border-radius:12px;}
        .tool-btn:hover{border-color:rgba(255,255,255,0.4);color:#fff;}
        .tool-btn:disabled{opacity:0.3;cursor:not-allowed;}

        .gl-backdrop{position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.8);display:flex;align-items:flex-end;justify-content:center;}
        .gl-sheet{width:100%;max-width:460px;background:#080808;border:0.5px solid rgba(255,255,255,0.1);padding:12px 22px 36px;border-radius:12px 12px 0 0;}
        .gl-drag{width:36px;height:3px;background:rgba(255,255,255,0.12);margin:0 auto 22px;}
        .gl-sheet-title{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:700;color:#fff;margin-bottom:6px;}
        .gl-sheet-desc{font-size:12px;color:rgba(255,255,255,0.35);line-height:1.6;margin-bottom:18px;}
        .gl-url-row{display:flex;gap:8px;margin-bottom:12px;}
        .gl-url-input{flex:1;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);padding:11px 12px;font-size:12px;color:rgba(255,255,255,0.65);font-family:'Syne',sans-serif;outline:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:12px;}
        .gl-copy-btn{padding:11px 18px;background:#fff;color:#000;border:none;font-size:12px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;white-space:nowrap;border-radius:12px;}
        .gl-copy-btn.copied{background:#5ec888;}
        .gl-close-btn{width:100%;padding:12px;background:transparent;border:0.5px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.4);font-size:12px;font-family:'Syne',sans-serif;cursor:pointer;margin-top:4px;border-radius:12px;}
        .gm-search{width:100%;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.1);padding:10px 12px;font-size:13px;color:#fff;font-family:'Syne',sans-serif;outline:none;margin-bottom:12px;border-radius:12px;}
        .guest-in{font-size:16px;padding:13px 12px;border-radius:12px;}
        .gm-remove.confirm{border-color:rgba(255,120,120,0.6);color:#ff8a8a;}
        .host-menu{display:flex;flex-direction:column;margin-bottom:14px;border-top:1px solid rgba(255,255,255,0.08);}
        .host-menu button{display:flex;flex-direction:column;gap:3px;text-align:left;background:none;border:none;border-bottom:1px solid rgba(255,255,255,0.08);padding:14px 2px;cursor:pointer;font-family:'Syne',sans-serif;}
        .host-menu b{font-size:15px;font-weight:600;color:#fff;}
        .host-menu span{font-size:13px;color:rgba(255,255,255,0.5);}
        .promo-create{display:flex;flex-direction:column;}
        .promo-in{font-size:16px;padding:12px;}
        .seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:rgba(255,255,255,0.04);border-radius:12px;padding:4px;margin-bottom:12px;}
        .seg button{padding:10px;border:none;border-radius:9px;background:none;color:rgba(255,255,255,0.55);font-size:13px;font-weight:600;font-family:'Syne',sans-serif;cursor:pointer;}
        .seg button.on{background:#fff;color:#000;}
        .two{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
        .promo-paused{color:rgba(255,255,255,0.4);font-weight:500;}
        .promo-link{align-self:flex-start;background:none;border:none;padding:4px 0;font-size:14px;font-weight:500;color:rgba(255,255,255,0.6);font-family:'Syne',sans-serif;cursor:pointer;text-decoration:underline;text-decoration-color:rgba(255,255,255,0.25);text-underline-offset:3px;}
        .promo-link:hover{color:rgba(255,255,255,0.7);}
        .promo-form{display:flex;gap:8px;}
        .promo-form .promo-in{margin-bottom:0;}
        .promo-apply{padding:0 18px;border-radius:12px;border:none;background:#fff;color:#000;font-size:14px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;}
        .promo-apply:disabled{opacity:0.4;}
        .promo-on{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:14px;color:rgba(255,255,255,0.7);}
        .promo-on b{color:#fff;}
        .tier-was{font-family:'Syne',sans-serif;font-size:15px;font-weight:500;color:rgba(255,255,255,0.4);margin-right:8px;vertical-align:middle;}
        .guest-err{font-size:12px;color:#ff8a8a;margin:-4px 0 10px;}
        .guest-go{width:100%;margin-bottom:4px;}
        .gm-search::placeholder{color:rgba(255,255,255,0.25);}
        .gm-list{max-height:46vh;overflow-y:auto;display:flex;flex-direction:column;gap:6px;margin-bottom:14px;}
        .gm-row{display:flex;align-items:center;gap:11px;padding:9px 11px;border:0.5px solid rgba(255,255,255,0.07);border-radius:12px;}
        .gm-av{width:28px;height:28px;border-radius:50%;border:0.5px solid rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:rgba(255,255,255,0.5);flex-shrink:0;font-family:'Syne',sans-serif;}
        .gm-info{flex:1;min-width:0;}
        .gm-name{font-size:13px;font-weight:600;color:#f0f0f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .gm-email{font-size:11px;color:rgba(255,255,255,0.28);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .gm-in{font-size:12px;font-weight:600;color:#5ec888;flex-shrink:0;}
        .gm-remove{background:none;border:0.5px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);padding:5px 11px;font-size:11px;font-family:'Syne',sans-serif;cursor:pointer;flex-shrink:0;border-radius:12px;}
        .gm-remove:hover{border-color:rgba(255,120,120,0.5);color:rgba(255,140,140,0.9);}
        .gm-remove:disabled{opacity:0.4;cursor:default;}
        .gm-empty{font-size:13px;color:rgba(255,255,255,0.3);padding:10px 0;}

        .page{position:relative;z-index:1;max-width:1120px;margin:0 auto;padding:20px 20px 150px;display:grid;grid-template-columns:minmax(0,1fr);gap:26px;}
        @media(min-width:900px){
          .page{grid-template-columns:minmax(0,440px) minmax(0,1fr);gap:56px;padding:48px 32px 120px;align-items:start;}
          .poster-col{position:sticky;top:88px;}
        }

        /* POSTER — the flyer shown whole, as printed */
        .poster{position:relative;width:100%;max-width:440px;margin:0 auto;border-radius:12px;overflow:hidden;background:#111;box-shadow:0 30px 80px rgba(0,0,0,0.6),0 0 0 1px rgba(255,255,255,0.08);}
        .poster img,.poster video{display:block;width:100%;height:auto;max-height:72vh;object-fit:cover;}
        .poster-empty{aspect-ratio:4/5;position:relative;}
        .poster-crop{position:relative;overflow:hidden;}
        .poster .poster-crop img{position:absolute;max-height:none;max-width:none;object-fit:fill;}
        .hero-canvas{position:absolute;inset:0;width:100%;height:100%;}

        /* HEAD */
        .ev-head{display:flex;flex-direction:column;gap:12px;}
        .ev-title{font-family:'Barlow Condensed',sans-serif;font-size:clamp(44px,12vw,80px);font-weight:900;text-transform:uppercase;line-height:0.88;color:#fff;letter-spacing:-0.5px;text-wrap:balance;}
        .ev-sub{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;font-size:13px;color:rgba(255,255,255,0.55);}

        .ev-when{font-size:18px;font-weight:600;color:#fff;line-height:1.3;}
        .ev-where{font-size:15px;color:rgba(255,255,255,0.6);margin-top:4px;line-height:1.3;}

        /* SECTIONS */
        .info-col{display:flex;flex-direction:column;gap:26px;min-width:0;}
        .section{display:flex;flex-direction:column;gap:14px;}
        .sec-title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#fff;line-height:1;}
        .desc{display:flex;flex-direction:column;gap:12px;font-size:15px;line-height:1.75;color:rgba(255,255,255,0.72);white-space:pre-line;}
        .desc.clamped{max-height:8.75em;overflow:hidden;-webkit-mask-image:linear-gradient(#000 55%,transparent);mask-image:linear-gradient(#000 55%,transparent);}
        .more-btn{align-self:flex-start;background:none;border:none;padding:0;color:#fff;font-size:13px;font-weight:600;font-family:'Syne',sans-serif;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.3);}

        /* Plain list with hairlines, like a printed program — no cards, no chips */
        .details{display:flex;flex-direction:column;border-top:1px solid rgba(255,255,255,0.09);}
        .detail{display:flex;align-items:flex-start;gap:14px;padding:16px 0;border-bottom:1px solid rgba(255,255,255,0.09);text-decoration:none;color:inherit;}
        .detail-ic{flex-shrink:0;display:flex;padding-top:1px;color:rgba(255,255,255,0.5);}
        .detail-txt{flex:1;min-width:0;}
        .detail-k{font-size:15px;font-weight:500;color:#fff;line-height:1.35;}
        .detail-v{font-size:13px;color:rgba(255,255,255,0.5);margin-top:3px;line-height:1.4;}
        .detail-go{font-size:13px;color:rgba(255,255,255,0.7);white-space:nowrap;text-decoration:underline;text-decoration-color:rgba(255,255,255,0.3);text-underline-offset:3px;padding-top:1px;}
        .detail-meta{font-size:13px;color:rgba(255,255,255,0.5);white-space:nowrap;padding-top:1px;font-variant-numeric:tabular-nums;}
        button.detail{width:100%;background:none;border:none;border-bottom:1px solid rgba(255,255,255,0.09);font:inherit;text-align:left;cursor:pointer;}
        button.detail:disabled{cursor:default;}
        button.detail[aria-expanded="true"]{border-bottom:none;padding-bottom:10px;}
        .cal-opts{display:flex;gap:20px;padding:0 0 16px 32px;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,0.09);}
        .cal-opt{font-size:13px;color:#fff;text-decoration:underline;text-decoration-color:rgba(255,255,255,0.3);text-underline-offset:3px;}
        .lineup-row{padding:14px 0;}

        .socials{display:flex;gap:16px;flex-wrap:wrap;}
        .social{color:rgba(255,255,255,0.75);text-decoration:underline;text-decoration-color:rgba(255,255,255,0.3);text-underline-offset:3px;}
        .social:hover{text-decoration-color:#fff;}

        .player{display:flex;align-items:center;gap:14px;padding:14px 0;border-top:1px solid rgba(255,255,255,0.09);border-bottom:1px solid rgba(255,255,255,0.09);}
        .play{width:44px;height:44px;border-radius:50%;background:#fff;color:#000;border:none;display:flex;align-items:center;justify-content:center;flex-shrink:0;cursor:pointer;}
        .player-txt{flex:1;min-width:0;}
        .player-title{font-size:15px;font-weight:500;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .player-artist{font-size:13px;color:rgba(255,255,255,0.5);margin-top:2px;}
        .player-bar{height:2px;background:rgba(255,255,255,0.12);border-radius:2px;overflow:hidden;margin-top:10px;}
        .player-bar div{height:100%;background:#fff;transition:width 0.25s linear;}

        .share-btn{background:none;border:0.5px solid rgba(255,255,255,0.16);color:rgba(255,255,255,0.75);font-size:11px;font-family:'Syne',sans-serif;padding:6px 11px;cursor:pointer;white-space:nowrap;border-radius:12px;}

        /* TICKETS — one clean card per tier on sale; sold-out / unreleased tiers are a single quiet line */
        .tickets{display:flex;flex-direction:column;gap:10px;}
        /* Tap a ticket type to pick it; the picked one gets a white outline and its quantity control */
        .ticket{background:#0e0e0e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:14px;cursor:pointer;transition:border-color 0.15s,background 0.15s;}
        .ticket:hover{border-color:rgba(255,255,255,0.25);}
        .ticket.on{border-color:#fff;background:#141414;box-shadow:inset 0 0 0 1px #fff;}
        .ticket:focus-visible{outline:2px solid #fff;outline-offset:2px;}
        .tier-row{display:flex;justify-content:space-between;align-items:center;gap:14px;}
        .tier-name{font-size:16px;font-weight:600;color:#fff;}
        .tier-sub{font-size:13px;color:rgba(255,255,255,0.55);margin-top:3px;}
        .tier-price{font-family:'Barlow Condensed',sans-serif;font-size:32px;font-weight:700;color:#fff;line-height:0.9;white-space:nowrap;}
        .qty-row{display:flex;justify-content:space-between;align-items:center;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);cursor:default;}
        .qty-label{font-size:14px;color:rgba(255,255,255,0.6);}
        .qty-row .stepper button{min-height:40px;}
        .tier-next{font-size:13px;color:rgba(255,255,255,0.5);margin-top:-6px;}
        .tier-next b{color:#fff;font-weight:600;}
        .checkout-row{display:flex;gap:10px;align-items:stretch;}
        .stepper{display:flex;align-items:center;border:1px solid rgba(255,255,255,0.14);border-radius:12px;flex-shrink:0;}
        .stepper button{width:36px;height:100%;min-height:48px;background:none;border:none;color:#fff;font-size:18px;cursor:pointer;font-family:'Syne',sans-serif;}
        .stepper button:disabled{color:rgba(255,255,255,0.2);cursor:default;}
        .stepper span{min-width:20px;text-align:center;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;}
        .tier-off{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:12px 2px;font-size:14px;color:rgba(255,255,255,0.4);border-bottom:1px solid rgba(255,255,255,0.07);}
        .tier-off:last-child{border-bottom:none;}
        .tier-off-state{text-align:right;}

        /* The checkout button: solid white, black text — high contrast on any flyer */
        .buy-btn{width:100%;min-height:54px;background:#fff;color:#000;border:none;border-radius:12px;padding:16px 18px;font-size:15px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;transition:background 0.15s,transform 0.1s;text-align:center;white-space:nowrap;}
        .buy-btn:hover{background:#e9e9e9;}
        .buy-btn:active{transform:scale(0.99);}
        .buy-btn:disabled{opacity:0.5;cursor:not-allowed;}

        /* Mobile: sticky bar with the picked ticket's total — buys directly */
        .mobile-buy{display:none;}
        @media(max-width:899px){
          .mobile-buy{display:flex;position:fixed;bottom:0;left:0;right:0;z-index:90;align-items:center;justify-content:space-between;gap:14px;padding:12px 18px calc(12px + env(safe-area-inset-bottom));background:rgba(0,0,0,0.92);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-top:0.5px solid rgba(255,255,255,0.12);}
          .mobile-buy-k{font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:2px;}
          .mobile-buy-price{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:#fff;line-height:1;}
          .mobile-buy-btn{background:#fff;color:#000;border:none;border-radius:12px;padding:15px 26px;font-size:15px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer;flex-shrink:0;}
          .mobile-buy-btn:disabled{opacity:0.5;}
        }
      `}</style>

      <nav>
        <button className="back-btn" onClick={() => router.back()}>← Back</button>
        <button ref={logoRef} className="nav-logo" onClick={() => router.push('/')} aria-label="Pulse home">
          <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
        </button>
        <div className="admin-tools">
          {isHostOrAdmin && <button className="tool-btn" onClick={() => setHostMenuOpen(true)}>Manage</button>}
          <button className="share-btn" onClick={shareEvent}>{shared ? 'Copied' : 'Share'}</button>
        </div>
      </nav>

      <main className="page">
        <div className="poster-col">
          <div className="poster" data-flyer style={{viewTransitionName:'flyer'}}>
            {event.feed_video_url ? (
              <video src={event.feed_video_url} autoPlay muted loop playsInline poster={event.cover_image_url ?? undefined}/>
            ) : event.cover_image_url && flyer?.trim ? (
              // Crop the frame: the box takes the art's proportions, the image is scaled/shifted so the frame falls outside
              <div className="poster-crop" style={{ aspectRatio: `${flyer.width * (1 - flyer.trim.left - flyer.trim.right)} / ${flyer.height * (1 - flyer.trim.top - flyer.trim.bottom)}` }}>
                <img src={event.cover_image_url} alt={`${event.title} flyer`} style={{
                  width: `${100 / (1 - flyer.trim.left - flyer.trim.right)}%`,
                  height: `${100 / (1 - flyer.trim.top - flyer.trim.bottom)}%`,
                  left: `${-100 * flyer.trim.left / (1 - flyer.trim.left - flyer.trim.right)}%`,
                  top: `${-100 * flyer.trim.top / (1 - flyer.trim.top - flyer.trim.bottom)}%`,
                }}/>
              </div>
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
            <div>
              <div className="ev-when">{whenLine}</div>
              {whereLine && <div className="ev-where">{whereLine}</div>}
            </div>
          </header>

          {event.description && (
            <section className="section">
              <h2 className="sec-title">About</h2>
              <div className={`desc ${longAbout && !aboutOpen ? 'clamped' : ''}`}>
                {aboutParagraphs(event.description).map((para, i) => <p key={i}>{para}</p>)}
              </div>
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
                // Door tier: hide the availability bar (still sells, still goes sold-out)
                const hideAvailability = tier.name.trim().toLowerCase() === 'door'
                const low = !soldOut && !locked && !hideAvailability && available <= 12
                if (soldOut || locked) return (
                  <div key={tier.id} className="tier-off">
                    <span>{tier.name.trim()}</span>
                    <span className="tier-off-state">{displayPrice(price, 1)} · {soldOut ? 'Sold out' : reason}</span>
                  </div>
                )
                // Pick a ticket type, then buy (one checkout button below the list)
                const selected = selectedTier?.id === tier.id
                return (
                  <div
                    key={tier.id}
                    className={`ticket ${selected ? 'on' : ''}`}
                    role="radio"
                    aria-checked={selected}
                    tabIndex={0}
                    onClick={() => setPickedTierId(tier.id)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPickedTierId(tier.id) } }}
                  >
                    <div className="tier-row">
                      <div>
                        <div className="tier-name">{tier.name.trim()}</div>
                        {low && <div className="tier-sub">Almost gone</div>}
                      </div>
                      <div className="tier-price">
                        {promo && price > 0 && <s className="tier-was">{money(price)}</s>}
                        {displayPrice(discounted(price, promo), 1)}
                      </div>
                    </div>
                    {selected && nextTier && (
                      <div className="tier-next">Price goes up to <b>{money(safePrice(nextTier.price))}</b> after this tier</div>
                    )}
                    {selected && (
                      <div className="qty-row" onClick={e => e.stopPropagation()}>
                        <span className="qty-label">Quantity</span>
                        <div className="stepper">
                          <button type="button" aria-label="Fewer tickets" disabled={qty <= 1} onClick={() => setQty(qty - 1)}>−</button>
                          <span aria-live="polite">{qty}</span>
                          <button type="button" aria-label="More tickets" disabled={qty >= maxQty} onClick={() => setQty(qty + 1)}>+</button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="tier-off">
                <span>Tickets aren&apos;t on sale yet</span>
                <span className="tier-off-state">Check back soon</span>
              </div>
            )}
            </div>
            {selectedTier && (
              <BuyButton tier={selectedTier} qty={selQty} isBuying={buyingTier === selectedTier.id} onClick={() => handleBuyTicket(selectedTier)}/>
            )}
            {buyableTier && (promo ? (
              <div className="promo-on">
                <span>Code <b>{promo.code}</b> applied · {promo.label}</span>
                <button type="button" className="more-btn" onClick={() => { setPromo(null); setPromoInput('') }}>Remove</button>
              </div>
            ) : promoOpen ? (
              <form className="promo-form" onSubmit={applyPromoCode}>
                <input className="gm-search promo-in" placeholder="Promo code" autoCapitalize="characters" autoComplete="off" value={promoInput} onChange={e => setPromoInput(e.target.value)}/>
                <button type="submit" className="promo-apply" disabled={applyingPromo || !promoInput.trim()}>{applyingPromo ? '…' : 'Apply'}</button>
              </form>
            ) : (
              <button type="button" className="promo-link" onClick={() => setPromoOpen(true)}>Promo</button>
            ))}
            {promoError && !promo && <p className="guest-err" style={{margin:0}}>{promoError}</p>}
          </section>

          <section className="section">
            <h2 className="sec-title">Details</h2>
            <div className="details">
              {(event.venue_name || street) && (
                <a className="detail" href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  <span className="detail-ic"><IcPin/></span>
                  <span className="detail-txt">
                    <div className="detail-k">{street ? `${street}${event.state ? `, ${event.state}` : ''}` : event.venue_name}</div>
                  </span>
                  <span className="detail-go">Directions</span>
                </a>
              )}
              {calStart && (
                <button type="button" className="detail" onClick={() => setCalOpen(o => !o)} aria-expanded={calOpen}>
                  <span className="detail-ic"><IcClock/></span>
                  <span className="detail-txt">
                    <div className="detail-k">Add to calendar</div>
                    <div className="detail-v">Apple, Google or Outlook</div>
                  </span>
                </button>
              )}
              {calOpen && calStart && (
                <div className="cal-opts">
                  <a className="cal-opt" href={`/api/ics?id=${event.id}`}>Apple Calendar</a>
                  {googleCalUrl && <a className="cal-opt" href={googleCalUrl} target="_blank" rel="noopener noreferrer">Google Calendar</a>}
                  <a className="cal-opt" href={`/api/ics?id=${event.id}`}>Outlook</a>
                </div>
              )}
              {event.is_21_plus && (
                <div className="detail">
                  <span className="detail-ic"><IcId/></span>
                  <span className="detail-txt"><div className="detail-k">21+</div><div className="detail-v">Valid ID required at the door</div></span>
                </div>
              )}
              {hasSocial && (
                <div className="detail">
                  <span className="detail-ic"><IcAt/></span>
                  <span className="detail-txt">
                    <div className="detail-k">Follow</div>
                    <div className="detail-v socials">
                      {event.instagram_handle && <a className="social" href={igUrl(event.instagram_handle)} target="_blank" rel="noopener noreferrer">Instagram</a>}
                      {event.tiktok_url && <a className="social" href={event.tiktok_url} target="_blank" rel="noopener noreferrer">TikTok</a>}
                    </div>
                  </span>
                </div>
              )}
              {event.dress_code && (
                <div className="detail">
                  <span className="detail-ic"><IcShirt/></span>
                  <span className="detail-txt"><div className="detail-k">Dress code</div><div className="detail-v">{event.dress_code}</div></span>
                </div>
              )}
            </div>
          </section>

          {event.spotify_playlist_url && previewUrl !== undefined && (
            <section className="section">
              <h2 className="sec-title">Sound</h2>
              <div className="player">
                {previewUrl && (
                  <button type="button" className="play" onClick={togglePlay} aria-label={playing ? 'Pause preview' : 'Play preview'}>
                    {playing ? <IcPause/> : <IcPlay/>}
                  </button>
                )}
                <div className="player-txt">
                  <div className="player-title">{soundMeta?.title ?? 'Listen on Spotify'}</div>
                  {soundMeta?.artist && <div className="player-artist">{soundMeta.artist}</div>}
                  {previewUrl && <div className="player-bar"><div style={{width:`${progress * 100}%`}}/></div>}
                </div>
                <a className="detail-go" href={event.spotify_playlist_url} target="_blank" rel="noopener noreferrer">Spotify ↗</a>
              </div>
            </section>
          )}

          {lineup.length > 0 && (
            <section className="section">
              <h2 className="sec-title">Lineup</h2>
              <div className="details">
                {lineupRows.map((a, i) => (
                  <div key={i} className="detail lineup-row">
                    <span className="detail-txt">
                      <div className="detail-k">{a.name}</div>
                      {isHeadliner(a) && <div className="detail-v">Headliner</div>}
                    </span>
                    {a.time && <span className="detail-meta">{a.time.toLowerCase()}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </main>

      {selectedTier && (
        // Sticky bar buys directly — no scroll-to-tickets detour
        <div className="mobile-buy">
          <div>
            <div className="mobile-buy-k">{selectedTier.name.trim()}{selQty > 1 ? ` · ${selQty} tickets` : ''}</div>
            <div className="mobile-buy-price">{selUnit === 0 ? 'Free' : money(selUnit * selQty)}</div>
          </div>
          <button className="mobile-buy-btn" disabled={buyingTier === selectedTier.id} onClick={() => handleBuyTicket(selectedTier)}>
            {buyingTier === selectedTier.id ? 'Processing…' : 'Get tickets'}
          </button>
        </div>
      )}

      {guestSheet && (
        <div className="gl-backdrop" onClick={() => setGuestSheet(null)}>
          <form className="gl-sheet" onClick={e => e.stopPropagation()} noValidate onSubmit={e => {
            e.preventDefault()
            if (!guestName.trim()) { setGuestError('Add your name so the door can find you.'); return }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim())) { setGuestError('Enter a valid email — your tickets go there.'); return }
            handleBuyTicket(guestSheet, { buyerName: guestName.trim(), buyerEmail: guestEmail.trim() })
          }}>
            <div className="gl-drag"/>
            <div className="gl-sheet-title">Where should we send them?</div>
            <p className="gl-sheet-desc">No account needed — your tickets go straight to your inbox{discounted(safePrice(guestSheet.price), promo) > 0 ? ' after payment' : ''}.</p>
            <input className="gm-search guest-in" placeholder="Full name" autoComplete="name" value={guestName} onChange={e => setGuestName(e.target.value)}/>
            <input className="gm-search guest-in" type="email" inputMode="email" placeholder="Email" autoComplete="email" value={guestEmail} onChange={e => setGuestEmail(e.target.value)}/>
            {guestError && <p className="guest-err">{guestError}</p>}
            <button type="submit" className="buy-btn guest-go" disabled={buyingTier === guestSheet.id}>
              {buyingTier === guestSheet.id
                ? (discounted(safePrice(guestSheet.price), promo) > 0 ? 'Opening checkout…' : 'Sending…')
                : discounted(safePrice(guestSheet.price), promo) > 0
                  ? `Continue to payment · ${money(discounted(safePrice(guestSheet.price), promo) * (selectedQty[guestSheet.id] || 1))}`
                  : `Get ${(selectedQty[guestSheet.id] || 1) > 1 ? `${selectedQty[guestSheet.id]} tickets` : 'ticket'}`}
            </button>
            <button type="button" className="gl-close-btn" onClick={() => { try { sessionStorage.setItem('pulse_redirect', `/events/${eventId}`) } catch {}; router.push('/login') }}>Have an account? Sign in</button>
          </form>
        </div>
      )}

      {linkSheetOpen && (
        <div className="gl-backdrop" onClick={() => setLinkSheetOpen(false)}>
          <div className="gl-sheet" onClick={e => e.stopPropagation()}>
            <div className="gl-drag"/>
            <div className="gl-sheet-title">Guest list link</div>
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
                  {linkCopied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
            {guestLink
              ? <button className="gl-close-btn" onClick={() => { setGuestLink(null); setLinkCopied(false) }}>New link</button>
              : <button className="gl-copy-btn" style={{width:'100%',marginBottom:'4px'}} onClick={generateGuestLink} disabled={genningLink}>{genningLink ? 'Generating…' : 'Generate link'}</button>}
            <button className="gl-close-btn" onClick={() => setLinkSheetOpen(false)}>Done</button>
          </div>
        </div>
      )}

      {manageOpen && (
        <div className="gl-backdrop" onClick={() => setManageOpen(false)}>
          <div className="gl-sheet" onClick={e => e.stopPropagation()}>
            <div className="gl-drag"/>
            <div className="gl-sheet-title">Guest list</div>
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
                      {g.is_checked_in && <span className="gm-in">Checked in</span>}
                      <button className={`gm-remove ${confirmRemove === g.ticket_id ? 'confirm' : ''}`} disabled={removingId === g.ticket_id} onClick={() => removeGuest(g.ticket_id)}>
                        {removingId === g.ticket_id ? '…' : confirmRemove === g.ticket_id ? 'Confirm' : 'Remove'}
                      </button>
                    </div>
                  ))
              )}
            </div>
            <button className="gl-close-btn" onClick={() => setManageOpen(false)}>Done</button>
          </div>
        </div>
      )}

      {hostMenuOpen && (
        <div className="gl-backdrop" onClick={() => setHostMenuOpen(false)}>
          <div className="gl-sheet" onClick={e => e.stopPropagation()}>
            <div className="gl-drag"/>
            <div className="gl-sheet-title">Manage event</div>
            <div className="host-menu">
              <button onClick={() => router.push(`/scan/${event.id}`)}><b>Scan tickets</b><span>Check people in at the door with your camera</span></button>
              <button onClick={() => { setHostMenuOpen(false); openGuestManager() }}><b>Guest list</b><span>See who&apos;s on it and remove people</span></button>
              <button onClick={() => { setHostMenuOpen(false); setGuestLink(null); setGlCount(1); setLinkSheetOpen(true) }}><b>Guest list link</b><span>Invite someone for free</span></button>
              <button onClick={() => { setHostMenuOpen(false); openPromos() }}><b>Promo codes</b><span>Create discounts for this event</span></button>
              <button onClick={() => router.push(`/host/edit/${event.id}`)}><b>Edit event</b><span>Details, tickets and flyer</span></button>
            </div>
            <button className="gl-close-btn" onClick={() => setHostMenuOpen(false)}>Done</button>
          </div>
        </div>
      )}

      {promosOpen && (
        <div className="gl-backdrop" onClick={() => setPromosOpen(false)}>
          <div className="gl-sheet" onClick={e => e.stopPropagation()}>
            <div className="gl-drag"/>
            <div className="gl-sheet-title">Promo codes</div>
            <p className="gl-sheet-desc">Buyers enter a code before checkout. Each order counts as one use.</p>
            <form className="promo-create" onSubmit={createPromo} noValidate>
              <input className="gm-search promo-in" placeholder="Code, e.g. DEDRO20" autoCapitalize="characters" autoComplete="off" value={pForm.code} onChange={e => setPForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/\s/g, '') }))}/>
              <div className="seg">
                <button type="button" className={pForm.kind === 'percent' ? 'on' : ''} onClick={() => setPForm(f => ({ ...f, kind: 'percent' }))}>% off</button>
                <button type="button" className={pForm.kind === 'amount' ? 'on' : ''} onClick={() => setPForm(f => ({ ...f, kind: 'amount' }))}>$ off each ticket</button>
              </div>
              <input className="gm-search promo-in" inputMode="decimal" placeholder={pForm.kind === 'percent' ? 'Discount, e.g. 20 for 20% off' : 'Dollars off each ticket, e.g. 5'} value={pForm.value} onChange={e => setPForm(f => ({ ...f, value: e.target.value.replace(/[^\d.]/g, '') }))}/>
              <div className="two">
                <input className="gm-search promo-in" inputMode="numeric" placeholder="Use limit (optional)" value={pForm.max_uses} onChange={e => setPForm(f => ({ ...f, max_uses: e.target.value.replace(/\D/g, '') }))}/>
                <input className="gm-search promo-in" type="date" aria-label="Expires (optional)" value={pForm.expires} onChange={e => setPForm(f => ({ ...f, expires: e.target.value }))}/>
              </div>
              {pError && <p className="guest-err">{pError}</p>}
              <button type="submit" className="gl-copy-btn" style={{width:'100%'}} disabled={pSaving || !pForm.code || !pForm.value}>{pSaving ? 'Creating…' : 'Create code'}</button>
            </form>
            <div className="gm-list" style={{marginTop:'16px'}}>
              {loadingPromos ? (
                <div className="gm-empty">Loading codes…</div>
              ) : promos.length === 0 ? (
                <div className="gm-empty">No codes yet.</div>
              ) : promos.map(p => (
                <div key={p.id} className="gm-row">
                  <div className="gm-info">
                    <div className="gm-name">{p.code}{!p.active && <span className="promo-paused"> · Paused</span>}</div>
                    <div className="gm-email">
                      {p.kind === 'percent' ? `${Number(p.value)}% off` : `$${Number(p.value)} off each ticket`}
                      {' · '}{p.uses}{p.max_uses ? ` of ${p.max_uses}` : ''} used
                      {p.expires_at ? ` · ends ${new Date(p.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                    </div>
                  </div>
                  <button className="gm-remove" onClick={() => togglePromo(p)}>{p.active ? 'Pause' : 'Resume'}</button>
                  <button className={`gm-remove ${confirmDeletePromo === p.id ? 'confirm' : ''}`} onClick={() => deletePromo(p)}>{confirmDeletePromo === p.id ? 'Confirm' : 'Delete'}</button>
                </div>
              ))}
            </div>
            <button className="gl-close-btn" onClick={() => setPromosOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </>
  )
}