// app/api/claim-guest/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS so we can mint the ticket reliably
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(request: Request) {
  try {
    const { token, userId } = await request.json()

    if (!token || !userId) {
      return NextResponse.json({ error: 'Missing token or userId' }, { status: 400 })
    }

    // 1. Resolve the invite -> event. (Broadcast: the link is reusable, not single-use.)
    const { data: invite, error: inviteErr } = await supabase
      .from('guest_invites')
      .select('id, event_id, tier_id')
      .eq('token', token)
      .limit(1)
      .maybeSingle()

    if (inviteErr || !invite) {
      return NextResponse.json({ error: 'This invite link is invalid.' }, { status: 404 })
    }

    // 2. Already has a guest ticket for this event? Idempotent success (handles refreshes / re-clicks).
    const { data: existing } = await supabase
      .from('tickets')
      .select('id')
      .eq('event_id', invite.event_id)
      .eq('user_id', userId)
      .eq('is_guestlist', true)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: true, alreadyClaimed: true, eventId: invite.event_id })
    }

    // 3. Mint one guest ticket. The link is NOT consumed - anyone else can still claim.
    const qr = `PULSE-GL-${invite.event_id.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const { error: ticketErr } = await supabase.from('tickets').insert({
      event_id: invite.event_id,
      tier_id: invite.tier_id ?? null,
      user_id: userId,
      qr_code: qr,
      status: 'active',
      is_guestlist: true,
    })

    if (ticketErr) {
      console.error('GL ticket insert failed:', ticketErr)
      return NextResponse.json({ error: 'Could not create your guest list ticket. Try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, eventId: invite.event_id })
  } catch (error: any) {
    console.error('claim-guest error:', error)
    return NextResponse.json({ error: error.message ?? 'Something went wrong' }, { status: 500 })
  }
}