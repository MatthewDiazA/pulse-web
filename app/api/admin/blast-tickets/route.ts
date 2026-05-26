// app/api/admin/blast-tickets/route.ts
// Server-side blast — has access to auth.users for email fallback
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('eventId')
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  const { data: tickets } = await supabase
    .from('tickets')
    .select('id,qr_code,user_id,event:events(title,starts_at,venue_name),tier:ticket_tiers(name),order:orders(buyer_email,buyer_name)')
    .eq('event_id', eventId)

  if (!tickets) return NextResponse.json({ tickets: [] })

  // For tickets with no buyer_email, fall back to auth.users email
  const missingIds = tickets.filter(t => !(t.order as any)?.buyer_email && t.user_id).map(t => t.user_id)
  
  const emailMap: Record<string, string> = {}
  if (missingIds.length > 0) {
    const { data: { users } } = await supabase.auth.admin.listUsers()
    for (const u of users ?? []) {
      if (missingIds.includes(u.id)) emailMap[u.id] = u.email ?? ''
    }
  }

  const enriched = tickets.map(t => ({
    id: t.id,
    qr_code: t.qr_code,
    email: (t.order as any)?.buyer_email || emailMap[t.user_id] || null,
    name: (t.order as any)?.buyer_name || null,
    tier: (t.tier as any)?.name ?? 'Ticket',
    event_title: (t.event as any)?.title ?? 'Event',
    event_date: (t.event as any)?.starts_at
      ? new Date((t.event as any).starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      : 'TBD',
    venue: (t.event as any)?.venue_name ?? '',
  }))

  return NextResponse.json({ tickets: enriched })
}

export async function POST(request: Request) {
  const { eventId } = await request.json()
  if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pulsetx.vercel.app'
  const res = await fetch(`${appUrl}/api/admin/blast-tickets?eventId=${eventId}`)
  const { tickets } = await res.json()

  const results: { email: string; status: 'sent' | 'failed' }[] = []

  // Group by email
  const grouped: Record<string, any[]> = {}
  for (const t of tickets) {
    if (!t.email) { results.push({ email: 'unknown', status: 'failed' }); continue }
    if (!grouped[t.email]) grouped[t.email] = []
    grouped[t.email].push(t)
  }

  // Send via /api/email which has the canonical template
  for (const [email, buyerTickets] of Object.entries(grouped)) {
    const first = buyerTickets[0]
    try {
      await fetch(`${appUrl}/api/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: email,
          event_title: first.event_title,
          event_date: first.event_date,
          venue: first.venue,
          buyer_name: first.name ?? '',
          tickets: buyerTickets.map((t: any) => ({ qr_code: t.qr_code, tier_name: t.tier })),
        }),
      })
      results.push({ email, status: 'sent' })
    } catch {
      results.push({ email, status: 'failed' })
    }
  }

  return NextResponse.json({ results })
}