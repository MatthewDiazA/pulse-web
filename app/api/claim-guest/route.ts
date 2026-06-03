import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS so we can mint the ticket + mark the token claimed atomically
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

    // 1. Look up the invite
    const { data: invite, error: inviteErr } = await supabase
      .from('guest_invites')
      .select('id, event_id, tier_id, claimed_by, claimed_at')
      .eq('token', token)
      .single()

    if (inviteErr || !invite) {
      return NextResponse.json({ error: 'This invite link is invalid.' }, { status: 404 })
    }

    // 2. Already claimed? Block reuse.
    if (invite.claimed_by) {
      // If the same user claimed it, treat as success (idempotent for refreshes)
      if (invite.claimed_by === userId) {
        return NextResponse.json({ success: true, alreadyClaimed: true, eventId: invite.event_id })
      }
      return NextResponse.json({ error: 'This invite link has already been used.' }, { status: 409 })
    }

    // 3. Prevent double-claiming the same event via two links
    const { data: existing } = await supabase
      .from('tickets')
      .select('id')
      .eq('event_id', invite.event_id)
      .eq('user_id', userId)
      .eq('is_guestlist', true)
      .limit(1)

    if (existing && existing.length > 0) {
      // Still mark this token consumed so the link can't be passed on
      await supabase
        .from('guest_invites')
        .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
        .eq('id', invite.id)
        .is('claimed_by', null)
      return NextResponse.json({ success: true, alreadyClaimed: true, eventId: invite.event_id })
    }

    // 4. Atomically claim the token — only succeeds if still unclaimed (race-safe)
    const { data: claimed, error: claimErr } = await supabase
      .from('guest_invites')
      .update({ claimed_by: userId, claimed_at: new Date().toISOString() })
      .eq('id', invite.id)
      .is('claimed_by', null)
      .select('id')
      .single()

    if (claimErr || !claimed) {
      return NextResponse.json({ error: 'This invite link has already been used.' }, { status: 409 })
    }

    // 5. Mint exactly one GL ticket
    const qrCode = `PULSE-GL-${invite.event_id.slice(0, 8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const { error: ticketErr } = await supabase.from('tickets').insert({
      event_id: invite.event_id,
      tier_id: invite.tier_id ?? null,
      user_id: userId,
      qr_code: qrCode,
      status: 'active',
      is_guestlist: true,
    })

    if (ticketErr) {
      // Roll back the claim so the link still works
      await supabase
        .from('guest_invites')
        .update({ claimed_by: null, claimed_at: null })
        .eq('id', invite.id)
      console.error('GL ticket insert failed:', ticketErr)
      return NextResponse.json({ error: 'Could not create your guest list ticket. Try again.' }, { status: 500 })
    }

    // 6. Send ticket confirmation email (fire-and-forget — non-fatal)
    try {
      const [{ data: event }, { data: { user: authUser } }] = await Promise.all([
        supabase
          .from('events')
          .select('title, starts_at, venue_name')
          .eq('id', invite.event_id)
          .single(),
        supabase.auth.admin.getUserById(userId),
      ])

      const userEmail = authUser?.email ?? ''
      const userName = (authUser?.user_metadata?.full_name as string | undefined) ?? ''
      const eventDate = event?.starts_at
        ? new Date(event.starts_at).toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
          })
        : 'TBD'

      if (userEmail) {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: userEmail,
            buyer_name: userName,
            event_title: event?.title ?? 'Your event',
            event_date: eventDate,
            venue: event?.venue_name ?? undefined,
            tier_name: 'Guest List',
            qr_code: qrCode,
          }),
        })
      }
    } catch (emailErr) {
      console.warn('[claim-guest] email failed (non-fatal):', emailErr)
    }

    return NextResponse.json({ success: true, eventId: invite.event_id })
  } catch (error: any) {
    console.error('claim-guest error:', error)
    return NextResponse.json({ error: error.message ?? 'Something went wrong' }, { status: 500 })
  }
}