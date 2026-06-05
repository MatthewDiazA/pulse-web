'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase/client'

const ADMIN_EMAIL = 'mad2288@columbia.edu'

type Tab = 'overview' | 'blast' | 'events' | 'users' | 'orders' | 'views' | 'conversion'

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
    const newResults: { email: string; status: 'sent' | 'failed' }[] = []

    const { tickets: allTickets } = await (await fetch(`/api/admin/blast-tickets?eventId=${selectedEvent}`)).json()

    // Group by email, only process selected
    const grouped: Record<string, any[]> = {}
    for (const t of allTickets ?? []) {
      if (!t.email || !selected.has(t.email)) continue
      if (!grouped[t.email]) grouped[t.email] = []
      grouped[t.email].push(t)
    }

    for (const [email, buyerTickets] of Object.entries(grouped)) {
      const first = buyerTickets[0]
      try {
        const r = await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: email,
            event_title: first.event_title,
            event_date: first.event_date,
            venue: first.venue,
            buyer_name: first.name ?? '',
            tickets: buyerTickets.map((t: any) => ({ qr_code: t.qr_code, tier_name: t.tier })),
          }),
        })
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


function EventTicketStats({ eventId }: { eventId: string }) {
  const [tiers, setTiers] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: tierData } = await supabase
        .from('ticket_tiers')
        .select('id,name,price,quantity,quantity_sold')
        .eq('event_id', eventId)

      // Use the blast-tickets route which has auth.users fallback
      const res = await fetch(`/api/admin/blast-tickets?eventId=${eventId}`)
      const { tickets: enriched } = await res.json()

      // Also get check-in status
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('id,is_checked_in,order_id,tier:ticket_tiers(name,price)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })

      // Merge enriched email/name data with ticket check-in/order data
      const merged = (ticketData ?? []).map(t => {
        const e = (enriched ?? []).find((x: any) => x.id === t.id)
        return {
          ...t,
          email: e?.email ?? null,
          name: e?.name ?? null,
        }
      })

      setTiers(tierData ?? [])
      setTickets(merged)
      setLoading(false)
    }
    load()
  }, [eventId])

  if (loading) return (
    <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)', fontSize: '12px' }}>Loading stats...</div>
  )

  const paid = tickets.filter(t => !!(t as any).order_id)
  const comped = tickets.filter(t => !(t as any).order_id)
  const checkedIn = tickets.filter(t => t.is_checked_in)
  const revenue = paid.reduce((s, t) => s + Number((t.order as any)?.total_amount || 0), 0)
  const totalCapacity = tiers.reduce((s, t) => s + (t.quantity || 0), 0)
  const soldPct = totalCapacity > 0 ? Math.round((tickets.length / totalCapacity) * 100) : 0

  return (
    <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.4)' }}>
      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '1px', background: 'rgba(255,255,255,0.04)' }}>
        {[
          { label: 'Revenue', value: `$${revenue.toFixed(2)}`, sub: `${paid.length} paid`, color: '#ffaa33' },
          { label: 'Comped / GL', value: comped.length, sub: '$0 · no order', color: comped.length > 0 ? '#a78bfa' : 'rgba(255,255,255,0.3)' },
          { label: 'Total tickets', value: tickets.length, sub: `${soldPct}% of capacity` },
          { label: 'Checked in', value: checkedIn.length, sub: `${tickets.length > 0 ? Math.round((checkedIn.length / tickets.length) * 100) : 0}% at door`, color: checkedIn.length > 0 ? '#4ade80' : undefined },
          { label: 'Still outside', value: tickets.length - checkedIn.length, sub: 'not scanned yet' },
        ].map(s => (
          <div key={s.label} style={{ padding: '14px 16px', background: '#000' }}>
            <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '28px', fontWeight: 900, color: (s as any).color ?? '#fff', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)', marginTop: '3px' }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tier breakdown */}
      <div style={{ padding: '16px 20px', borderTop: '0.5px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: '10px' }}>Capacity by tier</div>
        {tiers.map(t => {
          const sold = t.quantity_sold || 0
          const pct = t.quantity > 0 ? (sold / t.quantity) * 100 : 0
          const tierRevenue = Number(t.price) * sold
          return (
            <div key={t.id} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: '#f0f0f0', fontWeight: 600 }}>{t.name}</span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>${Number(t.price).toFixed(2)} each</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>{sold}/{t.quantity} sold</span>
                  {tierRevenue > 0 && <span style={{ fontSize: '11px', color: '#ffaa33', fontWeight: 700 }}>${tierRevenue.toFixed(2)}</span>}
                  {Number(t.price) === 0 && <span style={{ fontSize: '10px', color: '#a78bfa' }}>comped</span>}
                </div>
              </div>
              <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 90 ? '#f87171' : pct >= 60 ? '#ffaa33' : '#4ade80', borderRadius: '2px' }}/>
              </div>
            </div>
          )
        })}
      </div>

      {/* Buyer roster */}
      <div style={{ padding: '0 20px 20px', borderTop: '0.5px solid rgba(255,255,255,0.04)' }}>
        <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', margin: '16px 0 10px' }}>Roster</div>
        {tickets.map(t => {
          const order = t.order as any
          const isPaid = !!(t as any).order_id
          const email = (t as any).email ?? order?.buyer_email ?? '—'
          const name = (t as any).name ?? order?.buyer_name ?? ''
          const tierName = (t.tier as any)?.name ?? '—'
          const tierPrice = Number((t.tier as any)?.price || 0)
          const initials = name ? name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2) : email !== '—' ? email.slice(0, 2).toUpperCase() : '?'
          return (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: t.is_checked_in ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)', borderRadius: '8px', marginBottom: '4px', border: `0.5px solid ${t.is_checked_in ? 'rgba(74,222,128,0.15)' : isPaid ? 'rgba(255,255,255,0.05)' : 'rgba(167,139,250,0.15)'}` }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: isPaid ? 'rgba(255,170,51,0.08)' : 'rgba(167,139,250,0.1)', border: `0.5px solid ${isPaid ? 'rgba(255,170,51,0.2)' : 'rgba(167,139,250,0.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: isPaid ? 'rgba(255,170,51,0.7)' : 'rgba(167,139,250,0.7)', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: '#f0f0f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || email}</div>
                {name && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{tierName}</span>
                {isPaid ? (
                  <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: '#ffaa33', background: 'rgba(255,170,51,0.08)', border: '0.5px solid rgba(255,170,51,0.15)', borderRadius: '4px', padding: '2px 6px' }}>
                    ${tierPrice > 0 ? tierPrice.toFixed(2) : '0.00'}
                  </span>
                ) : (
                  <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: '#a78bfa', background: 'rgba(167,139,250,0.08)', border: '0.5px solid rgba(167,139,250,0.2)', borderRadius: '4px', padding: '2px 6px' }}>GL</span>
                )}
                <div title={t.is_checked_in ? 'Checked in' : 'Not scanned'} style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.is_checked_in ? '#4ade80' : 'rgba(255,255,255,0.1)' }}/>
              </div>
            </div>
          )
        })}
        <div style={{ display: 'flex', gap: '16px', marginTop: '12px', flexWrap: 'wrap' }}>
          {[
            { dot: '#ffaa33', label: 'Paid ticket' },
            { dot: '#a78bfa', label: 'Guestlist / comped' },
            { dot: '#4ade80', label: 'Checked in at door' },
            { dot: 'rgba(255,255,255,0.15)', label: 'Not scanned yet' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: l.dot, flexShrink: 0 }}/>{l.label}
            </div>
          ))}
        </div>
      </div>
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
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set())

  // guest-link send state (per user)
  const [openUser, setOpenUser] = useState<string | null>(null)
  const [pickEvent, setPickEvent] = useState<Record<string, string>>({})
  const [sendingTo, setSendingTo] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; msg: string }>>({})

  useEffect(() => {
    createClient().from('profiles').select('id,full_name,username,is_host,created_at,email').order('created_at', { ascending: false }).limit(100).then(({ data }) => {
      setUsers(data ?? [])
      setLoading(false)
    })
    createClient().from('events').select('id,title,starts_at').order('starts_at', { ascending: false }).then(({ data }) => {
      setEvents(data ?? [])
    })
    createClient().from('admins').select('user_id').then(({ data }) => {
      setAdminIds(new Set((data ?? []).map((a: any) => a.user_id)))
    })
  }, [])

  const toggleHost = async (id: string, current: boolean) => {
    await createClient().from('profiles').update({ is_host: !current }).eq('id', id)
    setUsers(us => us.map(u => u.id === id ? { ...u, is_host: !current } : u))
  }

  const toggleAdmin = async (id: string) => {
    const supabase = createClient()
    if (adminIds.has(id)) {
      await supabase.from('admins').delete().eq('user_id', id)
      setAdminIds(prev => { const n = new Set(prev); n.delete(id); return n })
    } else {
      await supabase.from('admins').insert({ user_id: id })
      setAdminIds(prev => new Set([...prev, id]))
    }
  }

  // Get-or-create the broadcast guest link for an event (reuses the existing token)
  const getEventGuestLink = async (eventId: string): Promise<string | null> => {
    const supabase = createClient()
    const { data: existing } = await supabase.from('guest_invites').select('token').eq('event_id', eventId).limit(1)
    let token = existing?.[0]?.token as string | undefined
    if (!token) {
      const { data: { user: me } } = await supabase.auth.getUser()
      token = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
      const { error } = await supabase.from('guest_invites').insert({ event_id: eventId, token, created_by: me?.id })
      if (error) return null
    }
    return `${window.location.origin}/gl/${token}`
  }

  const sendGuestLink = async (u: any) => {
    const eventId = pickEvent[u.id] || events[0]?.id
    if (!eventId) { setFeedback(f => ({ ...f, [u.id]: { ok: false, msg: 'No events available' } })); return }
    if (!u.email) { setFeedback(f => ({ ...f, [u.id]: { ok: false, msg: 'No email on file for this user' } })); return }

    setSendingTo(u.id)
    setFeedback(f => { const n = { ...f }; delete n[u.id]; return n })
    try {
      const link = await getEventGuestLink(eventId)
      if (!link) {
        setFeedback(f => ({ ...f, [u.id]: { ok: false, msg: 'Could not create a link for that event' } }))
        setSendingTo(null); return
      }
      const ev = events.find(e => e.id === eventId)
      const title = ev?.title ?? 'the event'
      const firstName = (u.full_name ?? '').split(' ')[0] || 'there'
      const html = `<!DOCTYPE html><html><body style="margin:0;background:#000;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#ffaa33;font-weight:700;margin-bottom:24px;">PULSE &middot; Guest List</div>
    <div style="font-size:27px;font-weight:900;color:#ffffff;text-transform:uppercase;line-height:1.06;margin-bottom:14px;">You're on the list for ${title}</div>
    <div style="font-size:14px;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:28px;">Hey ${firstName}, tap below to claim your guest list spot. You'll get a ticket with a QR code for entry &mdash; no charge.</div>
    <a href="${link}" style="display:inline-block;background:#ffaa33;color:#000000;text-decoration:none;font-size:15px;font-weight:700;padding:14px 30px;border-radius:100px;">Claim your spot</a>
    <div style="font-size:12px;color:rgba(255,255,255,0.3);margin-top:28px;line-height:1.5;">Or open this link:<br/><span style="color:rgba(255,170,51,0.75);word-break:break-all;">${link}</span></div>
    <div style="margin-top:40px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.08);font-size:11px;color:rgba(255,255,255,0.2);letter-spacing:1px;">pulsetickets.vip</div>
  </div></body></html>`

      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: u.email,
          event_title: title,
          subject: `You're on the guest list for ${title}`,
          custom_html: html,
        }),
      })
      if (res.ok) {
        setFeedback(f => ({ ...f, [u.id]: { ok: true, msg: `Sent to ${u.email}` } }))
        setOpenUser(null)
      } else {
        setFeedback(f => ({ ...f, [u.id]: { ok: false, msg: 'Email failed to send' } }))
      }
    } catch {
      setFeedback(f => ({ ...f, [u.id]: { ok: false, msg: 'Something went wrong' } }))
    }
    setSendingTo(null)
  }

  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    return !q || (u.full_name ?? '').toLowerCase().includes(q) || (u.username ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
  })

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>Loading...</div>

  return (
    <div>
      <input style={{ ...selectStyle, marginBottom: '16px' }} placeholder="Search name, username or email..." value={search} onChange={e => setSearch(e.target.value)}/>
      {filtered.map(u => {
        const initials = (u.full_name ?? u.username ?? 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
        const isOpen = openUser === u.id
        const fb = feedback[u.id]
        return (
          <div key={u.id} style={{ background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: '10px', marginBottom: '6px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,170,51,0.1)', border: '0.5px solid rgba(255,170,51,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'rgba(255,170,51,0.7)', flexShrink: 0 }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name ?? 'No name'}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email ?? `@${u.username ?? 'no-username'}`}</div>
              </div>
              <button onClick={() => { setOpenUser(isOpen ? null : u.id); setFeedback(f => { const n = { ...f }; delete n[u.id]; return n }) }} style={{ ...ghostBtn, fontSize: '11px', flexShrink: 0, color: isOpen ? '#ffaa33' : 'rgba(255,170,51,0.7)', borderColor: 'rgba(255,170,51,0.25)', background: 'rgba(255,170,51,0.06)' }}>
                {isOpen ? 'Cancel' : 'Guest link'}
              </button>
              <button onClick={() => toggleAdmin(u.id)} style={{ ...ghostBtn, fontSize: '11px', flexShrink: 0, ...(adminIds.has(u.id) ? { color: '#ffaa33', borderColor: 'rgba(255,170,51,0.3)' } : {}) }}>
                {adminIds.has(u.id) ? 'Remove admin' : 'Make admin'}
              </button>
              <button onClick={() => toggleHost(u.id, u.is_host)} style={{ ...ghostBtn, fontSize: '11px', flexShrink: 0 }}>
                {u.is_host ? 'Remove host' : 'Make host'}
              </button>
            </div>

            {isOpen && (
              <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.5px' }}>
                  {u.email ? <>Email a guest list link to <span style={{ color: 'rgba(255,255,255,0.6)' }}>{u.email}</span></> : 'This user has no email on file.'}
                </div>
                {u.email && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
                    <select
                      value={pickEvent[u.id] ?? events[0]?.id ?? ''}
                      onChange={e => setPickEvent(p => ({ ...p, [u.id]: e.target.value }))}
                      style={{ ...selectStyle, flex: 1, padding: '9px 12px', fontSize: '12px' }}
                    >
                      {events.map(ev => <option key={ev.id} value={ev.id} style={{ background: '#1a1208' }}>{ev.title}</option>)}
                    </select>
                    <button
                      onClick={() => sendGuestLink(u)}
                      disabled={sendingTo === u.id}
                      style={{ ...primaryBtn, width: 'auto', padding: '9px 18px', fontSize: '13px', opacity: sendingTo === u.id ? 0.5 : 1, whiteSpace: 'nowrap' }}
                    >
                      {sendingTo === u.id ? 'Sending…' : 'Send'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {fb && (
              <div style={{ padding: '0 16px 12px', fontSize: '11px', color: fb.ok ? '#4ade80' : '#f87171' }}>{fb.msg}</div>
            )}
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
    createClient().from('orders').select('id,total_amount,status,created_at,buyer_email,buyer_name,event:events(title)').order('created_at', { ascending: false }).limit(300).then(({ data }) => {
      setOrders(data ?? [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>Loading...</div>

  const confirmed = orders.filter(o => o.status === 'confirmed')
  const revenue = confirmed.reduce((s, o) => s + Number(o.total_amount || 0), 0)
  const aov = confirmed.length ? revenue / confirmed.length : 0

  // revenue by event
  const evMap: Record<string, { revenue: number; count: number }> = {}
  confirmed.forEach(o => {
    const t = (o.event as any)?.title ?? 'Unknown'
    evMap[t] = evMap[t] || { revenue: 0, count: 0 }
    evMap[t].revenue += Number(o.total_amount || 0)
    evMap[t].count++
  })
  const eventRows = Object.entries(evMap).map(([title, v]) => ({ title, ...v })).sort((a, b) => b.revenue - a.revenue)
  const maxEvRev = Math.max(...eventRows.map(e => e.revenue), 1)

  // top buyers
  const bMap: Record<string, { name: string; spend: number; count: number }> = {}
  confirmed.forEach(o => {
    const e = o.buyer_email ?? 'unknown'
    bMap[e] = bMap[e] || { name: o.buyer_name ?? '', spend: 0, count: 0 }
    bMap[e].spend += Number(o.total_amount || 0)
    bMap[e].count++
  })
  const buyerRows = Object.entries(bMap).map(([email, v]) => ({ email, ...v })).sort((a, b) => b.spend - a.spend).slice(0, 8)

  const recent = confirmed.slice(0, 12)
  const secLabel: React.CSSProperties = { fontSize: '9px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', margin: '28px 0 12px' }
  const card: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }
  const big: React.CSSProperties = { fontFamily: "'Barlow Condensed',sans-serif", fontSize: '34px', fontWeight: 900, lineHeight: 1 }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
        <div style={{ ...card, borderColor: 'rgba(255,170,51,0.15)' }}><div style={labelStyle}>Revenue</div><div style={{ ...big, color: '#ffaa33' }}>${revenue.toFixed(0)}</div></div>
        <div style={card}><div style={labelStyle}>Paid orders</div><div style={{ ...big, color: '#fff' }}>{confirmed.length}</div></div>
        <div style={card}><div style={labelStyle}>Avg order</div><div style={{ ...big, color: '#fff' }}>${aov.toFixed(0)}</div></div>
      </div>

      {confirmed.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', marginTop: '28px' }}>No paid orders yet. Sales will appear here as they come in.</div>
      ) : (
        <>
          <div style={secLabel}>Revenue by event</div>
          {eventRows.map(e => (
            <div key={e.title} style={{ padding: '11px 15px', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: '10px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '7px' }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 600, color: '#f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{e.count} orders</div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '18px', fontWeight: 900, color: '#ffaa33', flexShrink: 0 }}>${e.revenue.toFixed(0)}</div>
              </div>
              <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${(e.revenue / maxEvRev) * 100}%`, background: 'rgba(255,170,51,0.6)', borderRadius: '2px' }}/></div>
            </div>
          ))}

          <div style={secLabel}>Top buyers</div>
          {buyerRows.map(b => (
            <div key={b.email} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 15px', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: '10px', marginBottom: '6px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name || b.email}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.email}</div>
              </div>
              {b.count > 1 && <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '1px', color: '#ffaa33', textTransform: 'uppercase', flexShrink: 0 }}>{b.count}× repeat</span>}
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '18px', fontWeight: 900, color: '#fff', flexShrink: 0 }}>${b.spend.toFixed(0)}</div>
            </div>
          ))}

          <div style={secLabel}>Recent sales</div>
          {recent.map(o => {
            const date = new Date(o.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
            return (
              <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 15px', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: '10px', marginBottom: '6px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(o.event as any)?.title ?? 'Unknown event'}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.buyer_email} · {date}</div>
                </div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '17px', fontWeight: 900, color: '#ffaa33', flexShrink: 0 }}>${Number(o.total_amount || 0).toFixed(0)}</div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function ViewsTab() {
  const [data, setData] = useState<any>(null)
  const [period, setPeriod] = useState('30d')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/pageview?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period])

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>Loading...</div>
  if (!data) return <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>No data yet.</div>

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '24px' }}>
        {[
          { id: '24h', label: 'Today' },
          { id: '7d', label: '7 days' },
          { id: '30d', label: '30 days' },
        ].map(p => (
          <button key={p.id} onClick={() => setPeriod(p.id)} style={{
            padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            fontFamily: "'Syne',sans-serif", fontSize: '12px',
            background: period === p.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)',
            color: period === p.id ? '#fff' : 'rgba(255,255,255,0.35)',
            fontWeight: period === p.id ? 700 : 400,
          }}>{p.label}</button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '28px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>Total all time</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '36px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{data.total?.toLocaleString() ?? 0}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,170,51,0.15)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>Last {period === '24h' ? '24h' : period === '7d' ? '7 days' : '30 days'}</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '36px', fontWeight: 900, color: '#ffaa33', lineHeight: 1 }}>{data.recent?.toLocaleString() ?? 0}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>Today</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '36px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{data.today?.toLocaleString() ?? 0}</div>
        </div>
      </div>

      {/* Page breakdown */}
      {data.pages && Object.keys(data.pages).length > 0 && (
        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: '10px' }}>Pages</div>
          {Object.entries(data.pages as Record<string, number>).sort((a, b) => (b[1] as number) - (a[1] as number)).map(([page, count]) => (
            <div key={page} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontFamily: "'Syne',sans-serif" }}>{page}</span>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '18px', fontWeight: 900, color: '#fff' }}>{(count as number).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Event breakdown */}
      {data.events && data.events.length > 0 && (
        <div>
          <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: '10px' }}>Event pages</div>
          {data.events.map((ev: any) => (
            <div key={ev.title} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{ev.title}</span>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '18px', fontWeight: 900, color: '#ffaa33' }}>{ev.count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Conversion tab ────────────────────────────────────────────────────────────
function ConversionTab() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    ;(async () => {
      const { data: events } = await createClient()
        .from('events')
        .select('id,title,status,ticket_tiers(quantity_sold,price)')
        .order('starts_at', { ascending: false })
      const evs = events ?? []
      const withViews = await Promise.all(evs.map(async (e: any) => {
        let views = 0
        try {
          const d = await (await fetch(`/api/pageview?event_id=${e.id}&period=30d`)).json()
          views = d.total ?? 0
        } catch {}
        const sold = (e.ticket_tiers ?? []).reduce((s: number, t: any) => s + (t.quantity_sold || 0), 0)
        const revenue = (e.ticket_tiers ?? []).reduce((s: number, t: any) => s + ((t.quantity_sold || 0) * Number(t.price || 0)), 0)
        return { id: e.id, title: e.title, status: e.status, views, sold, revenue }
      }))
      if (alive) { setRows(withViews); setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '13px' }}>Loading...</div>

  const totalViews = rows.reduce((s, r) => s + r.views, 0)
  const totalSold = rows.reduce((s, r) => s + r.sold, 0)
  const overall = totalViews > 0 ? (totalSold / totalViews) * 100 : 0
  const sorted = [...rows].sort((a, b) => b.views - a.views)

  const rate = (sold: number, views: number) => (views > 0 ? (sold / views) * 100 : 0)
  const rateColor = (r: number) => (r >= 10 ? '#4ade80' : r >= 3 ? '#ffaa33' : 'rgba(255,255,255,0.4)')

  return (
    <div>
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', marginBottom: '16px', lineHeight: 1.5 }}>
        Page views to tickets sold, all-time per event.
      </div>

      {/* Aggregate */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px', marginBottom: '28px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
          <div style={labelStyle}>Total views</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '34px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{totalViews.toLocaleString()}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: '14px', padding: '20px' }}>
          <div style={labelStyle}>Tickets sold</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '34px', fontWeight: 900, color: '#fff', lineHeight: 1 }}>{totalSold.toLocaleString()}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,170,51,0.15)', borderRadius: '14px', padding: '20px' }}>
          <div style={labelStyle}>Conversion</div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '34px', fontWeight: 900, color: '#ffaa33', lineHeight: 1 }}>{overall.toFixed(1)}%</div>
        </div>
      </div>

      {/* Per-event */}
      <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: '10px' }}>By event</div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)' }}>No events yet.</div>
      ) : sorted.map(r => {
        const cr = rate(r.sold, r.views)
        return (
          <div key={r.id} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.06)', borderRadius: '10px', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: '13px', fontWeight: 600, color: '#f0f0f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: '20px', fontWeight: 900, color: rateColor(cr), flexShrink: 0 }}>{cr.toFixed(1)}%</div>
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginBottom: '8px' }}>
              <span>{r.views.toLocaleString()} views</span>
              <span>{r.sold.toLocaleString()} sold</span>
              <span>${r.revenue.toFixed(0)}</span>
            </div>
            <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, cr)}%`, background: rateColor(cr), borderRadius: '2px' }}/>
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
  { id: 'views', label: 'Views' },
  { id: 'conversion', label: 'Conversion' },
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
        {tab === 'views'    && <ViewsTab/>}
        {tab === 'conversion' && <ConversionTab/>}
      </div>
    </>
  )
}