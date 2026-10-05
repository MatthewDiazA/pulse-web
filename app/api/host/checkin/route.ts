// app/api/host/checkin/route.ts
// Door check-in, host/admin only. Accepts a scanned code (live rotating "P1:…" or a
// pre-live fixed code) or a ticketId picked from the attendee list.
// Each ticket checks in once; a stale live code is a screenshot and is refused.
import { NextResponse } from 'next/server'
import { admin } from '../../../lib/guestTickets'
import { requireEventHost } from '../../../lib/hostAuth'
import { parseLiveCode, checkLiveCode } from '../../../lib/liveQr'

type Status = 'admitted' | 'already' | 'expired' | 'static_blocked' | 'wrong_event' | 'invalid'

const TICKET_FIELDS = 'id, event_id, user_id, holder_name, is_checked_in, checked_in_at, is_guestlist, qr_secret, tier:ticket_tiers(name), holder:profiles(full_name, username), order:orders(buyer_name)'

type TicketRow = {
  id: string
  event_id: string
  holder_name: string | null
  is_checked_in: boolean | null
  checked_in_at: string | null
  is_guestlist: boolean | null
  qr_secret: string | null
  tier: { name: string } | null
  holder: { full_name: string | null; username: string | null } | null
  order: { buyer_name: string | null } | null
}

const nameOf = (t: TicketRow) => t.holder?.full_name || t.holder?.username || t.holder_name || t.order?.buyer_name || 'Guest'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const eventId: string | undefined = body.event_id ?? body.eventId
    const code: string = String(body.code ?? body.qr_code ?? '').trim()
    const ticketId: string | undefined = body.ticketId

    if (!(await requireEventHost(request, eventId))) {
      return NextResponse.json({ error: 'Only the host can check people in.' }, { status: 403 })
    }

    const reply = async (status: Status, t?: TicketRow) => {
      const [{ count: inCount }, { count: total }] = await Promise.all([
        admin.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId!).eq('is_checked_in', true),
        admin.from('tickets').select('id', { count: 'exact', head: true }).eq('event_id', eventId!),
      ])
      return NextResponse.json({
        status,
        valid: status === 'admitted',
        ticket_id: t?.id ?? null,
        name: t ? nameOf(t) : null,
        tier: t ? (t.is_guestlist ? 'Guest list' : t.tier?.name ?? 'Ticket') : null,
        is_guestlist: !!t?.is_guestlist,
        checked_in_at: t?.checked_in_at ?? null,
        checked_in_count: inCount ?? 0,
        total: total ?? 0,
      })
    }

    // 1. Find the ticket
    let ticket: TicketRow | null = null
    const live = code ? parseLiveCode(code) : null
    if (ticketId) {
      const { data } = await admin.from('tickets').select(TICKET_FIELDS).eq('id', ticketId).maybeSingle()
      ticket = data as unknown as TicketRow | null
    } else if (live) {
      const { data } = await admin.from('tickets').select(TICKET_FIELDS).eq('id', live.ticketId).maybeSingle()
      ticket = data as unknown as TicketRow | null
      if (!ticket?.qr_secret) return reply('invalid')
      const verdict = await checkLiveCode(live, ticket.qr_secret)
      if (verdict === 'bad') return reply('invalid')
      if (ticket.event_id !== eventId) return reply('wrong_event', ticket)
      if (verdict === 'expired') return reply(ticket.is_checked_in ? 'already' : 'expired', ticket)
    } else if (code) {
      const { data } = await admin.from('tickets').select(TICKET_FIELDS).eq('qr_code', code).maybeSingle()
      ticket = data as unknown as TicketRow | null
      // Live tickets must show their live code — a fixed code for one is a screenshot of an old email
      if (ticket?.qr_secret) return reply(ticket.event_id !== eventId ? 'wrong_event' : ticket.is_checked_in ? 'already' : 'static_blocked', ticket)
    } else {
      return NextResponse.json({ error: 'Missing code' }, { status: 400 })
    }

    if (!ticket) return reply('invalid')
    if (ticket.event_id !== eventId) return reply('wrong_event', ticket)
    if (ticket.is_checked_in) return reply('already', ticket)

    // 2. Check in exactly once (two scanners on the same ticket can't both win)
    const checkedInAt = new Date().toISOString()
    const { data: won } = await admin
      .from('tickets')
      .update({ is_checked_in: true, checked_in_at: checkedInAt })
      .eq('id', ticket.id)
      .eq('is_checked_in', false)
      .select('id')
      .maybeSingle()
    if (!won) {
      const { data: fresh } = await admin.from('tickets').select(TICKET_FIELDS).eq('id', ticket.id).single()
      return reply('already', (fresh as unknown as TicketRow) ?? ticket)
    }
    return reply('admitted', { ...ticket, is_checked_in: true, checked_in_at: checkedInAt })
  } catch (err) {
    console.error('checkin error:', err)
    return NextResponse.json({ error: 'Check-in failed' }, { status: 500 })
  }
}
