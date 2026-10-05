import { NextResponse } from 'next/server'
import { newQrSecret } from '../../lib/liveQr'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { isEmail, orderUrl, sendOrderEmail } from '../../lib/guestTickets'
import { applyPromo, findUsablePromo, recordPromoUse, type Promo } from '../../lib/promo'

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
    // No account needed: guests are identified by email (collected here for free
    // tickets, by Stripe for paid ones) and can link the tickets to an account later.
    const userId: string | null = body.userId ?? body.user_id ?? null
    const buyerEmail: string | null = isEmail(body.buyerEmail) ? body.buyerEmail.trim() : null
    const buyerName: string = typeof body.buyerName === 'string' ? body.buyerName.trim().slice(0, 80) : ''

    if (!tierId || !eventId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (quantity < 1 || quantity > MAX_TICKETS_PER_USER_PER_EVENT) {
      return NextResponse.json({ error: `You can buy up to ${MAX_TICKETS_PER_USER_PER_EVENT} tickets at once.` }, { status: 400 })
    }

    // Rate limit: max tickets per user per event (account holders)
    if (userId) {
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

    // Promo code: validated and applied here, never trusted from the client
    let promo: Promo | null = null
    if (body.promoCode) {
      const found = await findUsablePromo(eventId, body.promoCode)
      if ('error' in found) return NextResponse.json({ error: found.error }, { status: 400 })
      promo = found.promo
    }
    const unitPrice = applyPromo(basePrice, promo)
    const discountEach = Math.round((basePrice - unitPrice) * 100) / 100
    const promoFields = promo ? { promo_code: promo.code, discount_amount: Math.round(discountEach * quantity * 100) / 100 } : {}

    // Free ticket (or free after the code), no account — record an order under their email and send the tickets there
    if (unitPrice === 0 && !userId) {
      if (!buyerEmail || !buyerName) {
        return NextResponse.json({ error: 'Add your name and email so we can send your tickets.' }, { status: 400 })
      }
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({ event_id: eventId, user_id: null, status: 'confirmed', total_amount: 0, buyer_email: buyerEmail, buyer_name: buyerName, ...promoFields })
        .select('id')
        .single()
      if (orderErr || !order) {
        console.error('Guest order insert failed:', orderErr)
        return NextResponse.json({ error: 'Could not reserve your tickets. Try again.' }, { status: 500 })
      }
      const { error: insertErr } = await supabase.from('tickets').insert(
        Array.from({ length: quantity }, () => ({
          order_id: order.id,
          user_id: null,
          event_id: eventId,
          tier_id: tierId,
          holder_name: buyerName,
          qr_code: `PULSE-${crypto.randomUUID()}`,
          qr_secret: newQrSecret(),
          status: 'active',
        })),
      )
      if (insertErr) {
        await supabase.from('orders').delete().eq('id', order.id)
        console.error('Guest ticket insert failed:', insertErr)
        return NextResponse.json({ error: 'Could not reserve your tickets. Try again.' }, { status: 500 })
      }
      await supabase.rpc('increment_tickets_sold', { p_tier_id: tierId, p_qty: quantity })
      if (promo) await recordPromoUse(promo.id)
      try { await sendOrderEmail(order.id, { guest: true }) } catch (e) { console.error('Guest ticket email failed:', e) }
      return NextResponse.json({ url: orderUrl(order.id) })
    }

    // Free ticket (or free after the code) — skip Stripe, create ticket directly
    if (unitPrice === 0) {
      const ticketRows = Array.from({ length: quantity }).map(() => ({
        user_id: userId,
        event_id: eventId,
        tier_id: tierId,
        qr_code: `PULSE-${crypto.randomUUID()}`,
        qr_secret: newQrSecret(),
        status: 'active',
      }))

      const { error: insertErr } = await supabase.from('tickets').insert(ticketRows)
      if (insertErr) {
        console.error('Failed to insert tickets:', insertErr)
        return NextResponse.json({ error: 'Failed to create tickets' }, { status: 500 })
      }
      if (promo) await recordPromoUse(promo.id)

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
    // Customer pays the (possibly discounted) price. Platform fee is internal (taken from host payout).
    const totalPerTicketCents = Math.round(unitPrice * 100)
    if (totalPerTicketCents * quantity < 50) {
      return NextResponse.json({ error: 'That total is under the $0.50 card minimum. Add a ticket or remove the code.' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity,
          price_data: {
            currency: 'usd',
            unit_amount: totalPerTicketCents,
            product_data: {
              name: `${tier.name} — ${event.title}${promo ? ` (code ${promo.code})` : ''}`,
            },
          },
        },
      ],
      // Guests land on a confirmation page that opens their tickets once the webhook has issued them
      success_url: userId
        ? `${process.env.NEXT_PUBLIC_APP_URL}/account?order=success&session_id={CHECKOUT_SESSION_ID}`
        : `${process.env.NEXT_PUBLIC_APP_URL}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/events/${eventId}`,
      ...(buyerEmail ? { customer_email: buyerEmail } : {}),
      metadata: {
        event_id: eventId,
        tier_id: tierId,
        ...(userId ? { user_id: userId } : {}),
        quantity: String(quantity),
        // Name typed on our page (Stripe's is the cardholder's) — goes on the tickets for the door
        ...(buyerName ? { buyer_name: buyerName } : {}),
        // The webhook records the use and the discount on the order
        ...(promo ? { promo_id: promo.id, promo_code: promo.code, discount_each: String(discountEach) } : {}),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: 'Checkout failed. Please try again.' }, { status: 500 })
  }
}