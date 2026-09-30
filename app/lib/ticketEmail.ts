// Canonical ticket email (QR codes + details). Used by /api/email and server-side senders.

export function buildTicketEmail({ buyer_name, event_title, event_date, venue, tickets, order_url, account_email }: {
  buyer_name?: string
  order_url?: string     // no-login page with every ticket in the order
  account_email?: string // guest checkout: nudge them to sign up with this email
  event_title: string
  event_date: string
  venue?: string
  tickets: { qr_code: string; tier_name: string }[]
}): string {
  const greeting = buyer_name ? `Hey ${buyer_name.split(' ')[0]},` : "You're in."
  const venueLine = venue ? ` · ${venue}` : ''
  const count = tickets.length

  const qrBlocks = tickets.map((t, i) => {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(t.qr_code)}&bgcolor=ffffff&color=000000&margin=10`
    return `
      <tr><td style="padding:24px 28px ${i === count - 1 ? '28px' : '0'};text-align:center;">
        ${count > 1 ? `<div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.25);text-transform:uppercase;margin-bottom:12px;">Ticket ${i + 1} of ${count} · ${t.tier_name}</div>` : `<div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.25);text-transform:uppercase;margin-bottom:12px;">Your entry code</div>`}
        <div style="background:#ffffff;border-radius:12px;padding:14px;display:inline-block;">
          <img src="${qrUrl}" width="200" height="200" alt="QR Code" style="display:block;"/>
        </div>
        ${count <= 1 ? `<div style="margin-top:12px;font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:1.5px;text-transform:uppercase;">Show this at the door</div>` : ''}
      </td></tr>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000000;font-family:Arial,Helvetica,sans-serif;color:#f0f0f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#000000;">
<tr><td align="center" style="padding:40px 20px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">

  <!-- Logo -->
  <tr><td style="padding-bottom:32px;">
    <img src="https://cdtnoviclbwyvdiuazni.supabase.co/storage/v1/object/sign/assets/pulse-word-tight.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV8wMTFkMzlmOS1lMjNjLTQwNmItYTQ0Mi03ZWZhYTc1YzM5NmMiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvcHVsc2Utd29yZC10aWdodC5wbmciLCJpYXQiOjE3Nzk4MzMxMzMsImV4cCI6NDkzMzQzMzEzM30.DohNuBCJon82dfN7y4aBpRKhr83pBSmCKsPktVipIOo" alt="PULSE" width="100" height="auto" style="display:block;"/>
  </td></tr>

  <!-- Greeting -->
  <tr><td style="padding-bottom:24px;">
    <div style="font-size:15px;color:rgba(255,255,255,0.45);margin-bottom:8px;">${greeting}</div>
    <div style="font-size:28px;font-weight:900;color:#ffffff;text-transform:uppercase;line-height:1;letter-spacing:-0.5px;">${event_title}</div>
    <div style="font-size:14px;color:rgba(255,170,51,0.8);margin-top:10px;">${event_date}${venueLine}</div>
    ${count > 1 ? `<div style="font-size:13px;color:rgba(255,255,255,0.35);margin-top:4px;">${count} tickets</div>` : ''}
  </td></tr>

  <!-- Ticket card -->
  <tr><td style="padding-bottom:24px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0800;border-radius:16px;overflow:hidden;border:1px solid rgba(255,170,51,0.15);">
      <tr><td style="height:3px;background:linear-gradient(90deg,#ff6600,#ffaa33,#ffc850);font-size:0;line-height:0;">&nbsp;</td></tr>

      ${count <= 1 ? `
      <!-- Single ticket info row -->
      <tr><td style="padding:24px 28px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.25);text-transform:uppercase;margin-bottom:4px;">Ticket</div>
              <div style="font-size:18px;font-weight:700;color:#ffffff;">${tickets[0]?.tier_name ?? 'GA'}</div>
            </td>
            <td align="right">
              <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.25);text-transform:uppercase;margin-bottom:4px;">Date</div>
              <div style="font-size:14px;color:rgba(255,255,255,0.6);">${event_date}</div>
            </td>
          </tr>
        </table>
      </td></tr>
      <!-- Dashed divider -->
      <tr><td style="padding:20px 28px 0;">
        <div style="border-top:1px dashed rgba(255,255,255,0.08);"></div>
      </td></tr>` : ''}

      <!-- QR codes -->
      ${qrBlocks}

      ${count > 1 ? `<tr><td style="padding:0 28px 24px;text-align:center;"><div style="font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:1.5px;text-transform:uppercase;">Show each code at the door</div></td></tr>` : ''}
    </table>
  </td></tr>

  ${order_url ? `
  <!-- View tickets -->
  <tr><td style="padding-bottom:24px;text-align:center;">
    <a href="${order_url}" style="display:inline-block;background:#ffffff;color:#000000;text-decoration:none;font-size:15px;font-weight:700;padding:14px 30px;border-radius:100px;">View your tickets</a>
  </td></tr>` : ''}

  <!-- Event details -->
  <tr><td style="padding-bottom:28px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0800;border-radius:12px;border:1px solid rgba(255,255,255,0.05);">
      <tr><td style="padding:20px 24px;">
        <div style="font-size:10px;letter-spacing:2px;color:rgba(255,255,255,0.2);text-transform:uppercase;margin-bottom:12px;">Event details</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="font-size:13px;color:rgba(255,255,255,0.4);padding:4px 0;">Event</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:4px 0;">${event_title}</td></tr>
          <tr><td style="font-size:13px;color:rgba(255,255,255,0.4);padding:4px 0;">Date</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:4px 0;">${event_date}</td></tr>
          ${venue ? `<tr><td style="font-size:13px;color:rgba(255,255,255,0.4);padding:4px 0;">Venue</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:4px 0;">${venue}</td></tr>` : ''}
          ${count === 1 ? `<tr><td style="font-size:13px;color:rgba(255,255,255,0.4);padding:4px 0;">Ticket</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:4px 0;">${tickets[0]?.tier_name ?? 'GA'}</td></tr>` : `<tr><td style="font-size:13px;color:rgba(255,255,255,0.4);padding:4px 0;">Tickets</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:4px 0;">${count}</td></tr>`}
        </table>
      </td></tr>
    </table>
  </td></tr>

  ${account_email ? `
  <!-- Account nudge -->
  <tr><td style="padding-bottom:24px;text-align:center;">
    <div style="font-size:12px;color:rgba(255,255,255,0.35);line-height:1.6;">Create a Pulse account with <span style="color:rgba(255,255,255,0.7);">${account_email}</span><br/>and all your tickets will be waiting there.</div>
  </td></tr>` : ''}

  <!-- Footer -->
  <tr><td style="text-align:center;padding-bottom:20px;">
    <div style="font-size:11px;color:rgba(255,255,255,0.12);letter-spacing:1px;">pulsetickets.vip</div>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
}
