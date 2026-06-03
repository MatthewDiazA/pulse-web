// app/api/guestlist/create/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const { eventId, userId } = await req.json()
    if (!eventId || !userId) {
      return NextResponse.json({ error: 'Missing eventId or userId' }, { status: 400 })
    }

    // Verify caller is the host or an admin
    const { data: event } = await sb
      .from('events')
      .select('id, title, host_id')
      .eq('id', eventId)
      .single()

    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 })

    const { data: adminRow } = await sb
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .single()

    const isHost = event.host_id === userId
    const isAdmin = !!adminRow

    if (!isHost && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Return existing link if one already exists for this event (idempotent)
    const { data: existing } = await sb
      .from('guest_list_links')
      .select('token, uses')
      .eq('event_id', eventId)
      .single()

    if (existing) {
      const url = `${process.env.NEXT_PUBLIC_APP_URL}/guestlist/${existing.token}`
      return NextResponse.json({ token: existing.token, url, uses: existing.uses })
    }

    // Create a free Guest List tier for this event
    const { data: tier } = await sb
      .from('ticket_tiers')
      .insert({ event_id: eventId, name: 'Guest List', price: 0, quantity: 9999, quantity_sold: 0 })
      .select('id')
      .single()

    if (!tier) return NextResponse.json({ error: 'Failed to create guest tier' }, { status: 500 })

    const token = crypto.randomUUID().replace(/-/g, '')

    const { data: link, error: linkError } = await sb
      .from('guest_list_links')
      .insert({ event_id: eventId, host_id: userId, token, tier_id: tier.id })
      .select('token, uses')
      .single()

    if (linkError || !link) {
      // Race condition — another request may have created it
      await sb.from('ticket_tiers').delete().eq('id', tier.id)
      const { data: raceLink } = await sb
        .from('guest_list_links')
        .select('token, uses')
        .eq('event_id', eventId)
        .single()
      if (raceLink) {
        const url = `${process.env.NEXT_PUBLIC_APP_URL}/guestlist/${raceLink.token}`
        return NextResponse.json({ token: raceLink.token, url, uses: raceLink.uses })
      }
      return NextResponse.json({ error: 'Failed to create link' }, { status: 500 })
    }

    const url = `${process.env.NEXT_PUBLIC_APP_URL}/guestlist/${token}`
    return NextResponse.json({ token, url, uses: 0 })
  } catch (e) {
    console.error('[guestlist/create]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}