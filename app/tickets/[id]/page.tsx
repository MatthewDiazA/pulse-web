'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import Link from 'next/link'

// No-login ticket page: every ticket in one order, with its QR code.
// Linked from the ticket email and the post-checkout confirmation.

type OrderView = {
  id: string
  buyer_name: string | null
  buyer_email: string | null
  linked: boolean
  event: { id: string; title: string; starts_at: string | null; venue_name: string | null; address: string | null; city: string | null; state: string | null; cover_image_url: string | null } | null
  tickets: { id: string; qr_code: string; checked_in: boolean; label: string }[]
}

function when(iso: string | null): string {
  if (!iso) return 'Date TBA'
  const d = new Date(iso)
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
  const h = d.getUTCHours(), m = d.getUTCMinutes()
  const time = `${h % 12 || 12}${m ? `:${String(m).padStart(2, '0')}` : ''}${h >= 12 ? 'pm' : 'am'}`
  return `${day} · ${time}`
}

function Qr({ value, dim }: { value: string; dim: boolean }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    QRCode.toDataURL(value, { width: 520, margin: 1, color: { dark: '#000000', light: '#ffffff' } }).then(setSrc)
  }, [value])
  return src ? <img src={src} alt="Ticket QR code" className={`qr ${dim ? 'dim' : ''}`}/> : <div className="qr qr-empty"/>
}

export default function TicketsPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [order, setOrder] = useState<OrderView | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    fetch(`/api/orders/${id}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setOrder)
      .catch(() => setMissing(true))
  }, [id])

  const ev = order?.event
  const place = ev ? [ev.venue_name, [ev.address, ev.city].map(x => x?.trim()).filter(Boolean).join(', ')].filter(Boolean).join(' · ') : ''
  const count = order?.tickets.length ?? 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&family=Syne:wght@400;500;600;700&display=swap');
        *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        body{background:#000;color:#f0f0f0;font-family:'Syne',sans-serif;}
        nav{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:14px 20px;border-bottom:0.5px solid rgba(255,255,255,0.08);}
        .logo{grid-column:2;background:none;border:none;cursor:pointer;line-height:0;}
        .logo img{height:19px;width:auto;}
        .wrap{max-width:480px;margin:0 auto;padding:28px 20px 60px;}
        .head{display:flex;gap:16px;align-items:center;margin-bottom:26px;}
        .thumb{width:72px;height:90px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#111;box-shadow:0 0 0 1px rgba(255,255,255,0.08);}
        .eyebrow{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#5ec888;font-weight:700;margin-bottom:6px;}
        .title{font-family:'Barlow Condensed',sans-serif;font-size:34px;font-weight:900;text-transform:uppercase;line-height:0.92;color:#fff;margin-bottom:8px;}
        .meta{font-size:13px;color:rgba(255,255,255,0.55);line-height:1.5;}
        .ticket{background:#fff;color:#000;border-radius:16px;padding:22px 22px 18px;margin-bottom:14px;text-align:center;}
        .t-row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:14px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;}
        .t-row span:last-child{color:rgba(0,0,0,0.45);}
        .qr{width:100%;max-width:260px;aspect-ratio:1;display:block;margin:0 auto;image-rendering:pixelated;}
        .qr.dim{opacity:0.25;}
        .qr-empty{background:#f2f2f2;border-radius:8px;}
        .t-foot{margin-top:12px;font-size:11px;color:rgba(0,0,0,0.5);}
        .t-foot.used{color:#1a8f4c;font-weight:700;}
        .hint{font-size:12px;color:rgba(255,255,255,0.45);text-align:center;margin:6px 0 28px;line-height:1.6;}
        .save{border-top:1px solid rgba(255,255,255,0.09);padding-top:22px;}
        .save-t{font-size:15px;font-weight:600;color:#fff;margin-bottom:6px;}
        .save-d{font-size:13px;color:rgba(255,255,255,0.55);line-height:1.6;margin-bottom:16px;}
        .save-d b{color:#fff;font-weight:600;}
        .btn{display:inline-block;background:#fff;color:#000;border:none;border-radius:10px;padding:14px 22px;font-size:14px;font-weight:700;font-family:'Syne',sans-serif;text-decoration:none;cursor:pointer;}
        .link{color:#fff;font-size:13px;text-decoration:underline;text-decoration-color:rgba(255,255,255,0.3);text-underline-offset:3px;}
        .center{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;color:rgba(255,255,255,0.55);font-size:14px;}
        .spin{width:22px;height:22px;border:1px solid rgba(255,255,255,0.5);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <nav>
        <button className="logo" onClick={() => router.push('/')} aria-label="Pulse home"><img src="/pulse-word-tight.png" alt="pulse"/></button>
      </nav>

      {missing ? (
        <div className="center">
          <div>We couldn&apos;t find these tickets.</div>
          <Link className="link" href="/">Go home</Link>
        </div>
      ) : !order ? (
        <div className="center"><div className="spin"/></div>
      ) : (
        <div className="wrap">
          <div className="head">
            {ev?.cover_image_url && <img className="thumb" src={ev.cover_image_url} alt=""/>}
            <div>
              <div className="eyebrow">You&apos;re in</div>
              <div className="title">{ev?.title ?? 'Your tickets'}</div>
              <div className="meta">{when(ev?.starts_at ?? null)}{place && <><br/>{place}</>}</div>
            </div>
          </div>

          {order.tickets.map((t, i) => (
            <div key={t.id} className="ticket">
              <div className="t-row"><span>{t.label}</span><span>{count > 1 ? `${i + 1} of ${count}` : 'Admit one'}</span></div>
              <Qr value={t.qr_code} dim={t.checked_in}/>
              <div className={`t-foot ${t.checked_in ? 'used' : ''}`}>{t.checked_in ? 'Checked in' : 'Show this at the door'}</div>
            </div>
          ))}

          <p className="hint">
            {count > 1 ? 'Each code gets one person in. Screenshot them or send one to each friend.' : 'Screenshot this or keep the email — the code is all you need at the door.'}
          </p>

          {!order.linked && order.buyer_email && (
            <div className="save">
              <div className="save-t">Keep your tickets in one place</div>
              <div className="save-d">Create a free account with <b>{order.buyer_email}</b> and these tickets — and any you get later — will be waiting in it.</div>
              <a className="btn" href={`/signup?email=${encodeURIComponent(order.buyer_email)}`}>Create account</a>
            </div>
          )}
        </div>
      )}
    </>
  )
}
