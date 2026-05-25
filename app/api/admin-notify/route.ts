// app/api/admin-notify/route.ts
// Called after successful checkout — emails the admin with buyer info + QR code
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const ADMIN_EMAIL = 'mad2288@columbia.edu'

export async function POST(request: Request) {
  try {
    const { buyer_email, buyer_name, event_title, event_date, venue, tier_name, qr_code } = await request.json()

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr_code)}`

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:Arial,sans-serif;color:#f0f0f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;padding:40px 20px;">
<tr><td>
  <div style="font-size:28px;font-weight:900;letter-spacing:4px;color:#ffaa33;margin-bottom:32px;">pulse · admin</div>
  <div style="background:#0d0800;border:1px solid rgba(255,170,51,0.2);border-radius:16px;padding:24px;margin-bottom:20px;">
    <div style="font-size:11px;letter-spacing:2px;color:#554;text-transform:uppercase;margin-bottom:16px;">New ticket sold</div>
    <div style="font-size:22px;font-weight:700;color:#fff;margin-bottom:4px;">${event_title}</div>
    <div style="font-size:13px;color:#888;margin-bottom:16px;">${tier_name} · ${event_date}${venue ? ` · ${venue}` : ''}</div>
    <div style="border-top:0.5px solid rgba(255,255,255,0.08);padding-top:16px;">
      <div style="font-size:13px;color:#aaa;margin-bottom:4px;">Buyer: <span style="color:#f0f0f0;">${buyer_name || 'Unknown'}</span></div>
      <div style="font-size:13px;color:#aaa;">Email: <span style="color:#ffaa33;">${buyer_email}</span></div>
    </div>
  </div>
  <div style="background:#0d0800;border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:24px;text-align:center;">
    <div style="font-size:11px;letter-spacing:2px;color:#554;text-transform:uppercase;margin-bottom:16px;">Their QR code</div>
    <div style="background:#fff;border-radius:10px;padding:12px;display:inline-block;margin-bottom:12px;">
      <img src="${qrUrl}" width="160" height="160" alt="QR" style="display:block;"/>
    </div>
    <div style="font-size:11px;color:#443;letter-spacing:1px;">Forward this email or use the blast tool to send their ticket</div>
  </div>
</td></tr>
</table>
</body>
</html>`

    await resend.emails.send({
      from: 'PULSE <tickets@pulsetickets.vip>',
      to: ADMIN_EMAIL,
      subject: `New ticket: ${buyer_name || buyer_email} → ${event_title}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Admin notify error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}