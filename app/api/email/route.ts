import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { buildTicketEmail } from '../../lib/ticketEmail'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { to, event_title, event_date, venue, tier_name, qr_code, buyer_name, custom_html, subject, tickets: multiTickets } = body

    // Path 1: custom_html override (legacy)
    if (custom_html) {
      await resend.emails.send({
        from: 'PULSE <tickets@pulsetickets.vip>',
        to,
        subject: subject ?? `Your ticket to ${event_title}`,
        html: custom_html,
      })
      return NextResponse.json({ success: true })
    }

    // Path 2: multi-ticket array
    if (multiTickets && Array.isArray(multiTickets)) {
      const html = buildTicketEmail({
        buyer_name,
        event_title,
        event_date,
        venue,
        tickets: multiTickets,
      })
      await resend.emails.send({
        from: 'PULSE <tickets@pulsetickets.vip>',
        to,
        subject: multiTickets.length > 1
          ? `Your ${multiTickets.length} tickets to ${event_title}`
          : `Your ticket to ${event_title}`,
        html,
      })
      return NextResponse.json({ success: true })
    }

    // Path 3: single ticket (default)
    const html = buildTicketEmail({
      buyer_name,
      event_title,
      event_date,
      venue,
      tickets: [{ qr_code, tier_name }],
    })

    await resend.emails.send({
      from: 'PULSE <tickets@pulsetickets.vip>',
      to,
      subject: `Your ticket to ${event_title}`,
      html,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Email error:', error)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}