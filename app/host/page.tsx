'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase/client'

export default function HostDashboard() {
  const [activeTab, setActiveTab] = useState('events')
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchEvents = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

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

  const totalTickets = events.reduce((sum, e) => {
    return sum + (e.ticket_tiers?.reduce((s: number, t: any) => s + t.quantity_sold, 0) ?? 0)
  }, 0)

  const totalRevenue = events.reduce((sum, e) => {
    return sum + (e.ticket_tiers?.reduce((s: number, t: any) => s + (t.quantity_sold * t.price), 0) ?? 0)
  }, 0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#0a0a0b; font-family:'DM Sans',sans-serif; color:#f0f0f0; }
        .wrap { max-width:1100px; margin:0 auto; padding:0 40px; }
        nav { border-bottom:0.5px solid rgba(255,255,255,0.08); padding:16px 0; background:#0a0a0b; position:sticky; top:0; z-index:100; }
        .nav-inner { display:flex; align-items:center; justify-content:space-between; }
        .logo { font-family:'Bebas Neue',sans-serif; font-size:24px; letter-spacing:4px; color:#e8ff47; cursor:pointer; }
        .nav-right { display:flex; align-items:center; gap:12px; }
        .back { font-size:13px; color:#888; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .create-btn { background:#e8ff47; color:#0a0a0b; font-size:13px; font-weight:500; padding:8px 18px; border-radius:6px; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .page-header { padding:40px 0 32px; border-bottom:0.5px solid rgba(255,255,255,0.08); }
        .page-title { font-family:'Bebas Neue',sans-serif; font-size:48px; letter-spacing:1px; color:#f0f0f0; margin-bottom:4px; }
        .page-sub { font-size:14px; color:#888; }
        .stats { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; padding:32px 0; }
        .stat { background:#16161a; border-radius:8px; padding:16px; }
        .stat-label { font-size:11px; color:#888; letter-spacing:0.6px; text-transform:uppercase; margin-bottom:8px; }
        .stat-value { font-family:'Bebas Neue',sans-serif; font-size:32px; color:#f0f0f0; letter-spacing:0.5px; }
        .stat-value.green { color:#e8ff47; }
        .tabs { display:flex; gap:0; border-bottom:0.5px solid rgba(255,255,255,0.08); margin-bottom:24px; }
        .tab { font-size:13px; color:#888; padding:12px 20px; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-0.5px; font-family:'DM Sans',sans-serif; background:none; border-top:none; border-left:none; border-right:none; }
        .tab.active { color:#f0f0f0; border-bottom-color:#e8ff47; }
        .events-list { display:flex; flex-direction:column; gap:1px; background:rgba(255,255,255,0.08); border:0.5px solid rgba(255,255,255,0.08); border-radius:12px; overflow:hidden; margin-bottom:40px; }
        .event-row { background:#0a0a0b; padding:20px 24px; display:flex; align-items:center; gap:20px; transition:background 0.15s; }
        .event-row:hover { background:#16161a; }
        .event-name { font-size:15px; font-weight:500; color:#f0f0f0; margin-bottom:3px; }
        .event-date { font-size:12px; color:#888; }
        .event-info { flex:1; }
        .event-stat { text-align:right; min-width:80px; }
        .event-stat-value { font-size:15px; font-weight:500; color:#f0f0f0; }
        .event-stat-label { font-size:11px; color:#888; margin-top:2px; }
        .status-badge { font-size:11px; font-weight:500; padding:3px 10px; border-radius:100px; text-transform:uppercase; letter-spacing:0.5px; }
        .status-published { background:rgba(232,255,71,0.15); color:#e8ff47; border:0.5px solid rgba(232,255,71,0.3); }
        .status-draft { background:rgba(255,255,255,0.06); color:#888; border:0.5px solid rgba(255,255,255,0.14); }
        .row-actions { display:flex; gap:8px; }
        .action-btn { font-size:12px; color:#888; background:rgba(255,255,255,0.06); border:0.5px solid rgba(255,255,255,0.14); border-radius:6px; padding:6px 12px; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .action-btn:hover { color:#f0f0f0; border-color:rgba(255,255,255,0.28); }
        .empty { text-align:center; padding:60px 20px; color:#555; font-size:14px; }
        .loading { text-align:center; padding:60px 20px; color:#555; font-size:14px; }
        @media(max-width:680px){ .stats { grid-template-columns:repeat(2,1fr); } .event-stat { display:none; } }
      `}</style>

      <nav>
        <div className="wrap nav-inner">
          <div className="logo" onClick={() => window.location.href='/'}>PULSE</div>
          <div className="nav-right">
            <button className="back" onClick={() => window.location.href='/'}>← Back to events</button>
            <button className="create-btn" onClick={() => window.location.href='/host/create'}>+ Create event</button>
          </div>
        </div>
      </nav>

      <div className="wrap">
        <div className="page-header">
          <h1 className="page-title">Host Dashboard</h1>
          <p className="page-sub">Manage your events and track your sales</p>
        </div>

        <div className="stats">
          <div className="stat">
            <div className="stat-label">Total events</div>
            <div className="stat-value">{events.length}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Tickets sold</div>
            <div className="stat-value">{totalTickets}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Total revenue</div>
            <div className="stat-value green">${totalRevenue.toLocaleString()}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Published</div>
            <div className="stat-value">{events.filter(e => e.status === 'published').length}</div>
          </div>
        </div>

        <div className="tabs">
          <button className={`tab ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>My events</button>
          <button className={`tab ${activeTab === 'sales' ? 'active' : ''}`} onClick={() => setActiveTab('sales')}>Sales</button>
          <button className={`tab ${activeTab === 'payouts' ? 'active' : ''}`} onClick={() => setActiveTab('payouts')}>Payouts</button>
        </div>

        {activeTab === 'events' && (
          loading ? (
            <div className="loading">Loading your events...</div>
          ) : events.length === 0 ? (
            <div className="empty">
              No events yet. <span style={{color:'#e8ff47', cursor:'pointer'}} onClick={() => window.location.href='/host/create'}>Create your first event →</span>
            </div>
          ) : (
            <div className="events-list">
              {events.map(e => {
                const sold = e.ticket_tiers?.reduce((s: number, t: any) => s + t.quantity_sold, 0) ?? 0
                const revenue = e.ticket_tiers?.reduce((s: number, t: any) => s + (t.quantity_sold * t.price), 0) ?? 0
                const date = e.starts_at ? new Date(e.starts_at).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) : 'No date set'
                return (
                  <div key={e.id} className="event-row">
                    <div className="event-info">
                      <div className="event-name">{e.title}</div>
                      <div className="event-date">{date}</div>
                    </div>
                    <div className="event-stat">
                      <div className="event-stat-value">{sold}</div>
                      <div className="event-stat-label">tickets sold</div>
                    </div>
                    <div className="event-stat">
                      <div className="event-stat-value">${revenue.toLocaleString()}</div>
                      <div className="event-stat-label">revenue</div>
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

        {activeTab === 'sales' && <div className="empty">Sales breakdown coming soon</div>}
        {activeTab === 'payouts' && <div className="empty">Connect Stripe to view payouts</div>}
      </div>
    </>
  )
}