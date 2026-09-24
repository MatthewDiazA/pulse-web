import { ImageResponse } from 'next/og'

export const runtime = 'edge'

// Brand condensed face for the title. Google serves TTF to non-browser clients, which is what satori needs.
async function loadFont(weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@${weight}`)).text()
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1]
    return url ? await (await fetch(url)).arrayBuffer() : null
  } catch { return null }
}

// Link-preview card (iMessage, IG, X). The flyer is the design: shown crisp on the right,
// and stretched dim across the background so its colors fill the card.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
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
        title = (event.title ?? 'Pulse Event').trim()
        venue = [event.venue_name, event.city].filter(Boolean).join(' · ')
        date = event.starts_at
          ? new Date(event.starts_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
          : ''
        coverUrl = event.cover_image_url ?? ''
        const prices = (event.ticket_tiers ?? []).map((t: { price: unknown }) => Number(t.price)).filter((p: number) => p > 0)
        if (prices.length > 0) price = `From $${Math.min(...prices)}`
      }
    } catch {}
  }

  const titleSize = title.length > 22 ? 76 : title.length > 14 ? 96 : 116
  const [bold, semi] = await Promise.all([loadFont(800), loadFont(600)])
  const fonts = [bold && { name: 'Barlow', data: bold, weight: 800 as const }, semi && { name: 'Barlow', data: semi, weight: 600 as const }].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 800 | 600 }[]
  const face = fonts.length ? 'Barlow' : 'sans-serif'

  return new ImageResponse(
    (
      <div style={{ width: '1200px', height: '630px', display: 'flex', position: 'relative', background: '#000', fontFamily: face }}>
        {coverUrl && (
          <img src={coverUrl} style={{ position: 'absolute', top: 0, left: 0, width: '1200px', height: '630px', objectFit: 'cover', opacity: 0.35 }}/>
        )}
        <div style={{ position: 'absolute', top: 0, left: 0, width: '1200px', height: '630px', display: 'flex', backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0.96) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.4) 100%)' }}/>

        <div style={{ position: 'relative', display: 'flex', width: '100%', padding: '60px', gap: '56px', alignItems: 'center' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
            <img src={`${origin}/pulse-word-tight.png`} width={151} height={40} style={{ width: '151px', height: '40px' }}/>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {date && (
                <div style={{ fontSize: '26px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', letterSpacing: '5px', textTransform: 'uppercase', marginBottom: '18px', display: 'flex' }}>
                  {date}
                </div>
              )}
              <div style={{ fontSize: `${titleSize}px`, fontWeight: 800, color: '#fff', textTransform: 'uppercase', lineHeight: 0.9, marginBottom: '28px', display: 'flex' }}>
                {title}
              </div>
              <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                {price && (
                  <div style={{ fontSize: '26px', fontWeight: 800, color: '#000', background: '#fff', padding: '10px 22px', borderRadius: '999px', display: 'flex' }}>
                    {price}
                  </div>
                )}
                {venue && <div style={{ fontSize: '28px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', textTransform: 'uppercase', letterSpacing: '1px', display: 'flex' }}>{venue}</div>}
              </div>
            </div>
          </div>

          {coverUrl && (
            <div style={{ display: 'flex', width: '384px', height: '480px', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }}>
              <img src={coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
            </div>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630, fonts }
  )
}
