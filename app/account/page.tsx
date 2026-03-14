'use client'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase/client'

export default function AccountPage() {
  const [user, setUser] = useState<any>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [orderSuccess, setOrderSuccess] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('order') === 'success') setOrderSuccess(true)

    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      setUser(user)

      const { data } = await supabase
        .from('tickets')
        .select('*, event:events(title, starts_at, venue_name, cover_image_url), tier:ticket_tiers(name, price)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setTickets(data ?? [])
      setLoading(false)
    }

    fetchData()
  }, [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#0a0a0b; font-family:'DM Sans',sans-serif; color:#f0f0f0; }
        .wrap { max-width:800px; margin:0 auto; padding:0 40px 80px; }
        nav { border-bottom:0.5px solid rgba(255,255,255,0.08); padding:16px 40px; background:#0a0a0b; position:sticky; top:0; z-index:100; display:flex; align-items:center; justify-content:space-between; }
        .logo { font-family:'Bebas Neue',sans-serif; font-size:24px; letter-spacing:4px; color:#e8ff47; cursor:pointer; }
        .nav-right { display:flex; gap:12px; align-items:center; }
        .nav-btn { font-size:13px; color:#888; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .nav-btn:hover { color:#f0f0f0; }
        .page-title { font-family:'Bebas Neue',sans-serif; font-size:48px; letter-spacing:1px; padding:40px 0 8px; }
        .page-sub { font-size:14px; color:#888; margin-bottom:40px; }
        .success-banner { background:rgba(232,255,71,0.1); border:0.5px solid rgba(232,255,71,0.3); border-radius:10px; padding:16px 20px; margin-bottom:32px; display:flex; align-items:center; gap:12px; }
        .success-text { font-size:14px; color:#e8ff47; }
        .success-sub { font-size:12px; color:#888; margin-top:2px; }
        .section-title { font-size:11px; color:#888; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:16px; padding-bottom:8px; border-bottom:0.5px solid rgba(255,255,255,0.08); }
        .ticket-card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:12px; overflow:hidden; margin-bottom:12px; display:flex; }
        .ticket-left { width:6px; background:#e8ff47; flex-shrink:0; }
        .ticket-body { padding:20px 24px; flex:1; display:flex; align-items:center; gap:20px; }
        .ticket-info { flex:1; }
        .ticket-event { font-size:15px; font-weight:500; color:#f0f0f0; margin-bottom:4px; }
        .ticket-tier { font-size:13px; color:#888; margin-bottom:4px; }
        .ticket-date { font-size:12px; color:#555; }
        .ticket-qr { text-align:center; }
        .qr-box { width:60px; height:60px; background:rgba(255,255,255,0.06); border:0.5px solid rgba(255,255,255,0.14); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:28px; }
        .qr-label { font-size:10px; color:#555; margin-top:4px; }
        .ticket-price { font-family:'Bebas Neue',sans-serif; font-size:20px; color:#e8ff47; text-align:right; min-width:60px; }
        .empty { text-align:center; padding:60px 20px; color:#555; font-size:14px; }
        .empty a { color:#e8ff47; text-decoration:none; }
        .loading { text-align:center; padding:60px 20px; color:#555; font-size:14px; }
        .user-card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:12px; padding:20px 24px; margin-bottom:32px; display:flex; align-items:center; gap:16px; }
        .user-avatar { width:48px; height:48px; border-radius:50%; background:rgba(232,255,71,0.2); display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:500; color:#e8ff47; flex-shrink:0; }
        .user-name { font-size:15px; font-weight:500; color:#f0f0f0; }
        .user-email { font-size:13px; color:#888; margin-top:2px; }
        .signout-btn { margin-left:auto; font-size:12px; color:#888; background:rgba(255,255,255,0.06); border:0.5px solid rgba(255,255,255,0.14); border-radius:6px; padding:7px 14px; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .signout-btn:hover { color:#f0f0f0; }
      `}</style>

      <nav>
        <div className="logo" onClick={() => window.location.href='/'}>PULSE</div>
        <div className="nav-right">
          <button className="nav-btn" onClick={() => window.location.href='/'}>← Discover</button>
          <button className="nav-btn" onClick={() => window.location.href='/host'}>Host dashboard</button>
        </div>
      </nav>

      <div className="wrap">
        <h1 className="page-title">My account</h1>
        <p className="page-sub">Your tickets and account details</p>

        {orderSuccess && (
          <div className="success-banner">
            <div style={{fontSize:'24px'}}>🎟</div>
            <div>
              <div className="success-text">Payment successful! You're on the list.</div>
              <div className="success-sub">Your tickets have been sent to your email.</div>
            </div>
          </div>
        )}

        {user && (
          <div className="user-card">
            <div className="user-avatar">
              {(user.user_metadata?.full_name ?? user.email ?? 'U').slice(0,2).toUpperCase()}
            </div>
            <div>
              <div className="user-name">{user.user_metadata?.full_name ?? 'No name set'}</div>
              <div className="user-email">{user.email}</div>
            </div>
            <button className="signout-btn" onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              window.location.href = '/'
            }}>Sign out</button>
          </div>
        )}

        <div className="section-title">My tickets</div>

        {loading ? (
          <div className="loading">Loading your tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="empty">
            No tickets yet. <a href="/">Find an event →</a>
          </div>
        ) : (
          tickets.map(ticket => {
            const date = ticket.event?.starts_at
              ? new Date(ticket.event.starts_at).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })
              : 'Date TBD'
            return (
              <div key={ticket.id} className="ticket-card">
                <div className="ticket-left"/>
                <div className="ticket-body">
                  <div className="ticket-info">
                    <div className="ticket-event">{ticket.event?.title ?? 'Event'}</div>
                    <div className="ticket-tier">{ticket.tier?.name ?? 'Ticket'}</div>
                    <div className="ticket-date">{date} · {ticket.event?.venue_name ?? ''}</div>
                  </div>
                  <div className="ticket-qr">
                    <div className="qr-box">🎫</div>
                    <div className="qr-label">Show at door</div>
                  </div>
                  <div className="ticket-price">${ticket.tier?.price ?? 0}</div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </>
  )
}