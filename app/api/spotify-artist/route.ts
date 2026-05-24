// app/api/spotify-artist/route.ts
// Search Spotify for artist photo + genre by name
import { NextResponse } from 'next/server'

let tokenCache: { token: string; expires: number } | null = null

async function getToken() {
  if (tokenCache && Date.now() < tokenCache.expires) return tokenCache.token
  const creds = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  tokenCache = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 }
  return data.access_token
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const name = searchParams.get('name')
    if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })

    const token = await getToken()
    const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    const artist = data.artists?.items?.[0]

    if (!artist) return NextResponse.json({ found: false })

    return NextResponse.json({
      found: true,
      name: artist.name,
      image: artist.images?.[0]?.url ?? null,
      genres: artist.genres?.slice(0, 2) ?? [],
      followers: artist.followers?.total ?? 0,
      spotify_url: artist.external_urls?.spotify ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}