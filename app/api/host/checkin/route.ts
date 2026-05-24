import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    const { qr_code, event_id } = await request.json()
    if (!qr_code || !event_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('id, event_id, is_checked_in, checked_in_at, is_guestlist, tier:ticket_tiers(name), holder:profiles(full_name, username)')
      .eq('qr_code', qr_code)
      .eq('event_id', event_id)
      .single()

    if (error || !ticket) return NextResponse.json({ valid: false, error: 'Ticket not found' })
    if (ticket.is_checked_in) return NextResponse.json({ valid: false, error: 'Already checked in', checked_in_at: ticket.checked_in_at })

    const { error: updateErr } = await supabase
      .from('tickets')
      .update({ is_checked_in: true, checked_in_at: new Date().toISOString() })
      .eq('id', ticket.id)

    if (updateErr) return NextResponse.json({ valid: false, error: 'Failed to check in' })

    return NextResponse.json({
      valid: true,
      ticket_id: ticket.id,
      is_guestlist: ticket.is_guestlist,
      tier_name: (ticket.tier as any)?.name ?? 'Ticket',
      holder_name: (ticket.holder as any)?.full_name ?? (ticket.holder as any)?.username ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}