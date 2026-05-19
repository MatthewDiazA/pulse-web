import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { to, event_title, event_date, venue, tier_name, qr_code } = await request.json()

    const venueRow = venue
      ? `<tr><td style="font-size:13px;color:#888;padding:6px 0;">Venue</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${venue}</td></tr>`
      : ''
    const venueLine = venue ? ` · ${venue}` : ''
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr_code)}`

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;font-family:Arial,sans-serif;color:#f0f0f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:40px 20px;">
<tr><td>
<div style="font-size:32px;font-weight:900;letter-spacing:4px;color:#ffaa33;margin-bottom:40px;">pulse</div>
<div style="background:#0d0800;border:1px solid rgba(255,170,51,0.2);border-radius:20px;overflow:hidden;margin-bottom:32px;">
  <div style="height:4px;background:linear-gradient(90deg,#ff6600,#ffaa33,#ffc850);"></div>
  <div style="padding:32px;text-align:center;">
    <div style="font-size:12px;letter-spacing:3px;color:#555;text-transform:uppercase;margin-bottom:12px;">You're on the list</div>
    <div style="font-size:36px;font-weight:900;color:#f0f0f0;text-transform:uppercase;line-height:1;margin-bottom:8px;">${event_title}</div>
    <div style="font-size:14px;color:#888;margin-bottom:4px;">${tier_name}</div>
    <div style="font-size:13px;color:#555;">${event_date}${venueLine}</div>
  </div>
  <div style="padding:0 32px 32px;text-align:center;">
    <div style="background:#ffffff;border-radius:12px;padding:16px;display:inline-block;">
      <img src="${qrUrl}" width="200" height="200" alt="QR Code" style="display:block;"/>
    </div>
    <div style="margin-top:12px;font-size:11px;color:#555;letter-spacing:1px;text-transform:uppercase;">Show this at the door</div>
  </div>
</div>
<div style="background:#0d0800;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;margin-bottom:32px;">
  <div style="font-size:11px;color:#555;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;">Event details</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="font-size:13px;color:#888;padding:6px 0;">Event</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${event_title}</td></tr>
    <tr><td style="font-size:13px;color:#888;padding:6px 0;">Ticket type</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${tier_name}</td></tr>
    <tr><td style="font-size:13px;color:#888;padding:6px 0;">Date</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${event_date}</td></tr>
    ${venueRow}
  </table>
</div>
<div style="text-align:center;font-size:12px;color:#555;">
  <div style="margin-bottom:8px;">Powered by <span style="color:#ffaa33;">pulse</span></div>
</div>
</td></tr>
</table>
</body>
</html>`

    await resend.emails.send({
      from: 'PULSE <onboarding@resend.dev>',
      to,
      subject: `Your ticket to ${event_title}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}