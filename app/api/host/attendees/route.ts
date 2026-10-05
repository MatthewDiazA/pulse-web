// app/api/host/attendees/route.ts
// Everyone holding a ticket to an event, for the door's "find by name" list. Host/admin only.
import { NextResponse } from 'next/server'
import { admin } from '../../../lib/guestTickets'
import { requireEventHost } from '../../../lib/hostAuth'

type Row = {
  id: string
  user_id: string | null
  holder_name: string | null
  is_checked_in: boolean | null
  checked_in_at: string | null
  is_guestlist: boolean | null
  tier: { name: string } | null
  holder: { full_name: string | null; username: string | null } | null
  order: { buyer_name: string | null; buyer_email: string | null } | null
}

export async function GET(request: Request) {
  const eventId = new URL(request.url).searchParams.get('eventId')
  if (!(await requireEventHost(request, eventId))) {
    return NextResponse.json({ error: 'Only the host can see attendees.' }, { status: 403 })
  }

  const [{ data: event }, { data }] = await Promise.all([
    admin.from('events').select('id, title').eq('id', eventId!).single(),
    admin
      .from('tickets')
      .select('id, user_id, holder_name, is_checked_in, checked_in_at, is_guestlist, tier:ticket_tiers(name), holder:profiles(full_name, username), order:orders(buyer_name, buyer_email)')
      .eq('event_id', eventId!)
      .order('created_at', { ascending: true }),
  ])

  const attendees = ((data as unknown as Row[]) ?? []).map(t => ({
    ticket_id: t.id,
    name: t.holder?.full_name || t.holder?.username || t.holder_name || t.order?.buyer_name || 'Guest',
    email: t.order?.buyer_email ?? '',
    tier: t.is_guestlist ? 'Guest list' : t.tier?.name ?? 'Ticket',
    checked_in: !!t.is_checked_in,
    checked_in_at: t.checked_in_at,
  }))

  return NextResponse.json({
    event,
    attendees,
    checked_in_count: attendees.filter(a => a.checked_in).length,
    total: attendees.length,
  })
}
