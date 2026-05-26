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

  const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/blast-tickets?eventId=${eventId}`)
  const { tickets } = await res.json()

  const results: { email: string; status: 'sent' | 'failed' }[] = []

  for (const t of tickets) {
    if (!t.email) { results.push({ email: 'unknown', status: 'failed' }); continue }
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(t.qr_code)}`

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#000;font-family:Arial,sans-serif;color:#f0f0f0;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;padding:40px 20px;">
<tr><td>
  <div style="font-size:28px;font-weight:900;letter-spacing:5px;color:#ffaa33;margin-bottom:32px;font-family:Impact,sans-serif;text-transform:lowercase;">pulse</div>
  <div style="background:#0d0800;border:1px solid rgba(255,170,51,0.2);border-radius:16px;overflow:hidden;margin-bottom:20px;">
    <div style="height:3px;background:linear-gradient(90deg,#ff6600,#ffaa33,#ffc850);"></div>
    <div style="padding:28px;text-align:center;">
      <div style="font-size:11px;letter-spacing:3px;color:#888;text-transform:uppercase;margin-bottom:10px;">You're on the list</div>
      <div style="font-size:32px;font-weight:900;color:#fff;text-transform:uppercase;margin-bottom:6px;">${t.event_title}</div>
      <div style="font-size:13px;color:#888;">${t.tier} · ${t.event_date}${t.venue ? ` · ${t.venue}` : ''}</div>
    </div>
    <div style="padding:0 28px 28px;text-align:center;">
      <div style="background:#fff;border-radius:10px;padding:14px;display:inline-block;">
        <img src="${qrUrl}" width="180" height="180" alt="QR Code" style="display:block;"/>
      </div>
      <div style="margin-top:10px;font-size:11px;color:#666;letter-spacing:1px;text-transform:uppercase;">Show this at the door</div>
    </div>
  </div>
</td></tr>
</table>
</body></html>`

    try {
      await resend.emails.send({
        from: 'PULSE <tickets@pulsetickets.vip>',
        to: t.email,
        subject: `Your ticket to ${t.event_title}`,
        html,
      })
      results.push({ email: t.email, status: 'sent' })
    } catch {
      results.push({ email: t.email, status: 'failed' })
    }
  }

  return NextResponse.json({ results })
}