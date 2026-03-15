import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)

function generateCode() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export async function POST(request: Request) {
  try {
    const { event_id, tier_id, quantity, user_id, buyer_email, buyer_name } = await request.json()

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        event_id,
        user_id: user_id ?? null,
        status: 'confirmed',
        total_amount: 0,
        buyer_email: buyer_email ?? '',
        buyer_name: buyer_name ?? '',
      })
      .select()
      .single()

    if (orderError) throw orderError

    const ticketRows = Array.from({ length: quantity }, () => ({
      order_id: order.id,
      event_id,
      tier_id,
      user_id: user_id ?? null,
      qr_code: generateCode(),
    }))

    const { error: ticketError } = await supabase
      .from('tickets')
      .insert(ticketRows)

    if (ticketError) throw ticketError

    await supabase.rpc('increment_tickets_sold', {
      p_tier_id: tier_id,
      p_qty: quantity,
    })

    // Send email directly
    if (buyer_email) {
      try {
        const { data: event } = await supabase
          .from('events')
          .select('title, starts_at, venue_name')
          .eq('id', event_id)
          .single()

        const { data: tier } = await supabase
          .from('ticket_tiers')
          .select('name')
          .eq('id', tier_id)
          .single()

        const eventDate = event?.starts_at
          ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })
          : 'Date TBD'

        const venueLine = event?.venue_name ? ` · ${event.venue_name}` : ''
        const venueRow = event?.venue_name ? `<tr><td style="font-size:13px;color:#888;padding:6px 0;">Venue</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${event.venue_name}</td></tr>` : ''
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticketRows[0].qr_code)}`
        const eventTitle = event?.title ?? 'Event'
        const tierName = tier?.name ?? 'Ticket'

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0b;font-family:Arial,sans-serif;color:#f0f0f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:40px 20px;">
<tr><td>
<div style="font-size:36px;font-weight:900;letter-spacing:6px;color:#e8ff47;margin-bottom:40px;font-family:Impact,'Arial Black',sans-serif;text-transform:lowercase;">pulse</div>
<div style="background:#1a1a20;border:1px solid rgba(232,255,71,0.2);border-radius:20px;overflow:hidden;margin-bottom:32px;">
  <div style="height:4px;background:linear-gradient(90deg,#e8ff47,#ff4fd8);"></div>
  <div style="padding:32px;text-align:center;">
    <div style="font-size:12px;letter-spacing:3px;color:#888;text-transform:uppercase;margin-bottom:12px;">You're on the list</div>
    <div style="font-size:36px;font-weight:900;color:#f0f0f0;text-transform:uppercase;line-height:1;margin-bottom:8px;">${eventTitle}</div>
    <div style="font-size:14px;color:#888;margin-bottom:4px;">${tierName}</div>
    <div style="font-size:13px;color:#666;">${eventDate}${venueLine}</div>
  </div>
  <div style="padding:0 32px 32px;text-align:center;">
    <div style="background:#ffffff;border-radius:12px;padding:16px;display:inline-block;">
      <img src="${qrUrl}" width="200" height="200" alt="QR Code" style="display:block;"/>
    </div>
    <div style="margin-top:12px;font-size:11px;color:#666;letter-spacing:1px;text-transform:uppercase;">Show this at the door</div>
  </div>
</div>
<div style="background:#16161a;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;margin-bottom:32px;">
  <div style="font-size:11px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;">Event details</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="font-size:13px;color:#888;padding:6px 0;">Event</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${eventTitle}</td></tr>
    <tr><td style="font-size:13px;color:#888;padding:6px 0;">Ticket type</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${tierName}</td></tr>
    <tr><td style="font-size:13px;color:#888;padding:6px 0;">Date</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${eventDate}</td></tr>
    ${venueRow}
  </table>
</div>
<div style="text-align:center;font-size:12px;color:#555;">
  <div style="margin-bottom:8px;">Powered by <span style="color:#e8ff47;">pulse</span></div>
</div>
</td></tr>
</table>
</body>
</html>`

        await resend.emails.send({
          from: 'PULSE <onboarding@resend.dev>',
          to: buyer_email,
          subject: `Your ticket to ${eventTitle} ✦`,
          html,
        })

        console.log('Email sent to:', buyer_email)
      } catch (emailError) {
        console.error('Email failed:', emailError)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Free ticket error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}