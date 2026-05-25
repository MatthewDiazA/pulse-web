import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const eventId = searchParams.get('id')

  let title = 'Pulse Event'
  let date = ''
  let venue = ''
  let coverUrl = ''
  let price = ''

  if (eventId) {
    try {
      // Use REST API directly — edge runtime can't use supabase-js Node client
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/events?id=eq.${eventId}&select=title,starts_at,venue_name,city,cover_image_url,ticket_tiers(price)&limit=1`
      const res = await fetch(url, {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      })
      const rows = await res.json()
      const event = rows?.[0]

      if (event) {
        title = event.title ?? 'Pulse Event'
        venue = [event.venue_name, event.city].filter(Boolean).join(' · ')
        date = event.starts_at
          ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
          : ''
        coverUrl = event.cover_image_url ?? ''
        const prices = (event.ticket_tiers ?? []).map((t: any) => Number(t.price)).filter((p: number) => p > 0)
        if (prices.length > 0) price = `From $${Math.min(...prices)}`
      }
    } catch {}
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          position: 'relative',
          background: '#000',
          fontFamily: 'sans-serif',
        }}
      >
        {coverUrl && (
          <img
            src={coverUrl}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5 }}
          />
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 100%)',
          display: 'flex',
        }}/>
        <div style={{ position: 'relative', padding: '60px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ fontSize: '36px', fontWeight: 900, color: '#ffaa33', letterSpacing: '4px', display: 'flex' }}>
            pulse
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {date && (
              <div style={{ fontSize: '18px', color: 'rgba(255,170,51,0.8)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px', display: 'flex' }}>
                {date}
              </div>
            )}
            <div style={{ fontSize: '96px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', lineHeight: 0.9, marginBottom: '24px', display: 'flex' }}>
              {title}
            </div>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              {venue && <div style={{ fontSize: '22px', color: 'rgba(255,255,255,0.6)', display: 'flex' }}>{venue}</div>}
              {price && <div style={{ fontSize: '22px', color: '#ffaa33', fontWeight: 700, display: 'flex' }}>{price}</div>}
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}