import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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

    if (orderError) {
      console.error('Order error:', orderError)
      throw orderError
    }

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

    if (ticketError) {
      console.error('Ticket error:', ticketError)
      throw ticketError
    }

    await supabase.rpc('increment_tickets_sold', {
      p_tier_id: tier_id,
      p_qty: quantity,
    })
// Send confirmation email
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

  if (buyer_email && event) {
    const eventDate = event.starts_at
      ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' })
      : 'Date TBD'

    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/send-ticket-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: buyer_email,
        name: buyer_name ?? '',
        event_title: event.title,
        event_date: eventDate,
        venue: event.venue_name ?? '',
        tier_name: tier?.name ?? 'Ticket',
        qr_code: ticketRows[0].qr_code,
      })
    })
  }
} catch (e) {
  console.error('Email send failed:', e)
}
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Free ticket error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}