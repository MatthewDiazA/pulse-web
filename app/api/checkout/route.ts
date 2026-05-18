import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PLATFORM_FEE_RATE = 0.10

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const tierId = body.tierId ?? body.tier_id
    const eventId = body.eventId ?? body.event_id
    const quantity = parseInt(String(body.quantity)) || 1
    const userId = body.userId ?? body.user_id

    if (!tierId || !eventId) {
      return NextResponse.json({ error: 'Missing tierId or eventId' }, { status: 400 })
    }

    // Fetch tier and event from DB to get real price (never trust client)
    const { data: tier, error: tierErr } = await supabase
      .from('ticket_tiers')
      .select('id, name, price, quantity, quantity_sold')
      .eq('id', tierId)
      .single()

    if (tierErr || !tier) {
      return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 })
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, title')
      .eq('id', eventId)
      .single()

    if (eventErr || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check availability
    const available = tier.quantity - (tier.quantity_sold || 0)
    if (quantity > available) {
      return NextResponse.json({ error: `Only ${available} tickets left` }, { status: 400 })
    }

    const basePrice = Number(tier.price) || 0

    // Free ticket — skip Stripe, create ticket directly
    if (basePrice === 0) {
      const ticketRows = Array.from({ length: quantity }).map(() => ({
        user_id: userId,
        event_id: eventId,
        tier_id: tierId,
        qr_code: `PULSE-${eventId.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        status: 'active',
      }))

      const { error: insertErr } = await supabase.from('tickets').insert(ticketRows)
      if (insertErr) {
        return NextResponse.json({ error: 'Failed to create tickets' }, { status: 500 })
      }

      // Update sold count
      await supabase
        .from('ticket_tiers')
        .update({ quantity_sold: (tier.quantity_sold || 0) + quantity })
        .eq('id', tierId)

      return NextResponse.json({
        url: `${process.env.NEXT_PUBLIC_APP_URL}/account?order=success`,
      })
    }

    // Paid ticket — create Stripe checkout session
    const totalPerTicketCents = Math.round((basePrice + basePrice * PLATFORM_FEE_RATE) * 100)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity,
          price_data: {
            currency: 'usd',
            unit_amount: totalPerTicketCents,
            product_data: {
              name: `${tier.name} — ${event.title}`,
              description: `Includes ${Math.round(PLATFORM_FEE_RATE * 100)}% service fee`,
            },
          },
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/account?order=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventId}`,
      metadata: {
        event_id: eventId,
        tier_id: tierId,
        user_id: userId,
        quantity: String(quantity),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: error.message ?? 'Checkout failed' }, { status: 500 })
  }
}