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
    const body = await request.json()
    const { token, userId, action, eventId, requesterId, ticketId } = body

    // ── Guest-list management (host/admin only): list + remove ──────────────
    if (action === 'list' || action === 'remove') {
      // authorize: requester must be the event host or a site admin
      let allowed = false
      if (eventId && requesterId) {
        const { data: ev } = await supabase.from('events').select('host_id').eq('id', eventId).single()
        if (ev?.host_id === requesterId) allowed = true
        else {
          const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', requesterId).single()
          allowed = !!admin
        }
      }
      if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      if (action === 'list') {
        const { data: tickets } = await supabase
          .from('tickets')
          .select('id, user_id, is_checked_in, created_at')
          .eq('event_id', eventId)
          .eq('is_guestlist', true)
          .order('created_at', { ascending: false })
        const userIds = Array.from(new Set((tickets ?? []).map(t => t.user_id).filter(Boolean))) as string[]
        const nameMap: Record<string, { name: string; email: string }> = {}
        if (userIds.length) {
          const { data: profs } = await supabase.from('profiles').select('id, full_name, username, email').in('id', userIds)
          for (const p of profs ?? []) nameMap[p.id] = { name: p.full_name ?? p.username ?? 'Guest', email: p.email ?? '' }
        }
        const guests = (tickets ?? []).map(t => ({
          ticket_id: t.id,
          user_id: t.user_id,
          name: t.user_id ? (nameMap[t.user_id]?.name ?? 'Guest') : 'Guest',
          email: t.user_id ? (nameMap[t.user_id]?.email ?? '') : '',
          is_checked_in: !!t.is_checked_in,
        }))
        return NextResponse.json({ guests })
      }

      // action === 'remove'
      if (!ticketId) return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 })
      const { error: delErr } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticketId)
        .eq('event_id', eventId)
        .eq('is_guestlist', true)
      if (delErr) return NextResponse.json({ error: 'Could not remove guest' }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    // ── Default: claim a guest ticket from a /gl/ link ──────────────────────
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