// app/api/spotify-preview/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'edge'

function parseSpotify(url: string): { type: string; id: string } | null {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('spotify.com')) return null
    const parts = u.pathname.split('/').filter(Boolean).filter(p => !/^intl-/i.test(p))
    if (parts.length < 2) return null
    return { type: parts[0], id: parts[1].split('?')[0] }
  } catch { return null }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ preview: null, error: 'Missing url' })

  const parsed = parseSpotify(url)
  if (!parsed) return NextResponse.json({ preview: null, error: 'Not a Spotify URL' })

  try {
    const embedUrl = `https://open.spotify.com/embed/${parsed.type}/${parsed.id}`

    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    if (!res.ok) {
      return NextResponse.json({ preview: null, error: `Spotify embed returned ${res.status}` })
    }

    const html = await res.text()
    const hasNextData = html.includes('__NEXT_DATA__')
    const hasAudioPreview = html.includes('audioPreview')

    // Parse __NEXT_DATA__ script tag
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/)
    if (nextDataMatch) {
      try {
        const json = JSON.parse(nextDataMatch[1])
        const entity = json?.props?.pageProps?.state?.data?.entity
        const preview = entity?.audioPreview?.url ?? null
        const title = entity?.name ?? null
        const artist = entity?.artists?.[0]?.name ?? null

        if (preview) {
          return NextResponse.json({ preview, title, artist })
        }

        // Return debug info so we can see the shape
        return NextResponse.json({
          preview: null,
          error: 'audioPreview not in entity',
          debug: {
            hasNextData,
            hasAudioPreview,
            entityKeys: entity ? Object.keys(entity) : null,
            type: parsed.type,
            id: parsed.id,
          }
        })
      } catch (parseErr: any) {
        return NextResponse.json({ preview: null, error: 'JSON parse failed: ' + parseErr.message, debug: { hasNextData, hasAudioPreview } })
      }
    }

    // No __NEXT_DATA__ at all — return what we can see
    return NextResponse.json({
      preview: null,
      error: 'No __NEXT_DATA__ found',
      debug: {
        hasNextData,
        hasAudioPreview,
        htmlLength: html.length,
        htmlSnippet: html.slice(0, 200),
      }
    })

  } catch (err: any) {
    return NextResponse.json({ preview: null, error: err.message })
  }
}