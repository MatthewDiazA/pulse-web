'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase/client'

export default function HostDashboard() {
  const [activeTab, setActiveTab] = useState('events')
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    const fetchEvents = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login'; return }
      setUser(user)
      const { data } = await supabase
        .from('events')
        .select('*, ticket_tiers(*)')
        .eq('host_id', user.id)
        .order('created_at', { ascending: false })
      setEvents(data ?? [])
      setLoading(false)
    }
    fetchEvents()
  }, [])

  const totalTickets = events.reduce((sum, e) => sum + (e.ticket_tiers?.reduce((s: number, t: any) => s + t.quantity_sold, 0) ?? 0), 0)
  const totalRevenue = events.reduce((sum, e) => sum + (e.ticket_tiers?.reduce((s: number, t: any) => s + (t.quantity_sold * t.price), 0) ?? 0), 0)
  const publishedCount = events.filter(e => e.status === 'published').length
  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@900&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
        body { background:#0a0a0b; font-family:'DM Sans',sans-serif; color:#f0f0f0; }
        .wrap { max-width:1100px; margin:0 auto; padding:0 20px; }
        nav { border-bottom:none; padding:14px 0; background:rgba(10,10,11,0.95); position:sticky; top:0; z-index:100; backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); position:relative; }
        nav::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1px; background:linear-gradient(90deg,transparent,#e8ff47,#ff4fd8,#6399dc,transparent); background-size:300% 100%; animation:navPulse 4s ease-in-out infinite; }
        @keyframes navPulse { 0%{background-position:0% 50%;opacity:0.3} 50%{background-position:100% 50%;opacity:0.7} 100%{background-position:0% 50%;opacity:0.3} }
        .nav-inner { display:flex; align-items:center; justify-content:space-between; }
        .logo { font-family:'Nunito',sans-serif; font-size:28px; font-weight:900; letter-spacing:-0.5px; color:#e8ff47; cursor:pointer; line-height:1; text-transform:lowercase; filter:drop-shadow(0 0 8px rgba(232,255,71,0.3)); }
        .nav-right { display:flex; align-items:center; gap:10px; }
        .back { font-size:13px; color:#555; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .create-btn { background:#e8ff47; color:#0a0a0b; font-size:13px; font-weight:700; padding:8px 16px; border-radius:100px; border:none; cursor:pointer; font-family:'Nunito',sans-serif; box-shadow:0 0 12px rgba(232,255,71,0.3); display:flex; align-items:center; gap:4px; }
        .hero-section { padding:40px 0 32px; border-bottom:0.5px solid rgba(255,255,255,0.06); margin-bottom:28px; }
        .greeting { font-family:'Barlow Condensed',sans-serif; font-size:clamp(48px,10vw,72px); line-height:0.95; font-weight:900; text-transform:uppercase; margin-bottom:8px; }
        .greeting span { color:#e8ff47; text-shadow:0 0 8px rgba(232,255,71,0.5), 0 0 16px rgba(232,255,71,0.25); }
        .greeting-sub { font-size:14px; color:#555; font-weight:300; }
        .stats { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; margin-bottom:24px; }
        @media(min-width:600px){ .stats { grid-template-columns:repeat(4,1fr); } }
        .stat { background:#16161a; border-radius:14px; padding:18px 20px; border:0.5px solid rgba(255,255,255,0.08); position:relative; overflow:hidden; transition:border-color 0.2s; }
        .stat:hover { border-color:rgba(255,255,255,0.16); }
        .stat-label { font-size:10px; color:#555; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:10px; font-family:'DM Sans',sans-serif; }
        .stat-value { font-family:'Barlow Condensed',sans-serif; font-weight:900; font-size:36px; color:#f0f0f0; letter-spacing:0.5px; line-height:1; }
        .stat-value.accent { color:#e8ff47; text-shadow:0 0 8px rgba(232,255,71,0.3); }
        .stat-icon { position:absolute; bottom:14px; right:14px; font-size:22px; opacity:0.12; }
        .charts { display:grid; grid-template-columns:1fr; gap:10px; margin-bottom:24px; }
        @media(min-width:600px){ .charts { grid-template-columns:1fr 1fr; } }
        .chart-section { background:#16161a; border:0.5px solid rgba(255,255,255,0.08); border-radius:14px; padding:20px; }
        .chart-title { font-size:10px; color:#555; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:16px; font-family:'DM Sans',sans-serif; }
        .chart-bars { display:flex; align-items:flex-end; gap:8px; height:80px; }
        .bar-wrap { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; }
        .bar { width:100%; border-radius:4px 4px 0 0; transition:all 0.3s; min-height:4px; }
        .bar-label { font-size:9px; color:#444; text-align:center; font-family:'DM Sans',sans-serif; }
        .tabs { display:flex; gap:0; border-bottom:0.5px solid rgba(255,255,255,0.08); margin-bottom:20px; }
        .tab { font-size:13px; color:#555; padding:10px 16px; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-0.5px; font-family:'DM Sans',sans-serif; background:none; border-top:none; border-left:none; border-right:none; transition:color 0.15s; }
        .tab.active { color:#f0f0f0; border-bottom-color:#e8ff47; }
        .events-list { display:flex; flex-direction:column; gap:1px; background:rgba(255,255,255,0.06); border:0.5px solid rgba(255,255,255,0.08); border-radius:14px; overflow:hidden; margin-bottom:40px; }
        .event-row { background:#0a0a0b; padding:16px 20px; display:flex; align-items:center; gap:14px; transition:background 0.15s; }
        .event-row:active { background:#16161a; }
        @media(hover:hover){ .event-row:hover { background:#16161a; } }
        .event-dot { width:7px; height:7px; border-radius:50%; background:#e8ff47; flex-shrink:0; }
        .event-dot.draft { background:#333; }
        .event-name { font-size:14px; font-weight:500; color:#f0f0f0; margin-bottom:2px; }
        .event-date { font-size:11px; color:#555; }
        .event-info { flex:1; min-width:0; }
        .event-stat { text-align:right; min-width:70px; }
        .event-stat-value { font-size:14px; font-weight:500; color:#f0f0f0; }
        .event-stat-label { font-size:10px; color:#555; margin-top:2px; }
        .status-badge { font-size:10px; font-weight:600; padding:3px 8px; border-radius:100px; text-transform:uppercase; letter-spacing:0.5px; white-space:nowrap; }
        .status-published { background:rgba(232,255,71,0.12); color:#e8ff47; border:0.5px solid rgba(232,255,71,0.25); }
        .status-draft { background:rgba(255,255,255,0.05); color:#555; border:0.5px solid rgba(255,255,255,0.1); }
        .row-actions { display:flex; gap:6px; }
        .action-btn { font-size:11px; color:#666; background:rgba(255,255,255,0.05); border:0.5px solid rgba(255,255,255,0.1); border-radius:6px; padding:5px 10px; cursor:pointer; font-family:'DM Sans',sans-serif; transition:all 0.15s; white-space:nowrap; }
        .action-btn:hover { color:#f0f0f0; border-color:rgba(255,255,255,0.2); }
        .empty-state { text-align:center; padding:60px 20px; }
        .empty-icon { font-size:40px; margin-bottom:16px; }
        .empty-title { font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:900; color:#f0f0f0; margin-bottom:8px; text-transform:uppercase; }
        .empty-sub { font-size:14px; color:#555; margin-bottom:24px; }
        .empty-btn { background:#e8ff47; color:#0a0a0b; font-size:14px; font-weight:700; padding:12px 28px; border-radius:100px; border:none; cursor:pointer; font-family:'Nunito',sans-serif; box-shadow:0 0 16px rgba(232,255,71,0.3); }
      `}</style>

      <nav>
        <div className="wrap nav-inner">
          <div className="logo" onClick={() => window.location.href='/'}>pulse</div>
          <div className="nav-right">
            <button className="back" onClick={() => window.location.href='/'}>← Events</button>
            <button className="create-btn" onClick={() => window.location.href='/host/create'}>✦ create event</button>
          </div>
        </div>
      </nav>

      <div className="wrap">
        <div className="hero-section">
          <h1 className="greeting">Your events,<br/><span>{firstName}.</span></h1>
          <p className="greeting-sub">Track your sales, manage events and grow your audience.</p>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat-label">Total events</div>
            <div className="stat-value">{events.length}</div>
            <div className="stat-icon">🎪</div>
          </div>
          <div className="stat">
            <div className="stat-label">Tickets sold</div>
            <div className="stat-value">{totalTickets}</div>
            <div className="stat-icon">🎫</div>
          </div>
          <div className="stat">
            <div className="stat-label">Total revenue</div>
            <div className="stat-value accent">${totalRevenue.toLocaleString()}</div>
            <div className="stat-icon">💰</div>
          </div>
          <div className="stat">
            <div className="stat-label">Published</div>
            <div className="stat-value">{publishedCount}</div>
            <div className="stat-icon">✦</div>
          </div>
        </div>

        {events.length > 0 && (
          <div className="charts">
            <div className="chart-section">
              <div className="chart-title">Tickets sold by event</div>
              <div className="chart-bars">
                {events.map((e) => {
                  const sold = e.ticket_tiers?.reduce((s: number, t: any) => s + t.quantity_sold, 0) ?? 0
                  const total = e.ticket_tiers?.reduce((s: number, t: any) => s + t.quantity, 0) ?? 1
                  const pct = Math.max(4, (sold / Math.max(total, 1)) * 100)
                  return (
                    <div key={e.id} className="bar-wrap">
                      <div className="bar" style={{height:`${pct}%`, background:'rgba(232,255,71,0.4)', border:'0.5px solid rgba(232,255,71,0.6)'}}/>
                      <div className="bar-label">{e.title.slice(0,6)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="chart-section">
              <div className="chart-title">Revenue by event ($)</div>
              <div className="chart-bars">
                {events.map((e) => {
                  const revenue = e.ticket_tiers?.reduce((s: number, t: any) => s + (t.quantity_sold * t.price), 0) ?? 0
                  const maxRevenue = Math.max(...events.map(ev => ev.ticket_tiers?.reduce((s: number, t: any) => s + (t.quantity_sold * t.price), 0) ?? 0), 1)
                  const pct = Math.max(4, (revenue / maxRevenue) * 100)
                  return (
                    <div key={e.id} className="bar-wrap">
                      <div className="bar" style={{height:`${pct}%`, background:'rgba(255,79,216,0.4)', border:'0.5px solid rgba(255,79,216,0.6)'}}/>
                      <div className="bar-label">{e.title.slice(0,6)}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="tabs">
          <button className={`tab ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>My events</button>
          <button className={`tab ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => setActiveTab('sales')}>Sales</button>
          <button className={`tab ${activeTab === 'payouts' ? 'active' : ''}`} onClick={() => setActiveTab('payouts')}>Payouts</button>
        </div>

        {activeTab === 'events' && (
          loading ? (
            <div style={{textAlign:'center', padding:'60px', color:'#444', fontSize:'14px'}}>Loading your events...</div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎪</div>
              <div className="empty-title">No events yet</div>
              <div className="empty-sub">Create your first event and start selling tickets</div>
              <button className="empty-btn" onClick={() => window.location.href='/host/create'}>✦ create your first event</button>
            </div>
          ) : (
            <div className="events-list">
              {events.map(e => {
                const sold = e.ticket_tiers?.reduce((s: number, t: any) => s + t.quantity_sold, 0) ?? 0
                const revenue = e.ticket_tiers?.reduce((s: number, t: any) => s + (t.quantity_sold * t.price), 0) ?? 0
                const date = e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-US', { month:'short', day:'numeric' }) : 'No date'
                return (
                  <div key={e.id} className="event-row">
                    <div className={`event-dot ${e.status === 'draft' ? 'draft' : ''}`}/>
                    <div className="event-info">
                      <div className="event-name">{e.title}</div>
                      <div className="event-date">{date}</div>
                    </div>
                    <div className="event-stat">
                      <div className="event-stat-value">{sold}</div>
                      <div className="event-stat-label">sold</div>
                    </div>
                    <span className={`status-badge status-${e.status}`}>{e.status}</span>
                    <div className="row-actions">
                      <button className="action-btn" onClick={() => window.location.href=`/events/${e.id}`}>View</button>
                      <button className="action-btn" onClick={() => window.location.href=`/host/edit/${e.id}`}>Edit</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {activeTab === 'sales' && (
          <div style={{textAlign:'center', padding:'60px', color:'#444', fontSize:'14px', fontFamily:'DM Sans,sans-serif'}}>
            Detailed sales breakdown coming soon
          </div>
        )}
        {activeTab === 'payouts' && (
          <div style={{textAlign:'center', padding:'60px', color:'#444', fontSize:'14px', fontFamily:'DM Sans,sans-serif'}}>
            Connect Stripe to view payouts
          </div>
        )}
      </div>
    </>
  )
}