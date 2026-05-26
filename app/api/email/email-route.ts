import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { to, event_title, event_date, venue, tier_name, qr_code, buyer_name, custom_html } = await request.json()

    // If custom_html provided (e.g. multi-ticket blast), use it directly
    if (custom_html) {
      await resend.emails.send({
        from: 'PULSE <tickets@pulsetickets.vip>',
        to,
        subject: `Your ticket to ${event_title}`,
        html: custom_html,
      })
      return NextResponse.json({ success: true })
    }

    const venueRow = venue
      ? `<tr><td style="font-size:13px;color:#888;padding:6px 0;">Venue</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${venue}</td></tr>`
      : ''
    const venueLine = venue ? ` · ${venue}` : ''
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(qr_code)}&bgcolor=ffffff&color=000000&margin=10`
    const logoUrl = `https://pulsetx.vercel.app/pulse-word-tight.png`
    const greeting = buyer_name ? `Hey ${buyer_name.split(' ')[0]},` : "You're in."

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:Arial,Helvetica,sans-serif;color:#f0f0f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;">
<tr><td align="center" style="padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

  <!-- Logo -->
  <tr><td style="padding-bottom:36px;">
    <img src="${logoUrl}" alt="PULSE" width="80" height="auto" style="display:block;"/>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding-bottom:28px;">
    <div style="font-size:15px;color:rgba(255,255,255,0.5);margin-bottom:6px;">${greeting}</div>
    <div style="font-size:28px;font-weight:900;color:#ffffff;text-transform:uppercase;line-height:1;letter-spacing:-0.5px;">${event_title}</div>
    <div style="font-size:14px;color:rgba(255,170,51,0.8);margin-top:8px;">${event_date}${venueLine}</div>
  </td></tr>

  <!-- Ticket card -->
  <tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0800;border-radius:16px;overflow:hidden;border:1px solid rgba(255,170,51,0.2);">
      <!-- Top stripe -->
      <tr><td style="height:3px;background:linear-gradient(90deg,#ff6600,#ffaa33,#ffc850);font-size:0;line-height:0;">&nbsp;</td></tr>
      <!-- Ticket info -->
      <tr><td style="padding:24px 28px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:4px;">Ticket type</div>
              <div style="font-size:18px;font-weight:700;color:#ffffff;">${tier_name}</div>
            </td>
            <td align="right">
              <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:4px;">Date</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.7);">${event_date}</div>
            </td>
          </tr>
        </table>
      </td></tr>
      <!-- Divider -->
      <tr><td style="padding:20px 28px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="border-top:1px dashed rgba(255,255,255,0.1);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
        </table>
      </td></tr>
      <!-- QR code -->
      <tr><td style="padding:24px 28px 28px;text-align:center;">
        <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.3);text-transform:uppercase;margin-bottom:16px;">Your entry code</div>
        <div style="background:#ffffff;border-radius:12px;padding:14px;display:inline-block;">
          <img src="${qrUrl}" width="200" height="200" alt="QR Code" style="display:block;"/>
        </div>
        <div style="margin-top:12px;font-size:11px;color:rgba(255,255,255,0.3);letter-spacing:1.5px;text-transform:uppercase;">Show this at the door</div>
      </td></tr>
    </table>
  </td></tr>

  <!-- Event details -->
  <tr><td style="padding-bottom:32px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0800;border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.25);text-transform:uppercase;margin-bottom:14px;">Event details</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#888;padding:5px 0;width:40%;">Event</td>
            <td style="font-size:13px;color:#f0f0f0;text-align:right;padding:5px 0;">${event_title}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#888;padding:5px 0;">Ticket</td>
            <td style="font-size:13px;color:#f0f0f0;text-align:right;padding:5px 0;">${tier_name}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#888;padding:5px 0;">Date</td>
            <td style="font-size:13px;color:#f0f0f0;text-align:right;padding:5px 0;">${event_date}</td>
          </tr>
          ${venueRow}
        </table>
      </td></tr>
    </table>
  </td></tr>

  <!-- Footer -->
  <tr><td style="text-align:center;padding-bottom:40px;">
    <div style="font-size:12px;color:rgba(255,255,255,0.2);margin-bottom:4px;">Powered by</div>
    <img src="${logoUrl}" alt="PULSE" width="48" height="auto" style="display:inline-block;opacity:0.4;"/>
    <div style="font-size:11px;color:rgba(255,255,255,0.15);margin-top:12px;">pulsetickets.vip</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`

    await resend.emails.send({
      from: 'PULSE <tickets@pulsetickets.vip>',
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