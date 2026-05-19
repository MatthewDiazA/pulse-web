import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const PLATFORM_FEE_RATE = 0.10
const MAX_TICKETS_PER_USER_PER_EVENT = 10

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const tierId = body.tierId ?? body.tier_id
    const eventId = body.eventId ?? body.event_id
    const quantity = parseInt(String(body.quantity)) || 1
    const userId = body.userId ?? body.user_id

    if (!tierId || !eventId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Rate limit: max tickets per user per event
    const { count } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('event_id', eventId)

    if ((count ?? 0) + quantity > MAX_TICKETS_PER_USER_PER_EVENT) {
      return NextResponse.json({
        error: `Limit ${MAX_TICKETS_PER_USER_PER_EVENT} tickets per event. You already have ${count ?? 0}.`,
      }, { status: 400 })
    }

    // Fetch tier and event from DB (never trust client)
    const { data: tier, error: tierErr } = await supabase
      .from('ticket_tiers')
      .select('id, name, price, quantity, quantity_sold')
      .eq('id', tierId)
      .single()

    if (tierErr || !tier) {
      console.error('Tier lookup failed:', tierErr)
      return NextResponse.json({ error: 'Ticket tier not found' }, { status: 404 })
    }

    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, title')
      .eq('id', eventId)
      .single()

    if (eventErr || !event) {
      console.error('Event lookup failed:', eventErr)
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
        qr_code: `PULSE-${crypto.randomUUID()}`,
        status: 'active',
      }))

      const { error: insertErr } = await supabase.from('tickets').insert(ticketRows)
      if (insertErr) {
        console.error('Failed to insert tickets:', insertErr)
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
    // Customer pays base price. Platform fee is internal (taken from host payout).
    const totalPerTicketCents = Math.round(basePrice * 100)

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
    return NextResponse.json({ error: 'Checkout failed. Please try again.' }, { status: 500 })
  }
}