// Server-only helpers for tickets bought or claimed without an account.
// A guest's tickets hang off an `orders` row carrying their email (user_id null);
// when that email later signs in, linkGuestTickets() moves them into the account.
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildTicketEmail } from './ticketEmail'

export const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const resend = new Resend(process.env.RESEND_API_KEY)

export const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'https://pulsetickets.vip'

export const isEmail = (s: unknown): s is string =>
  typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// No-login page listing every ticket in an order (order ids are random UUIDs)
export const orderUrl = (orderId: string) => `${appUrl()}/tickets/${orderId}`

/** Email every ticket in an order, with a link to the no-login ticket page. */
export async function sendOrderEmail(orderId: string, opts: { guest: boolean }) {
  const { data: order } = await admin
    .from('orders')
    .select('id, buyer_email, buyer_name, event:events(title, starts_at, venue_name), tickets(qr_code, tier:ticket_tiers(name))')
    .eq('id', orderId)
    .single()
  if (!order?.buyer_email) return

  const event = order.event as unknown as { title: string; starts_at: string | null; venue_name: string | null } | null
  const tickets = (order.tickets as unknown as { qr_code: string; tier: { name: string } | null }[]) ?? []
  const title = event?.title ?? 'your event'
  const html = buildTicketEmail({
    buyer_name: order.buyer_name ? escapeHtml(order.buyer_name) : undefined,
    event_title: escapeHtml(title),
    event_date: event?.starts_at
      ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
      : 'Date TBD',
    venue: event?.venue_name ? escapeHtml(event.venue_name) : undefined,
    tickets: tickets.map(t => ({ qr_code: t.qr_code, tier_name: escapeHtml(t.tier?.name ?? 'Ticket') })),
    order_url: orderUrl(order.id),
    account_email: opts.guest ? escapeHtml(order.buyer_email) : undefined,
  })

  await resend.emails.send({
    from: 'PULSE <tickets@pulsetickets.vip>',
    to: order.buyer_email,
    subject: tickets.length > 1 ? `Your ${tickets.length} tickets to ${title}` : `Your ticket to ${title}`,
    html,
  })
}

/**
 * Attach every guest order (and its tickets) bought with `email` to this account.
 * Only call with an email the auth provider has confirmed — that's what proves ownership.
 */
export async function linkGuestTickets(userId: string, email: string): Promise<number> {
  const pattern = email.trim().replace(/[\\%_]/g, c => `\\${c}`) // exact, case-insensitive match
  const { data: orders } = await admin.from('orders').select('id').ilike('buyer_email', pattern).is('user_id', null)
  const ids = (orders ?? []).map(o => o.id)
  if (!ids.length) return 0

  await admin.from('orders').update({ user_id: userId }).in('id', ids).is('user_id', null)
  const { data: linked } = await admin.from('tickets').update({ user_id: userId }).in('order_id', ids).is('user_id', null).select('id')
  return linked?.length ?? 0
}
