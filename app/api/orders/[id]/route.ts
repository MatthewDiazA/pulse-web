// app/api/orders/[id]/route.ts
// Public view of one order's tickets for the no-login ticket page (/tickets/[id]).
// The order id is a random UUID that only reaches the buyer (email + confirmation page),
// so the link itself is the key — same trust model as the QR codes in the email.
import { NextResponse } from 'next/server'
import { admin } from '../../../lib/guestTickets'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: order } = await admin
    .from('orders')
    .select('id, status, buyer_name, buyer_email, user_id, event:events(id, title, starts_at, doors_at, venue_name, address, city, state, cover_image_url), tickets(id, qr_code, qr_secret, is_checked_in, is_guestlist, tier:ticket_tiers(name))')
    .eq('id', id)
    .single()
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const tickets = (order.tickets as unknown as { id: string; qr_code: string; qr_secret: string | null; is_checked_in: boolean; is_guestlist: boolean; tier: { name: string } | null }[]) ?? []
  return NextResponse.json({
    id: order.id,
    status: order.status,
    buyer_name: order.buyer_name,
    buyer_email: order.buyer_email,
    linked: !!order.user_id,
    event: order.event,
    tickets: tickets.map(t => ({
      id: t.id,
      qr_code: t.qr_code,
      qr_secret: t.qr_secret,
      checked_in: !!t.is_checked_in,
      label: t.is_guestlist ? 'Guest list' : t.tier?.name ?? 'Ticket',
    })),
  })
}
