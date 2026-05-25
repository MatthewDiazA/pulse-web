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

async function scrapeTrackPreview(trackId: string): Promise<{ preview: string | null; title: string | null; artist: string | null }> {
  const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) return { preview: null, title: null, artist: null }
  const html = await res.text()

  const nextDataMatch = html.match(/<script id="__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/)
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1])
      const entity = json?.props?.pageProps?.state?.data?.entity
      if (entity?.audioPreview?.url) {
        return {
          preview: entity.audioPreview.url,
          title: entity.name ?? null,
          artist: entity.artists?.[0]?.name ?? null,
        }
      }
    } catch {}
  }

  // Fallback regex
  const m = html.match(/"audioPreview"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/)
  if (m) {
    return {
      preview: m[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/'),
      title: (html.match(/"name"\s*:\s*"([^"]+)"/) ?? [])[1] ?? null,
      artist: (html.match(/"subtitle"\s*:\s*"([^"]+)"/) ?? [])[1] ?? null,
    }
  }

  return { preview: null, title: null, artist: null }
}

async function getFirstTrackId(type: string, id: string): Promise<string | null> {
  const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) return null
  const html = await res.text()

  // Try __NEXT_DATA__ first
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/)
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1])
      // Albums store tracks in entity.tracks.items
      const items = json?.props?.pageProps?.state?.data?.entity?.tracks?.items
        ?? json?.props?.pageProps?.state?.data?.entity?.items
        ?? json?.props?.pageProps?.state?.data?.trackList
      if (items?.length > 0) {
        for (const item of items) {
          const uri = item?.uri ?? item?.track?.uri
          if (uri?.startsWith('spotify:track:')) return uri.split(':')[2]
        }
      }
    } catch {}
  }

  // Fallback: find any track URI in raw HTML
  const uriMatch = html.match(/spotify:track:([a-zA-Z0-9]{22})/)
  if (uriMatch) return uriMatch[1]

  const hrefMatch = html.match(/\/track\/([a-zA-Z0-9]{22})/)
  if (hrefMatch) return hrefMatch[1]

  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ preview: null, error: 'Missing url' })

  const parsed = parseSpotify(url)
  if (!parsed) return NextResponse.json({ preview: null, error: 'Not a Spotify URL' })

  try {
    // Direct track — scrape immediately
    if (parsed.type === 'track') {
      const result = await scrapeTrackPreview(parsed.id)
      return NextResponse.json({ preview: result.preview, title: result.title, artist: result.artist })
    }

    // Album, playlist, artist — find first track then scrape it
    const trackId = await getFirstTrackId(parsed.type, parsed.id)
    if (!trackId) return NextResponse.json({ preview: null, error: `Could not find track in ${parsed.type}` })

    const result = await scrapeTrackPreview(trackId)
    return NextResponse.json({ preview: result.preview, title: result.title, artist: result.artist })

  } catch (err: any) {
    return NextResponse.json({ preview: null, error: err.message })
  }
}