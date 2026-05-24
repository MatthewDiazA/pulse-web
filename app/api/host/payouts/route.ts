import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    // Fetch balance
    const balance = await stripe.balance.retrieve()

    // Fetch recent payouts
    const payouts = await stripe.payouts.list({ limit: 10 })

    // Fetch recent charges filtered by this host's events
    const { data: events } = await supabase
      .from('events')
      .select('id, title')
      .eq('host_id', userId)

    const eventIds = (events ?? []).map(e => e.id)

    const { data: orders } = await supabase
      .from('orders')
      .select('id, total_amount, created_at, event_id, buyer_name, status')
      .in('event_id', eventIds.length > 0 ? eventIds : ['none'])
      .order('created_at', { ascending: false })
      .limit(50)

    const eventMap = Object.fromEntries((events ?? []).map(e => [e.id, e.title]))

    return NextResponse.json({
      available: balance.available.reduce((s, b) => s + (b.currency === 'usd' ? b.amount : 0), 0),
      pending: balance.pending.reduce((s, b) => s + (b.currency === 'usd' ? b.amount : 0), 0),
      payouts: payouts.data.map(p => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        arrival_date: p.arrival_date,
        created: p.created,
      })),
      orders: (orders ?? []).map(o => ({
        id: o.id,
        amount: o.total_amount,
        event: eventMap[o.event_id] ?? 'Unknown',
        buyer: o.buyer_name,
        created_at: o.created_at,
        status: o.status,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}