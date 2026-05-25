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

async function scrapeTrackEmbed(trackId: string): Promise<{ preview: string | null; title: string | null; artist: string | null }> {
  const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) return { preview: null, title: null, artist: null }
  const html = await res.text()

  const nextDataMatch = html.match(/<script id="__NEXT_DATA__[^>]*>([^<]+)<\/script>/)
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

  // Fallback direct regex
  const m = html.match(/"audioPreview"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/)
  if (m) {
    const preview = m[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/')
    const title = (html.match(/"name"\s*:\s*"([^"]+)"/) ?? [])[1] ?? null
    const artist = (html.match(/"subtitle"\s*:\s*"([^"]+)"/) ?? [])[1] ?? null
    return { preview, title, artist }
  }

  return { preview: null, title: null, artist: null }
}

async function getFirstTrackFromPlaylist(playlistId: string): Promise<string | null> {
  // Scrape the playlist embed page and extract first track ID from the tracklist
  const res = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) return null
  const html = await res.text()

  try {
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__[^>]*>([^<]+)<\/script>/)
    if (nextDataMatch) {
      const json = JSON.parse(nextDataMatch[1])
      // Try trackList first
      const trackList = json?.props?.pageProps?.state?.data?.trackList
      if (trackList?.length > 0) {
        for (const item of trackList) {
          const uri = item?.uri ?? item?.track?.uri
          if (uri) {
            const id = uri.split(':').pop()
            if (id) return id
          }
        }
      }
      // Try entity items
      const items = json?.props?.pageProps?.state?.data?.entity?.trackList
        ?? json?.props?.pageProps?.state?.data?.entity?.items
      if (items?.length > 0) {
        for (const item of items) {
          const uri = item?.uri ?? item?.track?.uri
          if (uri) {
            const id = uri.split(':').pop()
            if (id) return id
          }
        }
      }
    }
  } catch {}

  // Fallback: find any track URI in the raw HTML
  const uriMatch = html.match(/spotify:track:([a-zA-Z0-9]{22})/)
  if (uriMatch) return uriMatch[1]

  // Fallback: find track IDs in href patterns
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
    // For tracks — scrape directly
    if (parsed.type === 'track') {
      const result = await scrapeTrackEmbed(parsed.id)
      return NextResponse.json({ preview: result.preview, title: result.title, artist: result.artist })
    }

    // For playlists/albums/artists — get first track ID then scrape that track
    let trackId: string | null = null

    if (parsed.type === 'playlist') {
      trackId = await getFirstTrackFromPlaylist(parsed.id)
    } else if (parsed.type === 'album') {
      // Album embed — find track URI in HTML
      const res = await fetch(`https://open.spotify.com/embed/album/${parsed.id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36' },
      })
      const html = await res.text()
      const m = html.match(/spotify:track:([a-zA-Z0-9]{22})/) ?? html.match(/\/track\/([a-zA-Z0-9]{22})/)
      trackId = m?.[1] ?? null
    }

    if (trackId) {
      const result = await scrapeTrackEmbed(trackId)
      return NextResponse.json({ preview: result.preview, title: result.title, artist: result.artist })
    }

    return NextResponse.json({ preview: null, error: 'Could not find a previewable track' })
  } catch (err: any) {
    return NextResponse.json({ preview: null, error: err.message })
  }
}