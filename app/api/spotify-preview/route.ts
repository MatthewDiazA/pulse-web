import { NextResponse } from 'next/server'

// Resolve a Spotify URL to a 30-second preview MP3 (when available).
// Strategy (no auth, no API key):
//   1. Normalize the link to an open.spotify.com/{type}/{id} URL.
//   2. Fetch the public embed page (open.spotify.com/embed/...) which inlines
//      a JSON blob containing audioPreview.url for tracks.
//   3. Parse the preview URL out of that payload.
// Falls back gracefully (preview: null) so the client can show the visual embed.

export const runtime = 'edge'

function normalize(raw: string): { type: string; id: string } | null {
  try {
    const u = new URL(raw)
    if (!u.hostname.includes('spotify.com')) return null
    const parts = u.pathname.split('/').filter(Boolean)
    // handle /intl-xx/ prefixes
    const cleaned = parts.filter(p => !/^intl-/i.test(p))
    if (cleaned.length < 2) return null
    const [type, id] = cleaned
    return { type, id: id.split('?')[0] }
  } catch {
    return null
  }
}

function extractPreview(html: string): { preview: string | null; title: string | null; artist: string | null; image: string | null } {
  let preview: string | null = null
  let title: string | null = null
  let artist: string | null = null
  let image: string | null = null

  // The embed page inlines a __NEXT_DATA__ / resource JSON. Pull the first
  // audioPreview url and basic metadata via tolerant regexes.
  const previewMatch = html.match(/"audioPreview"\s*:\s*\{\s*"url"\s*:\s*"([^"]+)"/)
    || html.match(/"preview_url"\s*:\s*"([^"]+)"/)
  if (previewMatch) preview = previewMatch[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/')

  const titleMatch = html.match(/"title"\s*:\s*"([^"]+)"/) || html.match(/<meta property="og:title" content="([^"]+)"/)
  if (titleMatch) title = decodeHtml(titleMatch[1])

  const artistMatch = html.match(/"subtitle"\s*:\s*"([^"]+)"/) || html.match(/"artists?"\s*:\s*\[\s*\{\s*"name"\s*:\s*"([^"]+)"/)
  if (artistMatch) artist = decodeHtml(artistMatch[1])

  const imageMatch = html.match(/"image_?[Uu]rl"\s*:\s*"([^"]+)"/)
    || html.match(/<meta property="og:image" content="([^"]+)"/)
    || html.match(/"url"\s*:\s*"(https:\/\/i\.scdn\.co\/image\/[^"]+)"/)
  if (imageMatch) image = imageMatch[1].replace(/\\u002F/g, '/').replace(/\\\//g, '/')

  return { preview, title, artist, image }
}

function decodeHtml(s: string): string {
  return s
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\\"/g, '"')
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 })
  }

  const norm = normalize(url)
  if (!norm) {
    return NextResponse.json({ preview: null, error: 'Not a Spotify URL' })
  }

  try {
    const embedUrl = `https://open.spotify.com/embed/${norm.type}/${norm.id}`
    const res = await fetch(embedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      // cache previews at the edge for a day — they don't change
      next: { revalidate: 86400 },
    })

    if (!res.ok) {
      return NextResponse.json({ preview: null, error: `Spotify responded ${res.status}` })
    }

    const html = await res.text()
    const data = extractPreview(html)

    return NextResponse.json({
      preview: data.preview,
      title: data.title,
      artist: data.artist,
      image: data.image,
      type: norm.type,
      id: norm.id,
    })
  } catch (err: any) {
    return NextResponse.json({ preview: null, error: err?.message ?? 'fetch failed' })
  }
}