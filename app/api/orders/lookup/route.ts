// app/api/orders/lookup/route.ts
// After Stripe redirects a guest back, find the order the webhook created for that session.
// Returns { pending: true } until the webhook has run, so the page can poll.
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { admin } from '../../../lib/guestTickets'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get('session_id')
  if (!sessionId || !sessionId.startsWith('cs_')) return NextResponse.json({ error: 'Missing session' }, { status: 400 })

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    const email = session.customer_details?.email ?? null
    if (session.payment_status !== 'paid' || !session.payment_intent) {
      return NextResponse.json({ pending: true, email })
    }
    const { data: order } = await admin
      .from('orders')
      .select('id')
      .eq('stripe_payment_intent_id', session.payment_intent as string)
      .maybeSingle()
    return NextResponse.json(order ? { orderId: order.id, email } : { pending: true, email })
  } catch {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }
}
