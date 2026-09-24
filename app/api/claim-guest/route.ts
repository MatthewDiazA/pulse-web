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
          // Names live on profiles; emails live on the auth user (profiles has no email column)
          const [{ data: profs }, authUsers] = await Promise.all([
            supabase.from('profiles').select('id, full_name, username').in('id', userIds),
            Promise.all(userIds.map(id => supabase.auth.admin.getUserById(id).then(r => r.data.user).catch(() => null))),
          ])
          for (const u of authUsers) if (u) nameMap[u.id] = { name: (u.user_metadata?.full_name as string | undefined) || u.email?.split('@')[0] || 'Guest', email: u.email ?? '' }
          for (const p of profs ?? []) {
            const name = p.full_name || p.username
            if (name) nameMap[p.id] = { name, email: nameMap[p.id]?.email ?? '' }
          }
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

    // 1. Look up the invite. Links are single-use: one person claims it and gets ticket_count tickets.
    const { data: invite, error: inviteErr } = await supabase
      .from('guest_invites')
      .select('id, event_id, tier_id, created_by, claimed_by, ticket_count')
      .eq('token', token)
      .limit(1)
      .maybeSingle()

    if (inviteErr || !invite) {
      return NextResponse.json({ error: 'This invite link is invalid.' }, { status: 404 })
    }

    const ticketCount = Math.max(1, invite.ticket_count ?? 1)

    // 2. The host opening their own link (to test it, or to share it from the browser) must not burn it
    if (invite.created_by === userId) {
      return NextResponse.json({ error: "This is your own guest link — opening it yourself doesn't use it up. Send it to your guest.", ownLink: true }, { status: 409 })
    }

    // 3. Already claimed? Same user = idempotent success (refreshes); anyone else is blocked.
    if (invite.claimed_by) {
      if (invite.claimed_by === userId) {
        return NextResponse.json({ success: true, alreadyClaimed: true, eventId: invite.event_id, ticketCount })
      }
      return NextResponse.json({ error: 'This invite link has already been used. Ask the host for a new one.' }, { status: 409 })
    }

    // 4. Atomically claim the token — only succeeds if still unclaimed (race-safe)
    const { data: claimed, error: claimErr } = await supabase
      .from('guest_invites')
      .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
      .eq('id', invite.id)
      .is('claimed_by', null)
      .select('id')
      .maybeSingle()

    if (claimErr || !claimed) {
      // Lost a race — if it was this same user (double request), that's still a success
      const { data: now } = await supabase.from('guest_invites').select('claimed_by').eq('id', invite.id).single()
      if (now?.claimed_by === userId) {
        return NextResponse.json({ success: true, alreadyClaimed: true, eventId: invite.event_id, ticketCount })
      }
      return NextResponse.json({ error: 'This invite link has already been used. Ask the host for a new one.' }, { status: 409 })
    }

    // 5. Mint ticket_count guest tickets for this person (single insert, all-or-nothing)
    const rows = Array.from({ length: ticketCount }, () => ({
      event_id: invite.event_id,
      tier_id: invite.tier_id ?? null,
      user_id: userId,
      qr_code: `PULSE-GL-${invite.event_id.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'active',
      is_guestlist: true,
    }))
    const { error: ticketErr } = await supabase.from('tickets').insert(rows)

    if (ticketErr) {
      // Roll back the claim so the link still works
      await supabase
        .from('guest_invites')
        .update({ claimed_by: null, claimed_at: null })
        .eq('id', invite.id)
      console.error('GL ticket insert failed:', ticketErr)
      return NextResponse.json({ error: 'Could not create your guest list tickets. Try again.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, eventId: invite.event_id, ticketCount })
  } catch (error: any) {
    console.error('claim-guest error:', error)
    return NextResponse.json({ error: error.message ?? 'Something went wrong' }, { status: 500 })
  }
}