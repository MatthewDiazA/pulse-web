// app/api/ics/route.ts
// "Add to calendar" file for Apple Calendar / Outlook. Times are stored as wall-clock
// values in UTC fields, so they're written as floating times (no Z) to land at the
// same clock time the event page shows.
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}00`
}

// RFC 5545 text escaping
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return new Response('Missing id', { status: 400 })

  const { data: event } = await supabase
    .from('events')
    .select('id, title, starts_at, ends_at, venue_name, address, city, state')
    .eq('id', id)
    .single()
  if (!event?.starts_at) return new Response('Event not found', { status: 404 })

  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + 5 * 3600000)
  const url = `${process.env.NEXT_PUBLIC_APP_URL || origin}/events/${event.id}`
  const location = [event.venue_name, event.address, event.city, event.state].map(x => x?.trim()).filter(Boolean).join(', ')
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pulse//Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@pulse`,
    `DTSTAMP:${now}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(event.title.trim())}`,
    location && `LOCATION:${esc(location)}`,
    `URL:${url}`,
    `DESCRIPTION:${esc(`Tickets: ${url}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n')

  const filename = event.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'event'
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}.ics"`,
    },
  })
}
