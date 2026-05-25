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
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState<{ email: string; status: 'sent' | 'failed' }[]>([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  useEffect(() => {
    createClient().from('events').select('id,title,starts_at').order('starts_at', { ascending: false }).then(({ data }) => setEvents(data ?? []))
  }, [])

  const loadTickets = async (eventId: string) => {
    setSelectedEvent(eventId); setTickets([]); setResults([])
    if (!eventId) return
    setLoadingTickets(true)
    const { data } = await createClient().from('tickets').select('id,qr_code,event:events(title,starts_at,venue_name),tier:ticket_tiers(name),order:orders(buyer_email,buyer_name)').eq('event_id', eventId)
    setTickets(data ?? [])
    setLoadingTickets(false)
  }

  const sendAll = async () => {
    setSending(true); setResults([])
    const newResults: { email: string; status: 'sent' | 'failed' }[] = []
    for (const t of tickets) {
      const email = (t.order as any)?.buyer_email
      const name = (t.order as any)?.buyer_name ?? ''
      if (!email) { newResults.push({ email: 'unknown', status: 'failed' }); continue }
      const ev = t.event as any
      const date = ev?.starts_at ? new Date(ev.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'TBD'
      try {
        const res = await fetch('/api/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: email, event_title: ev?.title ?? 'Event', event_date: date, venue: ev?.venue_name ?? '', tier_name: (t.tier as any)?.name ?? 'Ticket', qr_code: t.qr_code, buyer_name: name }) })
        const d = await res.json()
        newResults.push({ email, status: d.success ? 'sent' : 'failed' })
      } catch { newResults.push({ email, status: 'failed' }) }
      setResults([...newResults])
    }
    setSending(false)
  }

  const ev = events.find(e => e.id === selectedEvent)

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
          <div style={{ ...labelStyle, marginBottom: '12px' }}>{tickets.length} buyer{tickets.length !== 1 ? 's' : ''} — {ev?.title}</div>
          <div style={{ marginBottom: '16px' }}>
            {tickets.map(t => {
              const email = (t.order as any)?.buyer_email ?? 'No email'
              const name = (t.order as any)?.buyer_name ?? ''
              const result = results.find(r => r.email === email)
              return (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: '8px', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>{email}</div>
                    {name && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>{name}</div>}
                  </div>
                  {result && <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '1px', color: result.status === 'sent' ? '#4ade80' : '#f87171' }}>{result.status.toUpperCase()}</span>}
                </div>
              )
            })}
          </div>
          {results.length === 0 && (
            <button style={primaryBtn} onClick={sendAll} disabled={sending}>
              {sending ? 'Sending...' : `Send QR codes to ${tickets.length} buyer${tickets.length !== 1 ? 's' : ''}`}
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

// ── Events tab ────────────────────────────────────────────────────────────────
function EventTicketStats({ eventId }: { eventId: string }) {
  const [tiers, setTiers] = useState<any[]>([])
  const [checkedIn, setCheckedIn] = useState(0)
  const [totalTickets, setTotalTickets] = useState(0)
  const [buyers, setBuyers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const [{ data: tierData }, { count: ciCount }, { count: total }, { data: ticketData }] = await Promise.all([
        supabase.from('ticket_tiers').select('id,name,price,quantity,quantity_sold').eq('event_id', eventId),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId).eq('is_checked_in', true),
        supabase.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
        supabase.from('tickets').select('id,is_checked_in,tier:ticket_tiers(name),order:orders(buyer_email,buyer_name)').eq('event_id', eventId),
      ])
      setTiers(tierData ?? [])
      setCheckedIn(ciCount ?? 0)
      setTotalTickets(total ?? 0)
      setBuyers(ticketData ?? [])
      setLoading(false)
    }
    load()
  }, [eventId])

  if (loading) return (
    <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>
      Loading stats...
    </div>
  )

  const revenue = tiers.reduce((s, t) => s + (Number(t.price) * (t.quantity_sold || 0)), 0)

  return (
    <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', padding: '16px 20px', background: 'rgba(0,0,0,0.3)' }}>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Revenue', value: `$${revenue.toFixed(2)}`, color: '#ffaa33' },
          { label: 'Sold', value: totalTickets ?? 0 },
          { label: 'Checked in', value: checkedIn },
          { label: 'At door', value: `${totalTickets > 0 ? Math.round((checkedIn / totalTickets) * 100) : 0}%` },
        ].map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px 14px', border: '0.5px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '24px', fontWeight: 900, color: (s as any).color ?? '#fff', lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Per-tier breakdown */}
      {tiers.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: '8px' }}>Tiers</div>
          {tiers.map(t => {
            const sold = t.quantity_sold || 0
            const pct = t.quantity > 0 ? (sold / t.quantity) * 100 : 0
            return (
              <div key={t.id} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{t.name}</span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{sold} / {t.quantity} · <span style={{ color: '#ffaa33' }}>${Number(t.price).toFixed(2)}</span></span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#f87171' : pct >= 60 ? '#ffaa33' : '#4ade80', borderRadius: '2px', transition: 'width 0.5s ease' }}/>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Buyer list */}
      {buyers.length > 0 && (
        <div>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: '8px' }}>Buyers</div>
          {buyers.map((b, i) => {
            const email = (b.order as any)?.buyer_email ?? '—'
            const name = (b.order as any)?.buyer_name ?? ''
            const tier = (b.tier as any)?.name ?? '—'
            const initials = name ? name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) : email.slice(0, 2).toUpperCase()
            return (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '4px', border: '0.5px solid rgba(255,255,255,0.04)' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,170,51,0.08)', border: '0.5px solid rgba(255,170,51,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'rgba(255,170,51,0.6)', flexShrink: 0 }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || email}</div>
                  {name && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '1px' }}>{email}</div>}
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{tier}</div>
                <div title={b.is_checked_in ? 'Checked in' : 'Not checked in'} style={{ width: '8px', height: '8px', borderRadius: '50%', background: b.is_checked_in ? '#4ade80' : 'rgba(255,255,255,0.1)', flexShrink: 0 }}/>
              </div>
            )
          })}
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.15)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }}/> checked in
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', marginLeft: '8px' }}/> not yet
          </div>
        </div>
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