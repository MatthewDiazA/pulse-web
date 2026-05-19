import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    )
  } catch (err: any) {
    console.error('Webhook signature failed:', err.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    await handleCheckoutComplete(session)
  }

  return NextResponse.json({ received: true })
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const { event_id, tier_id, quantity, user_id } = session.metadata ?? {}

  if (!event_id || !tier_id || !quantity) {
    console.error('Missing metadata:', session.id)
    return
  }

  const qty = parseInt(quantity)
  const buyerEmail = session.customer_details?.email ?? ''
  const buyerName = session.customer_details?.name ?? ''

  try {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        event_id,
        user_id: user_id ?? null,
        status: 'confirmed',
        total_amount: (session.amount_total ?? 0) / 100,
        stripe_payment_intent_id: session.payment_intent as string,
        buyer_email: buyerEmail,
        buyer_name: buyerName,
      })
      .select()
      .single()

    if (orderError) throw orderError

    const ticketRows = Array.from({ length: qty }, () => ({
      order_id: order.id,
      event_id,
      tier_id,
      user_id: user_id ?? null,
      qr_code: `PULSE-${crypto.randomUUID()}`,
    }))

    const { error: ticketError } = await supabase.from('tickets').insert(ticketRows)
    if (ticketError) throw ticketError

    await supabase.rpc('increment_tickets_sold', {
      p_tier_id: tier_id,
      p_qty: qty,
    })

    if (buyerEmail) {
      try {
        const { data: eventData } = await supabase
          .from('events')
          .select('title, starts_at, venue_name')
          .eq('id', event_id)
          .single()

        const { data: tier } = await supabase
          .from('ticket_tiers')
          .select('name, price')
          .eq('id', tier_id)
          .single()

        const eventDate = eventData?.starts_at
          ? new Date(eventData.starts_at).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
            })
          : 'Date TBD'

        const venueLine = eventData?.venue_name ? ` · ${eventData.venue_name}` : ''
        const venueRow = eventData?.venue_name
          ? `<tr><td style="font-size:13px;color:#888;padding:6px 0;">Venue</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${eventData.venue_name}</td></tr>`
          : ''
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticketRows[0].qr_code)}`
        const eventTitle = eventData?.title ?? 'Event'
        const tierName = tier?.name ?? 'Ticket'
        const totalPaid = ((session.amount_total ?? 0) / 100).toFixed(2)

        const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;font-family:Arial,sans-serif;color:#f0f0f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;padding:40px 20px;">
<tr><td>
<div style="font-size:36px;font-weight:900;letter-spacing:6px;color:#ffaa33;margin-bottom:40px;font-family:Impact,'Arial Black',sans-serif;text-transform:lowercase;">pulse</div>
<div style="background:#0d0800;border:1px solid rgba(255,170,51,0.2);border-radius:20px;overflow:hidden;margin-bottom:32px;">
  <div style="height:4px;background:linear-gradient(90deg,#ff6600,#ffaa33,#ffc850);"></div>
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
<div style="background:#0d0800;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;margin-bottom:32px;">
  <div style="font-size:11px;color:#666;letter-spacing:1px;text-transform:uppercase;margin-bottom:16px;">Order details</div>
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="font-size:13px;color:#888;padding:6px 0;">Event</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${eventTitle}</td></tr>
    <tr><td style="font-size:13px;color:#888;padding:6px 0;">Ticket type</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${tierName}</td></tr>
    <tr><td style="font-size:13px;color:#888;padding:6px 0;">Quantity</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${qty}</td></tr>
    <tr><td style="font-size:13px;color:#888;padding:6px 0;">Date</td><td style="font-size:13px;color:#f0f0f0;text-align:right;padding:6px 0;">${eventDate}</td></tr>
    ${venueRow}
    <tr><td style="font-size:13px;color:#888;padding:6px 0;border-top:0.5px solid rgba(255,255,255,0.08);padding-top:12px;">Total paid</td><td style="font-size:15px;color:#ffaa33;font-weight:700;text-align:right;padding:6px 0;">$${totalPaid}</td></tr>
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
          to: buyerEmail,
          subject: `Your ticket to ${eventTitle}`,
          html,
        })

        console.log('Paid ticket email sent to:', buyerEmail)
      } catch (emailError) {
        console.error('Email failed:', emailError)
      }
    }

    console.log(`Order ${order.id} confirmed for event ${event_id}`)
  } catch (err) {
    console.error('Error processing checkout:', err)
  }
}