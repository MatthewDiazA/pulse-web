'use client'
import React, { useEffect, useState } from 'react'
import { createClient } from '../../../lib/supabase/client'

const categoryLabels: Record<string, string> = {
  nightlife: 'Nightlife', concert: 'Concert', festival: 'Festival', other: 'Event',
}

export default function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params)
  const [event, setEvent] = useState<any>(null)
  const [tiers, setTiers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    const fetchEvent = async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('events')
        .select('*, host:profiles(full_name, username), ticket_tiers(*)')
        .eq('id', id).single()
      if (data) { setEvent(data); setTiers(data.ticket_tiers?.sort((a: any, b: any) => a.price - b.price) ?? []) }
      setLoading(false)
    }
    fetchEvent()
  }, [id])

  const tier = tiers.find(t => t.id === selectedTier)
  const subtotal = tier ? tier.price * quantity : 0
  const fee = tier?.price === 0 ? 0 : +(subtotal * 0.1).toFixed(2)
  const total = +(subtotal + fee).toFixed(2)
  const selectTier = (id: string) => { setSelectedTier(id); setQuantity(1) }

  const handleCheckout = async () => {
    if (!tier) return
    setCheckoutLoading(true)
    if (tier.price === 0) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const res = await fetch('/api/checkout/free', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: id, tier_id: tier.id, tier_name: tier.name, event_title: event.title, quantity, user_id: user?.id ?? null, buyer_email: user?.email ?? '', buyer_name: user?.user_metadata?.full_name ?? '' }),
      })
      const data = await res.json()
      if (data.success) { window.location.href = '/account?order=success' }
      else { alert('Something went wrong: ' + data.error); setCheckoutLoading(false) }
      return
    }
    const res = await fetch('/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_id: id, tier_id: tier.id, tier_name: tier.name, price: total, quantity, event_title: event.title }),
    })
    const data = await res.json()
    if (data.url) { window.location.href = data.url }
    else { alert('Something went wrong: ' + data.error); setCheckoutLoading(false) }
  }

  if (loading) return <div style={{background:'#000',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#665',fontFamily:'DM Sans,sans-serif'}}>Loading event...</div>
  if (!event) return <div style={{background:'#000',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:'#665',fontFamily:'DM Sans,sans-serif'}}>Event not found. <span style={{color:'#ffaa33',cursor:'pointer',marginLeft:'8px'}} onClick={() => window.location.href='/'}>← Back to events</span></div>

  const startDate = event.starts_at ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' }) : ''
  const startTime = event.starts_at ? new Date(event.starts_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true }) : ''
  const doorsTime = event.doors_at ? new Date(event.doors_at).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true }) : null
  const hostName = event.host?.full_name ?? event.host?.username ?? 'Unknown host'
  const initials = hostName.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase()

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Barlow+Condensed:wght@900&family=DM+Sans:wght@300;400;500&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;}
        body{background:#000;}
        .wrap{max-width:1100px;margin:0 auto;padding:0 40px;}
        nav{padding:14px 0;background:rgba(0,0,0,0.95);position:sticky;top:0;z-index:100;backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);position:relative;}
        nav::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#ff6600,#ffaa33,#ffc850,#ff6600,transparent);background-size:300% 100%;animation:navPulse 5s ease-in-out infinite;}
        @keyframes navPulse{0%{background-position:0% 50%;opacity:0.2}50%{background-position:100% 50%;opacity:1}100%{background-position:0% 50%;opacity:0.2}}
        .nav-inner{display:flex;align-items:center;justify-content:space-between;}
        .logo{font-family:'Nunito',sans-serif;font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#ffaa33;cursor:pointer;line-height:1;text-transform:lowercase;filter:drop-shadow(0 0 10px rgba(255,170,51,0.5));background:none;border:none;padding:0;}
        .back{font-size:13px;color:#554;background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:color 0.15s;display:inline-flex;align-items:center;gap:6px;}
        .back:hover{color:#f0f0f0;}
        .hero{width:100%;height:400px;background:#0d0800;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;}
        .hero-tag{position:absolute;top:20px;left:20px;font-size:11px;padding:4px 12px;border-radius:100px;background:rgba(255,170,51,0.15);color:#ffaa33;border:0.5px solid rgba(255,170,51,0.3);text-transform:uppercase;letter-spacing:0.5px;font-family:'DM Sans',sans-serif;}
        .hero-age{position:absolute;top:20px;right:20px;font-size:11px;padding:4px 12px;border-radius:100px;background:rgba(255,255,255,0.08);color:#f0f0f0;border:0.5px solid rgba(255,255,255,0.14);font-family:'DM Sans',sans-serif;}
        .content{display:grid;grid-template-columns:1fr 380px;gap:48px;padding:40px 0 80px;align-items:start;}
        @media(max-width:800px){.content{grid-template-columns:1fr;} .wrap{padding:0 20px;}}
        .event-date{font-size:13px;color:#ffaa33;letter-spacing:0.8px;text-transform:uppercase;font-weight:500;margin-bottom:12px;font-family:'DM Sans',sans-serif;}
        .event-title{font-family:'Barlow Condensed',sans-serif;font-size:64px;line-height:0.95;letter-spacing:1px;color:#f0f0f0;margin-bottom:16px;font-weight:900;text-transform:uppercase;}
        .host-row{display:flex;align-items:center;gap:10px;margin-bottom:32px;}
        .host-avatar{width:32px;height:32px;border-radius:50%;background:rgba(255,170,51,0.15);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:500;color:#ffaa33;font-family:'DM Sans',sans-serif;}
        .host-name{font-size:13px;color:#665;font-family:'DM Sans',sans-serif;}
        .section-title{font-size:11px;color:#554;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:14px;font-family:'DM Sans',sans-serif;}
        .description{font-size:15px;color:#776;line-height:1.75;font-weight:300;margin-bottom:40px;font-family:'DM Sans',sans-serif;}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(255,255,255,0.05);border:0.5px solid rgba(255,255,255,0.05);border-radius:10px;overflow:hidden;margin-bottom:40px;}
        .info-cell{background:#000;padding:18px 20px;}
        .info-label{font-size:11px;color:#443;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:5px;font-family:'DM Sans',sans-serif;}
        .info-value{font-size:14px;color:#f0f0f0;font-weight:500;font-family:'DM Sans',sans-serif;}
        .info-sub{font-size:12px;color:#665;margin-top:2px;font-family:'DM Sans',sans-serif;}
        .panel{background:#0d0800;border:0.5px solid rgba(255,255,255,0.08);border-radius:14px;overflow:hidden;position:sticky;top:80px;}
        .panel-header{padding:24px 24px 0;}
        .panel-title{font-family:'Barlow Condensed',sans-serif;font-size:22px;letter-spacing:0.5px;color:#f0f0f0;margin-bottom:4px;font-weight:900;}
        .panel-sub{font-size:13px;color:#665;margin-bottom:20px;font-family:'DM Sans',sans-serif;}
        .divider{height:0.5px;background:rgba(255,255,255,0.06);}
        .tiers{padding:20px 24px;}
        .tier{border:0.5px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px;margin-bottom:10px;cursor:pointer;transition:all 0.15s;}
        .tier:hover{border-color:rgba(255,255,255,0.18);}
        .tier.selected{border-color:#ffaa33;background:rgba(255,170,51,0.04);}
        .tier-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;}
        .tier-name{font-size:14px;font-weight:500;color:#f0f0f0;font-family:'DM Sans',sans-serif;}
        .tier-price{font-family:'Barlow Condensed',sans-serif;font-size:22px;color:#ffaa33;font-weight:900;}
        .tier-price.free{color:#ffc850;}
        .tier-avail{font-size:11px;color:#443;font-family:'DM Sans',sans-serif;}
        .tier-avail.low{color:#f59e0b;}
        .qty-row{display:flex;align-items:center;gap:12px;margin-top:12px;padding-top:12px;border-top:0.5px solid rgba(255,255,255,0.06);}
        .qty-label{font-size:12px;color:#665;flex:1;font-family:'DM Sans',sans-serif;}
        .qty-btn{width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.06);border:0.5px solid rgba(255,255,255,0.1);color:#f0f0f0;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.12s;}
        .qty-btn:hover{background:rgba(255,255,255,0.12);}
        .qty-btn:disabled{opacity:0.3;cursor:not-allowed;}
        .qty-num{font-size:15px;font-weight:500;color:#f0f0f0;min-width:20px;text-align:center;font-family:'DM Sans',sans-serif;}
        .summary{padding:0 24px 4px;}
        .summary-row{display:flex;justify-content:space-between;font-size:13px;color:#665;margin-bottom:8px;font-family:'DM Sans',sans-serif;}
        .summary-total{display:flex;justify-content:space-between;font-size:15px;font-weight:500;color:#f0f0f0;border-top:0.5px solid rgba(255,255,255,0.06);padding-top:12px;margin-top:4px;margin-bottom:20px;font-family:'DM Sans',sans-serif;}
        .cta{padding:0 24px 24px;}
        .buy-btn{width:100%;background:#ffaa33;color:#000;border:none;border-radius:100px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:'Nunito',sans-serif;box-shadow:0 0 16px rgba(255,170,51,0.25);transition:all 0.15s;}
        .buy-btn:active{transform:scale(0.98);}
        .buy-btn:disabled{background:#1a1000;color:#443;cursor:not-allowed;box-shadow:none;}
        .secure{text-align:center;font-size:11px;color:#443;margin-top:10px;font-family:'DM Sans',sans-serif;display:flex;align-items:center;justify-content:center;gap:4px;}
        .no-tiers{padding:24px;text-align:center;color:#443;font-size:14px;font-family:'DM Sans',sans-serif;}
      `}</style>

      <nav>
        <div className="wrap nav-inner">
          <button className="back" onClick={() => window.location.href='/'}>
            <i className="ti ti-arrow-left" style={{fontSize:'14px'}}/> Back to events
          </button>
          <button className="logo" onClick={() => window.location.href='/'}>pulse</button>
          <div style={{width:'120px'}}/>
        </div>
      </nav>

      <div className="hero">
        {event.cover_image_url
          ? <img src={event.cover_image_url} alt={event.title} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          : (
            <svg width="100%" height="100%" viewBox="0 0 1100 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
              <rect width="1100" height="400" fill="#0d0800"/>
              <circle cx="550" cy="200" r="150" fill="none" stroke="#ffaa33" strokeWidth="0.5" opacity="0.2"/>
              <circle cx="550" cy="200" r="220" fill="none" stroke="#ffaa33" strokeWidth="0.5" opacity="0.1"/>
              <circle cx="550" cy="200" r="50" fill="rgba(255,170,51,0.06)"/>
              <text x="550" y="220" textAnchor="middle" fontFamily="serif" fontSize="64" fill="#ffaa33" opacity="0.6">✦</text>
            </svg>
          )
        }
        <div className="hero-tag">{categoryLabels[event.category] ?? 'Event'}</div>
        {event.is_21_plus && <div className="hero-age">21+</div>}
      </div>

      <div className="wrap">
        <div className="content">
          <div>
            <p className="event-date">{startDate}{doorsTime ? ` · Doors ${doorsTime}` : ''}{startTime ? ` · ${startTime}` : ''}</p>
            <h1 className="event-title">{event.title}</h1>
            <div className="host-row">
              <div className="host-avatar">{initials}</div>
              <span className="host-name">Hosted by <strong style={{color:'#f0f0f0'}}>{hostName}</strong></span>
            </div>
            {event.description && (<><p className="section-title">About this event</p><p className="description">{event.description}</p></>)}
            <div className="info-grid">
              <div className="info-cell">
                <div className="info-label">Date</div>
                <div className="info-value">{startDate}</div>
                {doorsTime && <div className="info-sub">Doors open {doorsTime}</div>}
              </div>
              {event.venue_name && (
                <div className="info-cell">
                  <div className="info-label">Venue</div>
                  <div className="info-value">{event.venue_name}</div>
                  {event.address && <div className="info-sub">{event.address}, {event.city}</div>}
                </div>
              )}
              {event.dress_code && (<div className="info-cell"><div className="info-label">Dress code</div><div className="info-value">{event.dress_code}</div></div>)}
              {event.is_21_plus && (<div className="info-cell"><div className="info-label">Age requirement</div><div className="info-value">21+ with valid ID</div><div className="info-sub">Government-issued ID required</div></div>)}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">Get tickets</div>
              <div className="panel-sub">Select a ticket type below</div>
            </div>
            <div className="divider"/>
            {tiers.length === 0 ? (
              <div className="no-tiers">No tickets available yet</div>
            ) : (
              <div className="tiers">
                {tiers.map(t => {
                  const available = t.quantity - t.quantity_sold
                  const soldOut = available <= 0
                  return (
                    <div key={t.id} className={`tier ${selectedTier === t.id ? 'selected' : ''}`} onClick={() => !soldOut && selectTier(t.id)} style={soldOut ? {opacity:0.4,cursor:'not-allowed'} : {}}>
                      <div className="tier-top">
                        <div className="tier-name">{t.name}</div>
                        <div className={`tier-price ${t.price === 0 ? 'free' : ''}`}>{t.price === 0 ? 'Free' : `$${t.price}`}</div>
                      </div>
                      {t.description && <div style={{fontSize:'12px',color:'#665',marginBottom:'4px',fontFamily:'DM Sans,sans-serif'}}>{t.description}</div>}
                      <div className={`tier-avail ${available < 20 ? 'low' : ''}`}>{soldOut ? 'Sold out' : available < 20 ? `Only ${available} left` : `${available} available`}</div>
                      {selectedTier === t.id && (
                        <div className="qty-row" onClick={e => e.stopPropagation()}>
                          <span className="qty-label">Quantity</span>
                          <button className="qty-btn" disabled={quantity <= 1} onClick={() => setQuantity(q => q - 1)}>−</button>
                          <span className="qty-num">{quantity}</span>
                          <button className="qty-btn" disabled={quantity >= Math.min(t.max_per_order, available)} onClick={() => setQuantity(q => q + 1)}>+</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {tier && (
              <><div className="divider"/>
              <div className="summary">
                <div style={{height:'16px'}}/>
                <div className="summary-row"><span>{quantity}x {tier.name}</span><span>${subtotal.toFixed(2)}</span></div>
                {fee > 0 && <div className="summary-row"><span>Service fee</span><span>${fee.toFixed(2)}</span></div>}
                <div className="summary-total"><span>Total</span><span>{total === 0 ? 'Free' : `$${total.toFixed(2)}`}</span></div>
              </div></>
            )}
            <div className="cta">
              <button className="buy-btn" disabled={!tier || checkoutLoading} onClick={handleCheckout}>
                {checkoutLoading ? 'Processing...' : tier ? tier.price === 0 ? 'Reserve free ticket' : `Buy tickets · $${total.toFixed(2)}` : 'Select tickets'}
              </button>
              <p className="secure"><i className="ti ti-lock" style={{fontSize:'11px'}}/> Secure checkout · Powered by Stripe</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}