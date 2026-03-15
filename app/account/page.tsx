'use client'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { createClient } from '../lib/supabase/client'
function QRTicket({ code }: { code: string }) {
  const [dataUrl, setDataUrl] = useState('')

  useEffect(() => {
    QRCode.toDataURL(code, {
      width: 80,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    }).then(setDataUrl)
  }, [code])

  if (!dataUrl) return <div className="qr-box">🎫</div>

  return (
    <div style={{textAlign:'center'}}>
      <img src={dataUrl} alt="QR Code" style={{width:'60px', height:'60px', borderRadius:'6px'}}/>
      <div className="qr-label">Show at door</div>
    </div>
  )
}
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

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'there'
  const initials = (user?.user_metadata?.full_name ?? user?.email ?? 'U').slice(0,2).toUpperCase()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@900&family=DM+Sans:wght@300;400;500&display=swap');
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#0a0a0b; font-family:'DM Sans',sans-serif; color:#f0f0f0; }
        .wrap { max-width:800px; margin:0 auto; padding:0 40px 80px; }
        nav { border-bottom:0.5px solid rgba(255,255,255,0.08); padding:16px 40px; background:#0a0a0b; position:sticky; top:0; z-index:100; display:flex; align-items:center; justify-content:space-between; }
        .logo { font-family:'Anton',sans-serif; font-size:42px; letter-spacing:1px; color:#e8ff47; cursor:pointer; line-height:1; text-transform:lowercase; }
        .nav-right { display:flex; gap:12px; align-items:center; }
        .nav-btn { font-size:13px; color:#888; background:none; border:none; cursor:pointer; font-family:'DM Sans',sans-serif; text-decoration:none; }
        .nav-btn:hover { color:#f0f0f0; }

        .hero-section { padding:52px 0 40px; border-bottom:0.5px solid rgba(255,255,255,0.08); margin-bottom:40px; }
        .greeting { font-family:'Barlow Condensed',sans-serif; font-size:72px; line-height:0.95; font-weight:900; text-transform:uppercase; margin-bottom:8px; }
        .greeting span { color:#e8ff47; text-shadow:0 0 8px rgba(232,255,71,0.5), 0 0 16px rgba(232,255,71,0.25); }
        .greeting-sub { font-size:15px; color:#888; font-weight:300; }

        .quick-actions { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:40px; }
        .action-card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:12px; padding:20px 24px; cursor:pointer; transition:all 0.15s; text-decoration:none; display:block; }
        .action-card:hover { border-color:rgba(255,255,255,0.28); background:#1c1c21; }
        .action-card.accent { border-color:rgba(232,255,71,0.3); background:rgba(232,255,71,0.05); }
        .action-card.accent:hover { background:rgba(232,255,71,0.1); }
        .action-icon { font-size:24px; margin-bottom:10px; }
        .action-title { font-size:15px; font-weight:500; color:#f0f0f0; margin-bottom:4px; }
        .action-sub { font-size:13px; color:#888; }
        .action-card.accent .action-title { color:#e8ff47; }

        .user-card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:12px; padding:20px 24px; margin-bottom:32px; display:flex; align-items:center; gap:16px; }
        .user-avatar { width:56px; height:56px; border-radius:50%; background:rgba(232,255,71,0.15); border:1.5px solid rgba(232,255,71,0.4); display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:500; color:#e8ff47; flex-shrink:0; text-shadow:0 0 8px rgba(232,255,71,0.5); }
        .user-name { font-size:16px; font-weight:500; color:#f0f0f0; }
        .user-email { font-size:13px; color:#888; margin-top:2px; }
        .signout-btn { margin-left:auto; font-size:12px; color:#888; background:rgba(255,255,255,0.06); border:0.5px solid rgba(255,255,255,0.14); border-radius:6px; padding:7px 14px; cursor:pointer; font-family:'DM Sans',sans-serif; }
        .signout-btn:hover { color:#e24b4a; border-color:rgba(226,75,74,0.3); }

        .section-title { font-size:11px; color:#888; letter-spacing:0.8px; text-transform:uppercase; margin-bottom:16px; padding-bottom:8px; border-bottom:0.5px solid rgba(255,255,255,0.08); }

        .ticket-card { background:#16161a; border:0.5px solid rgba(255,255,255,0.14); border-radius:12px; overflow:hidden; margin-bottom:12px; display:flex; transition:border-color 0.15s; }
        .ticket-card:hover { border-color:rgba(255,255,255,0.28); }
        .ticket-left { width:4px; background:#e8ff47; flex-shrink:0; }
        .ticket-body { padding:20px 24px; flex:1; display:flex; align-items:center; gap:20px; }
        .ticket-info { flex:1; }
        .ticket-event { font-size:16px; font-weight:500; color:#f0f0f0; margin-bottom:4px; }
        .ticket-tier { font-size:13px; color:#888; margin-bottom:4px; }
        .ticket-date { font-size:12px; color:#555; }
        .ticket-qr { text-align:center; }
        .qr-box { width:52px; height:52px; background:rgba(232,255,71,0.08); border:0.5px solid rgba(232,255,71,0.2); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:24px; }
        .qr-label { font-size:10px; color:#555; margin-top:4px; }
        .ticket-price { font-family:'Barlow Condensed',sans-serif; font-size:24px; color:#e8ff47; font-weight:900; text-align:right; min-width:60px; }

        .empty-state { text-align:center; padding:60px 20px; }
        .empty-icon { font-size:48px; margin-bottom:16px; }
        .empty-title { font-family:'Barlow Condensed',sans-serif; font-size:28px; font-weight:900; color:#f0f0f0; margin-bottom:8px; }
        .empty-sub { font-size:14px; color:#555; margin-bottom:24px; }
        .empty-btn { background:#e8ff47; color:#0a0a0b; font-size:14px; font-weight:500; padding:12px 28px; border-radius:8px; text-decoration:none; display:inline-block; font-family:'DM Sans',sans-serif; }

        .success-banner { background:rgba(232,255,71,0.08); border:0.5px solid rgba(232,255,71,0.3); border-radius:10px; padding:16px 20px; margin-bottom:32px; display:flex; align-items:center; gap:12px; }
        .success-text { font-size:14px; color:#e8ff47; font-weight:500; }
        .success-sub { font-size:12px; color:#888; margin-top:2px; }

        @media(max-width:680px){
          .wrap { padding:0 20px 60px; }
          .greeting { font-size:52px; }
          .quick-actions { grid-template-columns:1fr; }
          nav { padding:16px 20px; }
        }
      `}</style>

      <nav>
        <div className="logo" onClick={() => window.location.href='/'}>pulse</div>
        <div className="nav-right">
          <a href="/" className="nav-btn">← Discover</a>
          <a href="/host" className="nav-btn" style={{background:'rgba(232,255,71,0.1)', color:'#e8ff47', padding:'7px 14px', borderRadius:'6px', border:'0.5px solid rgba(232,255,71,0.3)'}}>Host dashboard</a>
        </div>
      </nav>

      <div className="wrap">

        {orderSuccess && (
          <div className="success-banner" style={{marginTop:'32px'}}>
            <div style={{fontSize:'24px'}}>🎟</div>
            <div>
              <div className="success-text">Payment successful! You're on the list.</div>
              <div className="success-sub">Your tickets have been sent to your email.</div>
            </div>
          </div>
        )}

        <div className="hero-section">
          <h1 className="greeting">Hey, <span>{firstName}.</span></h1>
          <p className="greeting-sub">Welcome to your PULSE account — your tickets and events live here.</p>
        </div>

        <div className="quick-actions">
          <a href="/" className="action-card">
            <div className="action-icon">🎵</div>
            <div className="action-title">Find events</div>
            <div className="action-sub">Browse parties & concerts near you</div>
          </a>
          <a href="/host/create" className="action-card accent">
            <div className="action-icon">✦</div>
            <div className="action-title">Host an event</div>
            <div className="action-sub">Create and sell tickets in minutes</div>
          </a>
        </div>

        {user && (
          <div className="user-card">
            <div className="user-avatar">{initials}</div>
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
          <div style={{textAlign:'center', padding:'40px', color:'#555', fontSize:'14px'}}>Loading your tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎫</div>
            <div className="empty-title">No tickets yet</div>
            <div className="empty-sub">When you buy tickets they'll show up here</div>
            <a href="/" className="empty-btn">Browse events</a>
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
                    <QRTicket code={ticket.qr_code}/>
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