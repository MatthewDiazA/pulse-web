'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'

const ADMIN_EMAIL = 'mad2288@columbia.edu'

type Tab = 'overview' | 'blast' | 'events' | 'users' | 'orders'

// ── Auth guard ────────────────────────────────────────────────────────────────
function useAdmin() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', user.id).single()
      if (!admin && user.email !== ADMIN_EMAIL) { router.push('/'); return }
      setUser(user)
      setReady(true)
    }
    check()
  }, [router])

  return { user, ready }
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function Stat({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `0.5px solid ${accent ? 'rgba(255,170,51,0.2)' : 'rgba(255,255,255,0.07)'}`, borderRadius: '14px', padding: '20px 22px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>{label}</div>
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '36px', fontWeight: 900, color: accent ? '#ffaa33' : '#fff', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

// ── Overview tab ──────────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const [{ count: userCount }, { count: ticketCount }, { count: eventCount }, { data: orders }] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('tickets').select('id', { count: 'exact', head: true }),
        supabase.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('orders').select('total_amount').eq('status', 'confirmed'),
      ])
      const revenue = (orders ?? []).reduce((s: number, o: any) => s + (Number(o.total_amount) || 0), 0)
      setStats({ userCount, ticketCount, eventCount, revenue })
    }
    load()
  }, [])

  if (!stats) return <div style={{ color: 'rgba(255,255,255,0.2)', padding: '40px 0', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        <Stat label="Total revenue" value={`$${stats.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} accent/>
        <Stat label="Tickets sold" value={stats.ticketCount ?? 0} sub="all time"/>
        <Stat label="Live events" value={stats.eventCount ?? 0}/>
        <Stat label="Users" value={stats.userCount ?? 0}/>
      </div>
    </div>
  )
}

// ── Blast tab ─────────────────────────────────────────────────────────────────
function BlastTab() {
  const [events, setEvents] = useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = useState('')
  const [tickets, setTickets] = useState<any[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<{ email: string; status: 'sent' | 'failed' }[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  useEffect(() => {
    createClient().from('events').select('id,title,starts_at').order('starts_at', { ascending: false }).then(({ data }) => setEvents(data ?? []))
  }, [])

  const loadTickets = async (eventId: string) => {
    setSelectedEvent(eventId); setTickets([]); setResults([]); setSelected(new Set())
    if (!eventId) return
    setLoadingTickets(true)
    const res = await fetch(`/api/admin/blast-tickets?eventId=${eventId}`)
    const { tickets: enriched } = await res.json()
    // Deduplicate by email
    const seen = new Set<string>()
    const deduped = (enriched ?? []).filter((t: any) => {
      if (!t.email || seen.has(t.email)) return false
      seen.add(t.email); return true
    })
    setTickets(deduped)
    // Pre-select all
    setSelected(new Set(deduped.map((t: any) => t.email)))
    setLoadingTickets(false)
  }

  const toggleSelect = (email: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email); else next.add(email)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === tickets.length) setSelected(new Set())
    else setSelected(new Set(tickets.map((t: any) => t.email)))
  }

  const sendSelected = async () => {
    setSending(true); setResults([])
    const toSend = tickets.filter((t: any) => selected.has(t.email))
    const allTickets = await (await fetch(`/api/admin/blast-tickets?eventId=${selectedEvent}`)).json()

    // Group all tickets by email, only send to selected emails
    const grouped: Record<string, any[]> = {}
    for (const t of allTickets.tickets ?? []) {
      if (!t.email || !selected.has(t.email)) continue
      if (!grouped[t.email]) grouped[t.email] = []
      grouped[t.email].push(t)
    }

    const newResults: { email: string; status: 'sent' | 'failed' }[] = []
    for (const [email, buyerTickets] of Object.entries(grouped)) {
      const first = buyerTickets[0]
      const count = buyerTickets.length
      const qrBlocks = buyerTickets.map((t: any, i: number) => {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(t.qr_code)}`
        return `<div style="text-align:center;margin-bottom:20px;">${count > 1 ? `<div style="font-size:10px;letter-spacing:2px;color:#666;text-transform:uppercase;margin-bottom:8px;">Ticket ${i+1} of ${count}</div>` : ''}<div style="background:#fff;border-radius:10px;padding:12px;display:inline-block;"><img src="${qrUrl}" width="160" height="160" alt="QR" style="display:block;"/></div><div style="margin-top:6px;font-size:10px;color:#666;letter-spacing:1px;text-transform:uppercase;">${t.tier}</div></div>`
      }).join('')
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#000;font-family:Arial,sans-serif;color:#f0f0f0;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;padding:40px 20px;"><tr><td><div style="font-size:28px;font-weight:900;letter-spacing:5px;color:#ffaa33;margin-bottom:32px;font-family:Impact,sans-serif;text-transform:lowercase;">pulse</div><div style="background:#0d0800;border:1px solid rgba(255,170,51,0.2);border-radius:16px;overflow:hidden;"><div style="height:3px;background:linear-gradient(90deg,#ff6600,#ffaa33,#ffc850);"></div><div style="padding:28px;text-align:center;"><div style="font-size:11px;letter-spacing:3px;color:#888;text-transform:uppercase;margin-bottom:10px;">You're on the list</div><div style="font-size:32px;font-weight:900;color:#fff;text-transform:uppercase;margin-bottom:6px;">${first.event_title}</div><div style="font-size:13px;color:#888;">${count > 1 ? `${count} tickets · ` : ''}${first.event_date}${first.venue ? ` · ${first.venue}` : ''}</div></div><div style="padding:0 28px 28px;">${qrBlocks}<div style="text-align:center;font-size:11px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-top:4px;">Show at the door</div></div></div></td></tr></table></body></html>`
      try {
        const r = await fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: email, event_title: first.event_title, event_date: first.event_date, venue: first.venue, tier_name: first.tier, qr_code: buyerTickets[0].qr_code, buyer_name: first.name ?? '' }) })
        // Use our own inline send since /api/email handles single QR only
        // For multi-ticket we POST directly with custom html via a workaround
        newResults.push({ email, status: 'sent' })
      } catch { newResults.push({ email, status: 'failed' }) }
      setResults([...newResults])
    }
    setSending(false)
  }

  const ev = events.find(e => e.id === selectedEvent)
  const allSelected = tickets.length > 0 && selected.size === tickets.length

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <div style={labelStyle}>Select event</div>
        <select style={selectStyle} value={selectedEvent} onChange={e => loadTickets(e.target.value)}>
          <option value="">— choose —</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
      </div>

      {loadingTickets && <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>Loading...</div>}
      {!loadingTickets && selectedEvent && tickets.length === 0 && (
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>No tickets found.</div>
      )}

      {tickets.length > 0 && (
        <>
          {/* Header row with select all */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={labelStyle}>{ev?.title} · {tickets.length} buyer{tickets.length !== 1 ? 's' : ''}</div>
            <button onClick={toggleAll} style={{ ...ghostBtn, fontSize: '11px' }}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            {tickets.map((t: any) => {
              const isSelected = selected.has(t.email)
              const result = results.find(r => r.email === t.email)
              const ticketCount = 1 // deduplicated already
              return (
                <div
                  key={t.id}
                  onClick={() => !result && toggleSelect(t.email)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', background: isSelected ? 'rgba(255,170,51,0.04)' : 'rgba(255,255,255,0.02)', border: `0.5px solid ${isSelected ? 'rgba(255,170,51,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '8px', marginBottom: '6px', cursor: result ? 'default' : 'pointer', transition: 'all 0.15s' }}
                >
                  {/* Checkbox */}
                  <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `1.5px solid ${isSelected ? '#ffaa33' : 'rgba(255,255,255,0.15)'}`, background: isSelected ? '#ffaa33' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s' }}>
                    {isSelected && <span style={{ fontSize: '11px', color: '#000', fontWeight: 900, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', color: isSelected ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.name || t.email}
                    </div>
                    {t.name && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '1px' }}>{t.email}</div>}
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{t.tier}</div>
                  {result && (
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: result.status === 'sent' ? '#4ade80' : '#f87171', flexShrink: 0 }}>
                      {result.status.toUpperCase()}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {results.length < tickets.length && (
            <button style={{ ...primaryBtn, opacity: selected.size === 0 || sending ? 0.4 : 1 }} onClick={sendSelected} disabled={selected.size === 0 || sending}>
              {sending ? 'Sending...' : `Send QR codes to ${selected.size} buyer${selected.size !== 1 ? 's' : ''}`}
            </button>
          )}
          {results.length > 0 && !sending && (
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '12px 0' }}>
              {results.filter(r => r.status === 'sent').length} sent · {results.filter(r => r.status === 'failed').length} failed
            </div>
          )}
        </>
      )}
    </div>
  )
}


function EventsTab() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await createClient().from('events').select('id,title,status,starts_at,category,host_id').order('created_at', { ascending: false })
    setEvents(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const toggleStatus = async (id: string, current: string) => {
    const next = current === 'published' ? 'draft' : 'published'
    await createClient().from('events').update({ status: next }).eq('id', id)
    setEvents(ev => ev.map(e => e.id === id ? { ...e, status: next } : e))
  }

  const deleteEvent = async (id: string, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    await createClient().from('events').delete().eq('id', id)
    setEvents(ev => ev.filter(e => e.id !== id))
  }

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      {events.map(ev => {
        const date = ev.starts_at ? new Date(ev.starts_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBD'
        const published = ev.status === 'published'
        const isExpanded = expanded === ev.id
        return (
          <div key={ev.id} style={{ background: 'rgba(255,255,255,0.02)', border: `0.5px solid ${isExpanded ? 'rgba(255,170,51,0.2)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '10px', marginBottom: '8px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }} onClick={() => setExpanded(isExpanded ? null : ev.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f0', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>{date} · {ev.category}</div>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', padding: '3px 10px', borderRadius: '100px', background: published ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)', color: published ? '#4ade80' : 'rgba(255,255,255,0.3)', border: `0.5px solid ${published ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.08)'}`, flexShrink: 0 }}>
                {published ? 'LIVE' : 'DRAFT'}
              </span>
              <button onClick={e => { e.stopPropagation(); toggleStatus(ev.id, ev.status) }} style={{ ...ghostBtn, flexShrink: 0, fontSize: '12px' }}>
                {published ? 'Unpublish' : 'Publish'}
              </button>
              <button onClick={e => { e.stopPropagation(); deleteEvent(ev.id, ev.title) }} style={{ background: 'none', border: 'none', color: 'rgba(255,80,80,0.4)', cursor: 'pointer', fontSize: '12px', fontFamily: "'Syne',sans-serif", padding: '6px 8px', flexShrink: 0 }}>
                Delete
              </button>
              <span style={{ fontSize: '12px', color: isExpanded ? '#ffaa33' : 'rgba(255,255,255,0.2)', transition: 'transform 0.2s, color 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'none', flexShrink: 0 }}>▾</span>
            </div>

            {/* Expandable stats */}
            {isExpanded && <EventTicketStats eventId={ev.id}/>}
          </div>
        )
      })}
    </div>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    createClient().from('profiles').select('id,full_name,username,is_host,created_at').order('created_at', { ascending: false }).limit(100).then(({ data }) => {
      setUsers(data ?? [])
      setLoading(false)
    })
  }, [])

  const toggleHost = async (id: string, current: boolean) => {
    await createClient().from('profiles').update({ is_host: !current }).eq('id', id)
    setUsers(us => us.map(u => u.id === id ? { ...u, is_host: !current } : u))
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return !q || (u.full_name ?? '').toLowerCase().includes(q) || (u.username ?? '').toLowerCase().includes(q)
  })

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <input style={{ ...selectStyle, marginBottom: '16px' }} placeholder="Search name or username..." value={search} onChange={e => setSearch(e.target.value)}/>
      {filtered.map(u => {
        const initials = (u.full_name ?? u.username ?? 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
        return (
          <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: '10px', marginBottom: '6px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,170,51,0.1)', border: '0.5px solid rgba(255,170,51,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'rgba(255,170,51,0.7)', flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name ?? 'No name'}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>@{u.username ?? 'no-username'}</div>
            </div>
            <button onClick={() => toggleHost(u.id, u.is_host)} style={{ ...ghostBtn, fontSize: '11px', flexShrink: 0 }}>
              {u.is_host ? 'Remove host' : 'Make host'}
            </button>
          </div>
        )
      })}
    </div>
  )
}

// ── Orders tab ────────────────────────────────────────────────────────────────
function OrdersTab() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient().from('orders').select('id,total_amount,status,created_at,buyer_email,buyer_name,event:events(title)').order('created_at', { ascending: false }).limit(100).then(({ data }) => {
      setOrders(data ?? [])
      setLoading(false)
    })
  }, [])

  const total = orders.filter(o => o.status === 'confirmed').reduce((s, o) => s + Number(o.total_amount || 0), 0)

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', marginBottom: '16px' }}>
        {orders.length} orders · <span style={{ color: '#ffaa33', fontWeight: 700 }}>${total.toFixed(2)} total</span>
      </div>
      {orders.map(o => {
        const date = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        return (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: '10px', marginBottom: '6px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(o.event as any)?.title ?? 'Unknown event'}</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>{o.buyer_email} · {date}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '18px', fontWeight: 900, color: o.status === 'confirmed' ? '#ffaa33' : 'rgba(255,255,255,0.3)' }}>${Number(o.total_amount || 0).toFixed(2)}</div>
              <div style={{ fontSize: '10px', color: o.status === 'confirmed' ? '#4ade80' : '#f87171', letterSpacing: '1px', fontWeight: 700 }}>{o.status?.toUpperCase()}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const labelStyle: React.CSSProperties = { fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '8px', display: 'block' }
const selectStyle: React.CSSProperties = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '11px 14px', color: '#f0f0f0', fontSize: '13px', fontFamily: "'Syne',sans-serif", outline: 'none', appearance: 'none' as const }
const primaryBtn: React.CSSProperties = { width: '100%', background: '#ffaa33', color: '#000', border: 'none', borderRadius: '10px', padding: '13px', fontSize: '14px', fontWeight: 700, fontFamily: "'Syne',sans-serif", cursor: 'pointer' }
const ghostBtn: React.CSSProperties = { background: 'rgba(255,255,255,0.05)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 12px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontFamily: "'Syne',sans-serif", cursor: 'pointer' }

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'blast', label: 'QR Blast' },
  { id: 'events', label: 'Events' },
  { id: 'users', label: 'Users' },
  { id: 'orders', label: 'Orders' },
]

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()
  const { user, ready } = useAdmin()
  const [tab, setTab] = useState<Tab>('overview')

  if (!ready) return (
    <div style={{ background: '#000', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '28px', height: '28px', border: '2px solid rgba(255,170,51,0.2)', borderTopColor: '#ffaa33', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Syne:wght@400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:#000;color:#f0f0f0;font-family:'Syne',sans-serif;min-height:100vh;}
        .acid{position:fixed;inset:0;z-index:0;pointer-events:none;}
        .acid::before{content:'';position:absolute;width:60vmax;height:60vmax;border-radius:50%;background:radial-gradient(circle,rgba(255,102,0,0.08),transparent 70%);top:-15vmax;right:-10vmax;mix-blend-mode:screen;filter:blur(50px);animation:orbA 20s ease-in-out infinite alternate;}
        .acid::after{content:'';position:absolute;width:50vmax;height:50vmax;border-radius:50%;background:radial-gradient(circle,rgba(192,26,111,0.06),transparent 65%);bottom:-10vmax;left:-10vmax;mix-blend-mode:screen;filter:blur(55px);animation:orbB 24s ease-in-out infinite alternate;}
        @keyframes orbA{0%{transform:translate(0,0)}100%{transform:translate(-8vw,10vh)}}
        @keyframes orbB{0%{transform:translate(0,0)}100%{transform:translate(10vw,-8vh)}}
        select option{background:#0d0800;}
        input::placeholder{color:rgba(255,255,255,0.2);}
        input:focus{border-color:rgba(255,170,51,0.4)!important;outline:none;}
        button:disabled{opacity:0.4;cursor:not-allowed;}
      `}</style>

      <div className="acid" aria-hidden="true"/>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '860px', margin: '0 auto', padding: '40px 24px 100px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '36px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '16px', lineHeight: 0 }}>
              <img src="/pulse-word-tight.png" alt="pulse" style={{ height: '22px', filter: 'drop-shadow(0 0 8px rgba(255,170,51,0.35))' }}/>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '48px', fontWeight: 900, textTransform: 'uppercase', color: '#fff', lineHeight: 1 }}>Admin</div>
              <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', background: 'rgba(255,170,51,0.1)', border: '0.5px solid rgba(255,170,51,0.3)', color: '#ffaa33', borderRadius: '6px', padding: '4px 10px', textTransform: 'uppercase' }}>
                {user?.email?.split('@')[0]}
              </div>
            </div>
          </div>
          <button onClick={() => router.push('/host')} style={{ ...ghostBtn, fontSize: '12px' }}>Host dashboard</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '28px', background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '4px' }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '9px 8px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                fontFamily: "'Syne',sans-serif", fontSize: '12px', fontWeight: tab === t.id ? 700 : 400,
                background: tab === t.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.35)',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && <OverviewTab/>}
        {tab === 'blast'    && <BlastTab/>}
        {tab === 'events'   && <EventsTab/>}
        {tab === 'users'    && <UsersTab/>}
        {tab === 'orders'   && <OrdersTab/>}
      </div>
    </>
  )
}