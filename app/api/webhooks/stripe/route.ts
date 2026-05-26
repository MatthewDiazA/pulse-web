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

        const eventTitle = eventData?.title ?? 'Event'
        const tierName = tier?.name ?? 'Ticket'

        // Send via /api/email — single canonical template
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pulsetx.vercel.app'
        await fetch(`${appUrl}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: buyerEmail,
            event_title: eventTitle,
            event_date: eventDate,
            venue: eventData?.venue_name ?? '',
            buyer_name: buyerName,
            tickets: ticketRows.map((t: any) => ({ qr_code: t.qr_code, tier_name: tierName })),
          }),
        })

        console.log('Paid ticket email sent to:', buyerEmail)

        // Notify admin of new sale
        try {
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticketRows[0].qr_code)}`
          const adminHtml = `<!DOCTYPE html><html><body style="margin:0;padding:32px;background:#000;font-family:Arial,sans-serif;color:#f0f0f0;">
            <div style="max-width:480px;margin:0 auto;">
              <div style="font-size:24px;font-weight:900;color:#ffaa33;margin-bottom:24px;letter-spacing:3px;">pulse · new sale</div>
              <div style="background:#0d0800;border:1px solid rgba(255,170,51,0.2);border-radius:12px;padding:20px;margin-bottom:16px;">
                <div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:4px;">${eventTitle}</div>
                <div style="font-size:13px;color:#888;margin-bottom:12px;">${tierName} · ${eventDate}${venueLine}</div>
                <div style="font-size:13px;color:#aaa;">Buyer: <strong style="color:#fff;">${buyerName || 'Unknown'}</strong></div>
                <div style="font-size:13px;color:#aaa;">Email: <strong style="color:#ffaa33;">${buyerEmail}</strong></div>
              </div>
              <div style="text-align:center;background:#0d0800;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;">
                <div style="font-size:11px;color:#554;letter-spacing:2px;text-transform:uppercase;margin-bottom:12px;">Their QR</div>
                <div style="background:#fff;border-radius:8px;padding:10px;display:inline-block;">
                  <img src="${qrUrl}" width="150" height="150" alt="QR" style="display:block;"/>
                </div>
              </div>
            </div>
          </body></html>`

          await resend.emails.send({
            from: 'PULSE <tickets@pulsetickets.vip>',
            to: 'mad2288@columbia.edu',
            subject: `Ticket sold: ${buyerName || buyerEmail} → ${eventTitle}`,
            html: adminHtml,
          })
        } catch (adminErr) {
          console.error('Admin notify failed:', adminErr)
        }
      } catch (emailError) {
        console.error('Email failed:', emailError)
      }
    }

    console.log(`Order ${order.id} confirmed for event ${event_id}`)
  } catch (err) {
    console.error('Error processing checkout:', err)
  }
}