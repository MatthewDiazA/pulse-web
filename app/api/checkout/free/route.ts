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
    console.log('Free ticket request:', { event_id, tier_id, quantity, user_id })

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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Free ticket error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}