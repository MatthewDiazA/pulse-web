'use client'
import { useEffect, useState } from 'react'
import { useMagneticButton, useNavLogo } from '../lib/animations'
import { createClient } from '../lib/supabase/client'

type Buyer = {
  ticket_id: string
  user_id: string | null
  holder_name: string | null
  is_guestlist: boolean
  is_checked_in: boolean
  name: string
}

export default function HostDashboard() {
  const [events, setEvents] = useState<any[]>([])
  const logoRef = useNavLogo<HTMLButtonElement>()
  const createBtnRef = useMagneticButton<HTMLButtonElement>()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  // per-event UI state
  const [openGuests, setOpenGuests] = useState<string | null>(null)
  const [buyers, setBuyers] = useState<Record<string, Buyer[]>>({})
  const [loadingBuyers, setLoadingBuyers] = useState<string | null>(null)
  const [genLink, setGenLink] = useState<string | null>(null)
  const [genningFor, setGenningFor] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState(false)

  useEffect(() => {
    const fetchEvents = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)
      const { data } = await supabase.from('events').select('*, ticket_tiers(*)').eq('host_id', user.id).order('created_at', { ascending: false })
      setEvents(data ?? [])
      setLoading(false)
    }
    fetchEvents()
  }, [])

  const [viewCounts, setViewCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (events.length === 0) return
    // Fetch view counts for all events
    Promise.all(events.map(e =>
      fetch(`/api/pageview?event_id=${e.id}&period=30d`)
        .then(r => r.json())
        .then(d => ({ id: e.id, total: d.total ?? 0 }))
        .catch(() => ({ id: e.id, total: 0 }))
    )).then(results => {
      const counts: Record<string, number> = {}
      results.forEach(r => { counts[r.id] = r.total })
      setViewCounts(counts)
    })
  }, [events])

  const totalTickets = events.reduce((sum, e) => sum + (e.ticket_tiers?.reduce((s: number, t: any) => s + t.quantity_sold, 0) ?? 0), 0)
  const totalRevenue = events.reduce((sum, e) => sum + (e.ticket_tiers?.reduce((s: number, t: any) => s + (t.quantity_sold * t.price), 0) ?? 0), 0)
  const publishedCount = events.filter(e => e.status === 'published').length
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'

  // Feature #4 — load buyers for one event
  const toggleGuests = async (eventId: string) => {
    if (openGuests === eventId) { setOpenGuests(null); return }
    setOpenGuests(eventId)
    if (buyers[eventId]) return // cached

    setLoadingBuyers(eventId)
    const supabase = createClient()

    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, user_id, holder_name, is_guestlist, is_checked_in')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })

    const rows: Buyer[] = []
    const userIds = Array.from(new Set((tickets ?? []).map(t => t.user_id).filter(Boolean))) as string[]

    // Try to resolve names from profiles
    let nameMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', userIds)
      for (const p of profs ?? []) {
        nameMap[p.id] = p.full_name ?? p.username ?? ''
      }
    }

    for (const t of tickets ?? []) {
      rows.push({
        ticket_id: t.id,
        user_id: t.user_id,
        holder_name: t.holder_name,
        is_guestlist: !!t.is_guestlist,
        is_checked_in: !!t.is_checked_in,
        name: t.holder_name || (t.user_id ? (nameMap[t.user_id] || 'Guest') : 'Guest'),
      })
    }

    setBuyers(prev => ({ ...prev, [eventId]: rows }))
    setLoadingBuyers(null)
  }

  // Feature #3 — generate a single-use GL link for one event
  const generateGuestLink = async (eventId: string) => {
    setGenningFor(eventId)
    setGenLink(null)
    setCopiedToken(false)
    const supabase = createClient()

    const token = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`

    const { error } = await supabase.from('guest_invites').insert({
      event_id: eventId,
      token,
      created_by: user.id,
    })

    if (error) {
      alert('Could not generate link: ' + error.message)
      setGenningFor(null)
      return
    }

    const link = `${window.location.origin}/gl/${token}`
    setGenLink(link)
    setGenningFor(null)

    try {
      await navigator.clipboard.writeText(link)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2500)
    } catch {
      // user can copy manually from the shown field
    }
  }

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Syne:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:#000;font-family:'Syne',sans-serif;color:#f0f0f0;}
        .wrap{max-width:1100px;margin:0 auto;padding:0 20px;}
        nav{padding:14px 0;background:rgba(0,0,0,0.95);position:sticky;top:0;z-index:100;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);position:relative;}
        nav::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#ff6600,#ffaa33,#ffc850,#ff6600,transparent);background-size:300% 100%;animation:navPulse 5s ease-in-out infinite;}
        @keyframes navPulse{0%{background-position:0% 50%;opacity:0.2}50%{background-position:100% 50%;opacity:1}100%{background-position:0% 50%;opacity:0.2}}
        .nav-inner{display:flex;align-items:center;justify-content:space-between;}
        .logo{cursor:pointer;background:none;border:none;padding:0;line-height:0;display:inline-flex;}
        .logo-img{height:22px;width:auto;filter:drop-shadow(0 0 10px rgba(255,170,51,0.4));}
        @media(max-width:680px){.logo-img{height:20px;}}
        .nav-right{display:flex;align-items:center;gap:10px;}
        .back{font-size:13px;color:#554;background:none;border:none;cursor:pointer;font-family:'Syne',sans-serif;transition:color 0.15s;display:inline-flex;align-items:center;gap:5px;}
        .back:hover{color:#f0f0f0;}
        .create-btn{background:#ffaa33;color:#000;font-size:13px;font-weight:700;padding:8px 16px;border-radius:100px;border:none;cursor:pointer;font-family:'Syne',sans-serif;box-shadow:0 0 14px rgba(255,170,51,0.3);display:inline-flex;align-items:center;gap:6px;transition:all 0.15s;}
        .create-btn:active{transform:scale(0.97);}
        .hero-section{padding:40px 0 32px;border-bottom:0.5px solid rgba(255,255,255,0.04);margin-bottom:28px;}
        .greeting{font-family:'Barlow Condensed',sans-serif;font-size:clamp(48px,10vw,72px);line-height:0.95;font-weight:900;text-transform:uppercase;margin-bottom:8px;}
        .greeting span{color:#ffaa33;text-shadow:0 0 8px rgba(255,170,51,0.5),0 0 16px rgba(255,170,51,0.25);}
        .greeting-sub{font-size:14px;color:#554;font-weight:300;}
        .stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:24px;}
        @media(min-width:600px){.stats{grid-template-columns:repeat(4,1fr);}}
        .stat{background:#0d0800;border-radius:14px;padding:18px 20px;border:0.5px solid rgba(255,255,255,0.05);transition:border-color 0.2s;}
        .stat:hover{border-color:rgba(255,255,255,0.1);}
        .stat-label{font-size:10px;color:#443;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:10px;font-family:'Syne',sans-serif;}
        .stat-value{font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:36px;color:#f0f0f0;letter-spacing:0.5px;line-height:1;}
        .stat-value.accent{color:#ffaa33;text-shadow:0 0 8px rgba(255,170,51,0.3);}
        .charts{display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:24px;}
        @media(min-width:600px){.charts{grid-template-columns:1fr 1fr;}}
        .chart-section{background:#0d0800;border:0.5px solid rgba(255,255,255,0.05);border-radius:14px;padding:20px;}
        .chart-title{font-size:10px;color:#443;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:16px;font-family:'Syne',sans-serif;}
        .chart-bars{display:flex;align-items:flex-end;gap:8px;height:80px;}
        .bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;}
        .bar{width:100%;border-radius:4px 4px 0 0;min-height:4px;}
        .bar-label{font-size:9px;color:#332;text-align:center;font-family:'Syne',sans-serif;}
        .section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:0.5px solid rgba(255,255,255,0.05);}
        .section-title{font-size:11px;color:#443;letter-spacing:0.8px;text-transform:uppercase;font-family:'Syne',sans-serif;}
        .events-list{display:flex;flex-direction:column;gap:1px;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.05);border-radius:14px;overflow:hidden;margin-bottom:40px;}
        .event-row{background:#000;padding:16px 20px;display:flex;align-items:center;gap:14px;transition:background 0.15s;flex-wrap:wrap;}
        @media(hover:hover){.event-row:hover{background:#0d0800;}}
        .event-dot{width:7px;height:7px;border-radius:50%;background:#ffaa33;flex-shrink:0;}
        .event-dot.draft{background:#2a2a2a;}
        .event-name{font-size:14px;font-weight:500;color:#f0f0f0;margin-bottom:2px;}
        .event-date{font-size:11px;color:#443;}
        .event-info{flex:1;min-width:120px;}
        .event-stat{text-align:right;min-width:60px;}
        .event-stat-value{font-size:14px;font-weight:500;color:#f0f0f0;}
        .event-stat-label{font-size:10px;color:#443;margin-top:2px;}
        .status-badge{font-size:10px;font-weight:600;padding:3px 8px;border-radius:100px;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;}
        .status-published{background:rgba(255,170,51,0.1);color:#ffaa33;border:0.5px solid rgba(255,170,51,0.2);}
        .status-draft{background:rgba(255,255,255,0.04);color:#443;border:0.5px solid rgba(255,255,255,0.08);}
        .row-actions{display:flex;gap:6px;flex-wrap:wrap;}
        .action-btn{font-size:11px;color:#554;background:rgba(255,255,255,0.04);border:0.5px solid rgba(255,255,255,0.08);border-radius:6px;padding:5px 10px;cursor:pointer;font-family:'Syne',sans-serif;transition:all 0.15s;white-space:nowrap;}
        .action-btn:hover{color:#f0f0f0;border-color:rgba(255,255,255,0.16);}
        .action-btn.gl{color:#ffaa33;border-color:rgba(255,170,51,0.25);background:rgba(255,170,51,0.06);}
        .action-btn.gl:hover{background:rgba(255,170,51,0.12);}
        /* guests + gl panel */
        .guest-panel{width:100%;background:#0a0500;border-top:0.5px solid rgba(255,170,51,0.1);padding:16px 20px;}
        .gl-linkbox{display:flex;gap:8px;align-items:center;background:rgba(255,170,51,0.06);border:0.5px solid rgba(255,170,51,0.2);border-radius:8px;padding:8px 12px;margin-bottom:14px;}
        .gl-linkbox input{flex:1;background:none;border:none;color:#ffc850;font-size:12px;font-family:monospace;outline:none;min-width:0;}
        .gl-copy{font-size:11px;color:#ffaa33;background:none;border:0.5px solid rgba(255,170,51,0.3);border-radius:6px;padding:5px 10px;cursor:pointer;white-space:nowrap;font-family:'Syne',sans-serif;}
        .guest-hint{font-size:11px;color:#665;margin-bottom:10px;}
        .guest-li{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:0.5px solid rgba(255,255,255,0.04);}
        .guest-av{width:28px;height:28px;border-radius:50%;background:rgba(255,170,51,0.1);display:flex;align-items:center;justify-content:center;font-size:11px;color:#ffaa33;font-weight:600;flex-shrink:0;}
        .guest-name{font-size:13px;color:#e0e0e0;flex:1;cursor:pointer;}
        .guest-name:hover{color:#ffaa33;}
        .guest-tag{font-size:9px;font-weight:700;letter-spacing:0.5px;padding:2px 7px;border-radius:4px;text-transform:uppercase;}
        .guest-tag.gl{background:linear-gradient(135deg,#ffaa33,#ff6600);color:#000;}
        .guest-tag.in{background:rgba(80,200,120,0.12);color:#5ec888;border:0.5px solid rgba(80,200,120,0.3);}
        .empty-state{text-align:center;padding:60px 20px;}
        .empty-title{font-family:'Barlow Condensed',sans-serif;font-size:28px;font-weight:900;color:#f0f0f0;margin-bottom:8px;text-transform:uppercase;}
        .empty-sub{font-size:14px;color:#443;margin-bottom:24px;}
        .empty-btn{background:#ffaa33;color:#000;font-size:14px;font-weight:700;padding:12px 28px;border-radius:100px;border:none;cursor:pointer;font-family:'Syne',sans-serif;box-shadow:0 0 16px rgba(255,170,51,0.3);display:inline-flex;align-items:center;gap:8px;}
      `}</style>

      <nav>
        <div className="wrap nav-inner">
          <button ref={logoRef} className="logo" onClick={() => window.location.href='/'} aria-label="Pulse home">
            <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
          </button>
          <div className="nav-right">
            <button className="back" onClick={() => window.location.href='/'}><i className="ti ti-arrow-left" style={{fontSize:'13px'}}/>Events</button>
            <button className="create-btn" onClick={() => window.location.href='/host/create'}><i className="ti ti-plus" style={{fontSize:'13px'}}/>create event</button>
          </div>
        </div>
      </nav>

      <div className="wrap">
        <div className="hero-section">
          <h1 className="greeting">Your events,<br/><span>{firstName}.</span></h1>
          <p className="greeting-sub">Track your sales, manage events and grow your audience.</p>
        </div>

        <div className="stats">
          <div className="stat"><div className="stat-label">Total events</div><div className="stat-value">{events.length}</div></div>
          <div className="stat"><div className="stat-label">Tickets sold</div><div className="stat-value">{totalTickets}</div></div>
          <div className="stat"><div className="stat-label">Total revenue</div><div className="stat-value accent">${totalRevenue.toLocaleString()}</div></div>
          <div className="stat"><div className="stat-label">Published</div><div className="stat-value">{publishedCount}</div></div>
        </div>

        {events.length > 0 && (
          <div className="charts">
            <div className="chart-section">
              <div className="chart-title">Tickets sold by event</div>
              <div className="chart-bars">
                {events.map(e => {
                  const sold = e.ticket_tiers?.reduce((s: number, t: any) => s + t.quantity_sold, 0) ?? 0
                  const total = e.ticket_tiers?.reduce((s: number, t: any) => s + t.quantity, 0) ?? 1
                  const pct = Math.max(4, (sold / Math.max(total, 1)) * 100)
                  return <div key={e.id} className="bar-wrap"><div className="bar" style={{height:`${pct}%`,background:'rgba(255,170,51,0.4)',border:'0.5px solid rgba(255,170,51,0.6)'}}/><div className="bar-label">{e.title.slice(0,6)}</div></div>
                })}
              </div>
            </div>
            <div className="chart-section">
              <div className="chart-title">Revenue by event ($)</div>
              <div className="chart-bars">
                {events.map(e => {
                  const revenue = e.ticket_tiers?.reduce((s: number, t: any) => s + (t.quantity_sold * t.price), 0) ?? 0
                  const maxRevenue = Math.max(...events.map((ev: any) => ev.ticket_tiers?.reduce((s: number, t: any) => s + (t.quantity_sold * t.price), 0) ?? 0), 1)
                  const pct = Math.max(4, (revenue / maxRevenue) * 100)
                  return <div key={e.id} className="bar-wrap"><div className="bar" style={{height:`${pct}%`,background:'rgba(255,102,0,0.4)',border:'0.5px solid rgba(255,102,0,0.6)'}}/><div className="bar-label">{e.title.slice(0,6)}</div></div>
                })}
              </div>
            </div>
          </div>
        )}

        <div className="section-header"><div className="section-title">My events</div></div>

        {loading ? (
          <div style={{textAlign:'center',padding:'60px',color:'#332',fontSize:'14px'}}>Loading your events...</div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">No events yet</div>
            <div className="empty-sub">Create your first event and start selling tickets</div>
            <button className="empty-btn" onClick={() => window.location.href='/host/create'}><i className="ti ti-plus" style={{fontSize:'14px'}}/>create your first event</button>
          </div>
        ) : (
          <div className="events-list">
            {events.map(e => {
              const sold = e.ticket_tiers?.reduce((s: number, t: any) => s + t.quantity_sold, 0) ?? 0
              const date = e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : 'No date'
              const isOpen = openGuests === e.id
              const list = buyers[e.id] ?? []
              return (
                <div key={e.id} style={{display:'contents'}}>
                  <div className="event-row">
                    <div className={`event-dot ${e.status === 'draft' ? 'draft' : ''}`}/>
                    <div className="event-info"><div className="event-name">{e.title}</div><div className="event-date">{date}</div></div>
                    <div className="event-stat"><div className="event-stat-value">{sold}</div><div className="event-stat-label">sold</div></div>
                    <div className="event-stat"><div className="event-stat-value">{viewCounts[e.id] ?? '—'}</div><div className="event-stat-label">views</div></div>
                    <span className={`status-badge status-${e.status}`}>{e.status}</span>
                    <div className="row-actions">
                      <button className="action-btn" onClick={() => window.location.href=`/events/${e.id}`}>View</button>
                      <button className="action-btn" onClick={() => window.location.href=`/host/edit/${e.id}`}>Edit</button>
                      <button className="action-btn" onClick={() => toggleGuests(e.id)}>{isOpen ? 'Hide guests' : 'Guests'}</button>
                      <button className="action-btn gl" onClick={() => generateGuestLink(e.id)}>
                        {genningFor === e.id ? 'Generating…' : 'Guest link'}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="guest-panel">
                      {genLink && genningFor !== e.id && (
                        <div className="gl-linkbox">
                          <input readOnly value={genLink} onFocus={ev => ev.currentTarget.select()} />
                          <button className="gl-copy" onClick={async () => {
                            try { await navigator.clipboard.writeText(genLink); setCopiedToken(true); setTimeout(()=>setCopiedToken(false),2000) } catch {}
                          }}>{copiedToken ? 'Copied!' : 'Copy'}</button>
                        </div>
                      )}
                      <div className="guest-hint">Each guest link works once. Generate a new one for each person.</div>
                      {loadingBuyers === e.id ? (
                        <div style={{fontSize:'13px',color:'#554',padding:'8px 0'}}>Loading guests…</div>
                      ) : list.length === 0 ? (
                        <div style={{fontSize:'13px',color:'#554',padding:'8px 0'}}>No ticket holders yet.</div>
                      ) : (
                        list.map(b => (
                          <div key={b.ticket_id} className="guest-li">
                            <div className="guest-av">{(b.name || 'G').slice(0,2).toUpperCase()}</div>
                            <div className="guest-name" onClick={() => b.user_id && (window.location.href=`/profile/${b.user_id}`)}>{b.name}</div>
                            {b.is_guestlist && <span className="guest-tag gl">GL</span>}
                            {b.is_checked_in && <span className="guest-tag in">In</span>}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}