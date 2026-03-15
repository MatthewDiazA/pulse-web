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
    console.log('Free ticket request:', { event_id, tier_id, quantity })
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        event_id,
        status: 'confirmed',
        total_amount: 0,
        buyer_email: '',
        buyer_name: '',
      })
      .select()
      .single()

    if (orderError) throw orderError

    const ticketRows = Array.from({ length: quantity }, () => ({
      order_id: order.id,
      event_id,
      tier_id,
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

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}