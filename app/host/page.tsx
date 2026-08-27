'use client'
import { useEffect, useState } from 'react'
import { useNavLogo } from '../lib/animations'
import { createClient } from '../lib/supabase/client'

type Buyer = {
  ticket_id: string
  user_id: string | null
  is_checked_in: boolean
  is_guestlist: boolean
  name: string
}

function money(n: number): string {
  return Number.isInteger(n) ? `$${n.toLocaleString()}` : `$${n.toFixed(2)}`
}

export default function HostDashboard() {
  const [events, setEvents] = useState<any[]>([])
  const logoRef = useNavLogo<HTMLButtonElement>()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [hostNames, setHostNames] = useState<Record<string, string>>({})

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

      // Admins see every event on the platform, not just the ones they created.
      // PULSE is run by more than one person — a dashboard that hides a co-admin's
      // show reports $0 on a night that's actually selling.
      const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', user.id).single()
      const admin_ = !!admin || user.email === 'mad2288@columbia.edu'
      setIsAdmin(admin_)

      const query = supabase.from('events').select('*, ticket_tiers(*)').order('created_at', { ascending: false })
      const { data } = admin_ ? await query : await query.eq('host_id', user.id)
      const list = data ?? []
      setEvents(list)
      setLoading(false)

      // Resolve host names so an admin can tell whose event is whose
      if (admin_ && list.length) {
        const hostIds = Array.from(new Set(list.map((e: any) => e.host_id).filter(Boolean)))
        if (hostIds.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name, username')
            .in('id', hostIds)
          const map: Record<string, string> = {}
          for (const p of profs ?? []) map[p.id] = p.full_name ?? p.username ?? ''
          setHostNames(map)
        }
      }
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

  const soldOf = (e: any) => e.ticket_tiers?.reduce((s: number, t: any) => s + (t.quantity_sold ?? 0), 0) ?? 0
  const revenueOf = (e: any) => e.ticket_tiers?.reduce((s: number, t: any) => s + ((t.quantity_sold ?? 0) * Number(t.price ?? 0)), 0) ?? 0

  const totalTickets = events.reduce((sum, e) => sum + soldOf(e), 0)
  const totalRevenue = events.reduce((sum, e) => sum + revenueOf(e), 0)
  const totalViews = events.reduce((sum, e) => sum + (viewCounts[e.id] ?? 0), 0)
  const conversion = totalViews > 0 ? (totalTickets / totalViews) * 100 : null

  // Feature #4 — load buyers for one event
  const toggleGuests = async (eventId: string) => {
    if (openGuests === eventId) { setOpenGuests(null); return }
    setOpenGuests(eventId)
    if (buyers[eventId]) return // cached

    setLoadingBuyers(eventId)
    const supabase = createClient()

    const { data: tickets } = await supabase
      .from('tickets')
      .select('id, user_id, is_checked_in, is_guestlist')
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
        is_checked_in: !!t.is_checked_in,
        is_guestlist: !!t.is_guestlist,
        name: t.user_id ? (nameMap[t.user_id] || 'Guest') : 'Guest',
      })
    }

    setBuyers(prev => ({ ...prev, [eventId]: rows }))
    setLoadingBuyers(null)
  }

  // Generate (or retrieve) the persistent broadcast guest link for an event
  const generateGuestLink = async (eventId: string) => {
    setGenningFor(eventId)
    try {
      const supabase = createClient()
      // Reuse the existing link for this event if there is one, so it stays a single
      // shareable broadcast link. Falls back to creating one the first time.
      const { data: existing } = await supabase
        .from('guest_invites')
        .select('token')
        .eq('event_id', eventId)
        .limit(1)
      let token = existing?.[0]?.token as string | undefined
      if (!token) {
        token = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`
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
      }
      const link = `${window.location.origin}/gl/${token}`
      setGenLink(link)
      setOpenGuests(eventId) // auto-open the guests panel so the link is visible
      try {
        await navigator.clipboard.writeText(link)
        setCopiedToken(true)
        setTimeout(() => setCopiedToken(false), 2500)
      } catch {}
    } catch {
      alert('Something went wrong')
    }
    setGenningFor(null)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=Syne:wght@400;500;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:#000;font-family:'Syne',sans-serif;color:#f0f0f0;}
        .wrap{max-width:1100px;margin:0 auto;padding:0 22px;}

        nav{padding:16px 0;background:rgba(0,0,0,0.9);position:sticky;top:0;z-index:100;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(255,255,255,0.1);}
        .nav-inner{display:flex;align-items:center;justify-content:space-between;}
        .logo{cursor:pointer;background:none;border:none;padding:0;line-height:0;display:inline-flex;}
        .logo-img{height:19px;width:auto;}
        .nav-right{display:flex;align-items:center;gap:18px;}
        .nav-btn{font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.4);background:none;border:none;cursor:pointer;font-family:'Syne',sans-serif;padding:0;transition:color 0.15s;white-space:nowrap;}
        .nav-btn:hover{color:#fff;}
        .nav-create{font-size:11px;letter-spacing:2px;color:rgba(255,255,255,0.75);background:none;border:0.5px solid rgba(255,255,255,0.25);padding:9px 16px;cursor:pointer;font-family:'Syne',sans-serif;transition:all 0.15s;white-space:nowrap;}
        .nav-create:hover{border-color:#fff;color:#fff;}

        .page-head{padding:44px 0 22px;}
        .page-title{font-family:'Barlow Condensed',sans-serif;font-size:44px;font-weight:700;color:#fff;line-height:1;letter-spacing:-0.5px;}
        .page-scope{font-size:10px;letter-spacing:3px;color:rgba(255,255,255,0.3);margin-top:10px;}

        /* Numbers on black, hairline separated — a box-office report, not cards */
        .stats{display:grid;grid-template-columns:repeat(2,1fr);border-top:0.5px solid rgba(255,255,255,0.12);margin-bottom:44px;}
        @media(min-width:700px){.stats{grid-template-columns:repeat(4,1fr);}}
        .stat{padding:22px 0 20px;border-bottom:0.5px solid rgba(255,255,255,0.12);}
        .stat + .stat{border-left:0.5px solid rgba(255,255,255,0.12);padding-left:22px;}
        @media(max-width:699px){.stat:nth-child(odd){border-left:none;padding-left:0;}}
        .stat-label{font-size:9px;color:rgba(255,255,255,0.3);letter-spacing:2.5px;margin-bottom:12px;}
        .stat-value{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:46px;color:#fff;line-height:0.9;letter-spacing:-1px;}

        .section-header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px;}
        .section-title{font-size:10px;color:rgba(255,255,255,0.3);letter-spacing:3px;}

        .events-list{border-top:0.5px solid rgba(255,255,255,0.12);margin-bottom:60px;}
        .event-row{padding:20px 0;display:flex;align-items:center;gap:18px;flex-wrap:wrap;border-bottom:0.5px solid rgba(255,255,255,0.09);}
        .event-info{flex:1;min-width:150px;}
        .event-name{font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:700;color:#fff;line-height:1;letter-spacing:-0.3px;}
        .event-date{font-size:10px;color:rgba(255,255,255,0.35);letter-spacing:1.5px;margin-top:6px;}
        .event-date .draft{color:rgba(255,255,255,0.28);}
        .event-date .live{color:rgba(255,255,255,0.5);}
        .event-stat{text-align:right;min-width:62px;}
        .event-stat-value{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:700;color:#fff;line-height:1;}
        .event-stat-label{font-size:9px;color:rgba(255,255,255,0.28);margin-top:5px;letter-spacing:1.5px;}
        .row-actions{display:flex;gap:14px;flex-wrap:wrap;}
        .action-btn{font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,0.4);background:none;border:none;padding:0;cursor:pointer;font-family:'Syne',sans-serif;transition:color 0.15s;white-space:nowrap;}
        .action-btn:hover{color:#fff;}

        .guest-panel{width:100%;padding:18px 0 6px;border-top:0.5px solid rgba(255,255,255,0.07);}
        .gl-linkbox{display:flex;gap:10px;align-items:center;border:0.5px solid rgba(255,255,255,0.18);padding:10px 12px;margin-bottom:14px;}
        .gl-linkbox input{flex:1;background:none;border:none;color:rgba(255,255,255,0.7);font-size:12px;font-family:monospace;outline:none;min-width:0;}
        .gl-copy{font-size:10px;letter-spacing:1.5px;color:rgba(255,255,255,0.6);background:none;border:0.5px solid rgba(255,255,255,0.22);padding:6px 12px;cursor:pointer;white-space:nowrap;font-family:'Syne',sans-serif;}
        .gl-copy:hover{color:#fff;border-color:#fff;}
        .guest-hint{font-size:11px;color:rgba(255,255,255,0.3);margin-bottom:14px;letter-spacing:0.5px;}
        .guest-li{display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:0.5px solid rgba(255,255,255,0.06);}
        .guest-name{font-size:13px;color:rgba(255,255,255,0.75);flex:1;}
        .guest-tag{font-size:9px;letter-spacing:1.5px;}
        .guest-tag.gl{color:#ffaa33;}
        .guest-tag.in{color:#5ec888;}

        .empty-state{padding:70px 0;}
        .empty-title{font-family:'Barlow Condensed',sans-serif;font-size:34px;font-weight:700;color:#fff;margin-bottom:10px;letter-spacing:-0.5px;}
        .empty-sub{font-size:12px;color:rgba(255,255,255,0.35);margin-bottom:26px;letter-spacing:1px;}
        .empty-btn{background:none;border:0.5px solid rgba(255,255,255,0.25);color:#fff;font-size:11px;letter-spacing:2px;padding:12px 24px;cursor:pointer;font-family:'Syne',sans-serif;}
        .empty-btn:hover{border-color:#fff;}
      `}</style>

      <nav>
        <div className="wrap nav-inner">
          <button ref={logoRef} className="logo" onClick={() => window.location.href='/'} aria-label="Pulse home">
            <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
          </button>
          <div className="nav-right">
            <button className="nav-btn" onClick={() => window.location.href='/'}>events</button>
            <button className="nav-create" onClick={() => window.location.href='/host/create'}>+ create</button>
          </div>
        </div>
      </nav>

      <div className="wrap">
        <div className="page-head">
          <h1 className="page-title">dashboard</h1>
          <div className="page-scope">{isAdmin ? 'all events · platform' : 'your events'}</div>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat-label">events</div>
            <div className="stat-value">{events.length}</div>
          </div>
          <div className="stat">
            <div className="stat-label">tickets sold</div>
            <div className="stat-value">{totalTickets}</div>
          </div>
          <div className="stat">
            <div className="stat-label">revenue</div>
            <div className="stat-value">{money(totalRevenue)}</div>
          </div>
          <div className="stat">
            <div className="stat-label">view → ticket</div>
            <div className="stat-value">{conversion === null ? '—' : `${conversion.toFixed(1)}%`}</div>
          </div>
        </div>

        <div className="section-header">
          <div className="section-title">{isAdmin ? 'all events' : 'my events'}</div>
        </div>

        {loading ? (
          <div style={{padding:'60px 0',color:'rgba(255,255,255,0.3)',fontSize:'12px',letterSpacing:'1.5px'}}>loading…</div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-title">no events yet</div>
            <div className="empty-sub">create your first event and start selling tickets</div>
            <button className="empty-btn" onClick={() => window.location.href='/host/create'}>+ create event</button>
          </div>
        ) : (
          <div className="events-list">
            {events.map(e => {
              const sold = soldOf(e)
              const views = viewCounts[e.id] ?? 0
              const conv = views > 0 ? (sold / views) * 100 : null
              const revenue = revenueOf(e)
              const date = e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-US', { month:'short', day:'numeric' }).toLowerCase() : 'no date'
              const isOpen = openGuests === e.id
              const list = buyers[e.id] ?? []
              const hostLabel = isAdmin && e.host_id !== user?.id ? (hostNames[e.host_id] || 'other host') : null
              return (
                <div key={e.id} style={{display:'contents'}}>
                  <div className="event-row">
                    <div className="event-info">
                      <div className="event-name">{(e.title ?? '').toLowerCase()}</div>
                      <div className="event-date">
                        {date}
                        {' · '}
                        <span className={e.status === 'published' ? 'live' : 'draft'}>
                          {e.status === 'published' ? 'live' : 'draft'}
                        </span>
                        {hostLabel && <> · {hostLabel.toLowerCase()}</>}
                      </div>
                    </div>
                    <div className="event-stat">
                      <div className="event-stat-value">{views || '—'}</div>
                      <div className="event-stat-label">views</div>
                    </div>
                    <div className="event-stat">
                      <div className="event-stat-value">{sold}</div>
                      <div className="event-stat-label">sold</div>
                    </div>
                    <div className="event-stat">
                      <div className="event-stat-value">{conv === null ? '—' : `${conv.toFixed(1)}%`}</div>
                      <div className="event-stat-label">conv</div>
                    </div>
                    <div className="event-stat">
                      <div className="event-stat-value">{money(revenue)}</div>
                      <div className="event-stat-label">revenue</div>
                    </div>
                    <div className="row-actions">
                      <button className="action-btn" onClick={() => window.location.href=`/events/${e.id}`}>view</button>
                      <button className="action-btn" onClick={() => window.location.href=`/host/edit/${e.id}`}>edit</button>
                      <button className="action-btn" onClick={() => toggleGuests(e.id)}>{isOpen ? 'hide' : 'guests'}</button>
                      <button className="action-btn" onClick={() => generateGuestLink(e.id)}>
                        {genningFor === e.id ? 'generating…' : 'guest link'}
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="guest-panel">
                      {genLink && (
                        <div className="gl-linkbox">
                          <input readOnly value={genLink} onFocus={ev => ev.currentTarget.select()} />
                          <button className="gl-copy" onClick={async () => {
                            try { await navigator.clipboard.writeText(genLink); setCopiedToken(true); setTimeout(()=>setCopiedToken(false),2000) } catch {}
                          }}>{copiedToken ? 'copied' : 'copy'}</button>
                        </div>
                      )}
                      <div className="guest-hint">
                        {genLink ? 'anyone who opens this link gets a free guest ticket — share it anywhere.' : 'tap "guest link" to create one shareable invite link for this event.'}
                      </div>
                      {loadingBuyers === e.id ? (
                        <div style={{fontSize:'12px',color:'rgba(255,255,255,0.3)',padding:'8px 0'}}>loading guests…</div>
                      ) : list.length === 0 ? (
                        <div style={{fontSize:'12px',color:'rgba(255,255,255,0.3)',padding:'8px 0'}}>no ticket holders yet.</div>
                      ) : (
                        <>
                          <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',letterSpacing:'2px',margin:'4px 0 12px'}}>
                            {list.length} total · {list.filter(b => b.is_guestlist).length} on guest list · {list.filter(b => b.is_checked_in).length} checked in
                          </div>
                          {list.map(b => (
                            <div key={b.ticket_id} className="guest-li">
                              <div className="guest-name">{b.name}</div>
                              {b.is_guestlist && <span className="guest-tag gl">guest list</span>}
                              {b.is_checked_in && <span className="guest-tag in">in</span>}
                            </div>
                          ))}
                        </>
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