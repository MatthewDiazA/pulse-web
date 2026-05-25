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

async function scrapeEmbed(type: string, id: string): Promise<{ preview: string | null; title: string | null; artist: string | null }> {
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}`
  const res = await fetch(embedUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) return { preview: null, title: null, artist: null }
  const html = await res.text()

  // Extract __NEXT_DATA__ JSON blob — this is where audioPreview lives now
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__[^>]*>([^<]+)<\/script>/)
  if (nextDataMatch) {
    try {
      const json = JSON.parse(nextDataMatch[1])
      const entity = json?.props?.pageProps?.state?.data?.entity

      if (entity) {
        const preview = entity?.audioPreview?.url ?? null
        const title = entity?.name ?? null
        const artist = entity?.artists?.[0]?.name ?? entity?.subtitle ?? null
        if (preview) return { preview, title, artist }
      }

      // For playlists — dig into trackList
      const trackList = json?.props?.pageProps?.state?.data?.trackList
      if (trackList) {
        for (const item of trackList) {
          const p = item?.audioPreview?.url ?? item?.track?.audioPreview?.url
          if (p) {
            return {
              preview: p,
              title: item?.title ?? item?.track?.name ?? null,
              artist: item?.subtitle ?? item?.track?.artists?.[0]?.name ?? null,
            }
          }
        }
      }
    } catch {}
  }

  // Fallback regex patterns directly in HTML
  const previewMatch = html.match(/"audioPreview"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/)
  if (previewMatch) {
    const preview = previewMatch[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/')
    const titleMatch = html.match(/"name"\s*:\s*"([^"]+)"/)
    const artistMatch = html.match(/"subtitle"\s*:\s*"([^"]+)"/)
    return {
      preview,
      title: titleMatch ? titleMatch[1] : null,
      artist: artistMatch ? artistMatch[1] : null,
    }
  }

  return { preview: null, title: null, artist: null }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) return NextResponse.json({ preview: null, error: 'Missing url' })

  const parsed = parseSpotify(url)
  if (!parsed) return NextResponse.json({ preview: null, error: 'Not a Spotify URL' })

  try {
    // For playlists, try to get a track first then scrape that track's embed
    // since playlist embeds don't always expose individual previews
    let result = await scrapeEmbed(parsed.type, parsed.id)

    return NextResponse.json({
      preview: result.preview,
      title: result.title,
      artist: result.artist,
      type: parsed.type,
      id: parsed.id,
    })
  } catch (err: any) {
    return NextResponse.json({ preview: null, error: err.message })
  }
}