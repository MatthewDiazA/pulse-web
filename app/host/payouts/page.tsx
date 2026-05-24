'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const COLORS = { primary: '#ffaa33', accent: '#ff6600', bg: '#000' } as const

function fmt(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  return `${d}d ago`
}

export default function PayoutsPage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      try {
        const res = await fetch(`/api/host/payouts?userId=${user.id}`)
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        setData(json)
      } catch (e: any) {
        setError(e.message)
      }
      setLoading(false)
    }
    load()
  }, [router])

  const totalRevenue = data?.orders?.reduce((s: number, o: any) => s + (o.amount || 0), 0) ?? 0
  const platformFee = totalRevenue * 0.10
  const netRevenue = totalRevenue - platformFee

  return (
    <>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css"/>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Syne:wght@400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:#000;color:#f0f0f0;font-family:'Syne',sans-serif;}

        .acid{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;}
        .acid::before{content:'';position:absolute;width:60vmax;height:60vmax;border-radius:50%;background:radial-gradient(circle,rgba(255,102,0,0.08),transparent 70%);bottom:-10vmax;left:-10vmax;animation:acidA 20s ease-in-out infinite alternate;mix-blend-mode:screen;filter:blur(50px);}
        .acid::after{content:'';position:absolute;width:50vmax;height:50vmax;border-radius:50%;background:radial-gradient(circle,rgba(192,26,111,0.06),transparent 65%);top:20%;right:-10vmax;animation:acidB 24s ease-in-out infinite alternate;mix-blend-mode:screen;filter:blur(55px);}
        @keyframes acidA{0%{transform:translate(0,0)}100%{transform:translate(8vw,-6vh)}}
        @keyframes acidB{0%{transform:translate(0,0)}100%{transform:translate(-6vw,8vh)}}

        nav{padding:14px 24px;background:rgba(0,0,0,0.8);position:sticky;top:0;z-index:100;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(24px);border-bottom:0.5px solid rgba(255,255,255,0.05);}
        .logo{background:none;border:none;padding:0;cursor:pointer;line-height:0;}
        .logo-img{height:22px;width:auto;filter:drop-shadow(0 0 10px rgba(255,170,51,0.4));}
        .nav-back{background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:13px;font-family:'Syne',sans-serif;display:inline-flex;align-items:center;gap:5px;transition:color 0.15s;}
        .nav-back:hover{color:#f0f0f0;}

        .wrap{max-width:900px;margin:0 auto;padding:40px 24px 100px;position:relative;z-index:1;}
        .page-label{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:3px;text-transform:uppercase;margin-bottom:32px;}

        .stats-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:32px;}
        @media(min-width:600px){.stats-grid{grid-template-columns:repeat(4,1fr);}}
        .stat-card{background:rgba(255,255,255,0.03);border:0.5px solid rgba(255,255,255,0.08);border-radius:14px;padding:20px;}
        .stat-label{font-size:10px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;}
        .stat-value{font-family:'Barlow Condensed',sans-serif;font-size:32px;font-weight:900;color:#fff;line-height:1;}
        .stat-value.green{color:#4ade80;}
        .stat-value.amber{color:#ffaa33;}
        .stat-sub{font-size:11px;color:rgba(255,255,255,0.25);margin-top:4px;}

        .section{margin-bottom:32px;}
        .section-title{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:rgba(255,255,255,0.3);letter-spacing:3px;text-transform:uppercase;margin-bottom:16px;}

        .payout-row{display:flex;align-items:center;gap:14px;padding:14px 16px;background:rgba(255,255,255,0.02);border:0.5px solid rgba(255,255,255,0.06);border-radius:10px;margin-bottom:8px;}
        .payout-icon{width:36px;height:36px;border-radius:10px;background:rgba(255,170,51,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .payout-info{flex:1;min-width:0;}
        .payout-amount{font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;color:#fff;}
        .payout-date{font-size:12px;color:rgba(255,255,255,0.35);margin-top:1px;}
        .payout-status{font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 10px;border-radius:100px;}
        .status-paid{background:rgba(74,222,128,0.1);color:#4ade80;border:0.5px solid rgba(74,222,128,0.2);}
        .status-in_transit{background:rgba(255,170,51,0.1);color:#ffaa33;border:0.5px solid rgba(255,170,51,0.2);}
        .status-pending{background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.4);border:0.5px solid rgba(255,255,255,0.1);}

        .order-row{display:flex;align-items:center;gap:14px;padding:12px 16px;background:rgba(255,255,255,0.02);border:0.5px solid rgba(255,255,255,0.06);border-radius:10px;margin-bottom:6px;}
        .order-info{flex:1;min-width:0;}
        .order-event{font-size:14px;font-weight:600;color:#f0f0f0;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .order-buyer{font-size:12px;color:rgba(255,255,255,0.35);}
        .order-right{text-align:right;flex-shrink:0;}
        .order-amount{font-family:'Barlow Condensed',sans-serif;font-size:16px;font-weight:900;color:#ffaa33;}
        .order-time{font-size:11px;color:rgba(255,255,255,0.25);margin-top:2px;}

        .empty-state{text-align:center;padding:48px 20px;color:rgba(255,255,255,0.2);font-size:14px;}
        .error-state{background:rgba(255,80,80,0.08);border:0.5px solid rgba(255,80,80,0.2);border-radius:12px;padding:20px;color:#ff8888;font-size:14px;text-align:center;}
        .spinner{width:28px;height:28px;border:2px solid rgba(255,170,51,0.2);border-top-color:#ffaa33;border-radius:50%;animation:spin 0.8s linear infinite;margin:80px auto;}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:680px){.wrap{padding:32px 20px 80px;}}
      `}</style>

      <div className="acid" aria-hidden="true"/>

      <nav>
        <button className="nav-back" onClick={() => router.push('/host')}>
          <i className="ti ti-arrow-left" style={{fontSize:'14px'}} aria-hidden="true"/>
          Dashboard
        </button>
        <button className="logo" onClick={() => router.push('/')}>
          <img src="/pulse-word-tight.png" alt="pulse" className="logo-img"/>
        </button>
        <div style={{width:'60px'}}/>
      </nav>

      <div className="wrap">
        <div className="page-label">Payouts</div>

        {loading && <div className="spinner"/>}
        {error && <div className="error-state">Could not load payout data: {error}</div>}

        {data && !loading && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Available</div>
                <div className="stat-value green">{fmt(data.available)}</div>
                <div className="stat-sub">Ready to pay out</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pending</div>
                <div className="stat-value">{fmt(data.pending)}</div>
                <div className="stat-sub">Processing (2–7 days)</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total revenue</div>
                <div className="stat-value amber">${totalRevenue.toLocaleString('en-US', {minimumFractionDigits:2})}</div>
                <div className="stat-sub">All orders</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Your net</div>
                <div className="stat-value">${netRevenue.toLocaleString('en-US', {minimumFractionDigits:2})}</div>
                <div className="stat-sub">After 10% platform fee</div>
              </div>
            </div>

            <div className="section">
              <div className="section-title">Recent Payouts</div>
              {data.payouts.length === 0 ? (
                <div className="empty-state">No payouts yet</div>
              ) : data.payouts.map((p: any) => (
                <div key={p.id} className="payout-row">
                  <div className="payout-icon">
                    <i className="ti ti-building-bank" style={{fontSize:'16px',color:'#ffaa33'}} aria-hidden="true"/>
                  </div>
                  <div className="payout-info">
                    <div className="payout-amount">{fmt(p.amount)}</div>
                    <div className="payout-date">
                      {p.status === 'paid' ? `Arrived ${fmtDate(p.arrival_date)}` : `Expected ${fmtDate(p.arrival_date)}`}
                    </div>
                  </div>
                  <span className={`payout-status status-${p.status}`}>{p.status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>

            <div className="section">
              <div className="section-title">Recent Orders</div>
              {data.orders.length === 0 ? (
                <div className="empty-state">No orders yet</div>
              ) : data.orders.map((o: any) => (
                <div key={o.id} className="order-row">
                  <div className="order-info">
                    <div className="order-event">{o.event}</div>
                    <div className="order-buyer">{o.buyer || 'Guest'}</div>
                  </div>
                  <div className="order-right">
                    <div className="order-amount">${o.amount?.toFixed(2) ?? '0.00'}</div>
                    <div className="order-time">{timeAgo(o.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}