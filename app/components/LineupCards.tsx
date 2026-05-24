'use client'
import { useEffect, useState } from 'react'

type Act = { name: string; role?: string; time?: string }
type ArtistData = { found: boolean; image?: string; genres?: string[]; spotify_url?: string }

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function ArtistCard({ act }: { act: Act }) {
  const [artist, setArtist] = useState<ArtistData | null>(null)

  useEffect(() => {
    fetch(`/api/spotify-artist?name=${encodeURIComponent(act.name)}`)
      .then(r => r.json())
      .then(setArtist)
      .catch(() => setArtist({ found: false }))
  }, [act.name])

  const loading = artist === null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '0.5px solid rgba(255,255,255,0.08)',
      borderRadius: '14px',
      overflow: 'hidden',
      transition: 'border-color 0.2s',
      cursor: artist?.spotify_url ? 'pointer' : 'default',
    }}
      onClick={() => artist?.spotify_url && window.open(artist.spotify_url, '_blank', 'noopener')}
    >
      {/* Artist photo or initials */}
      <div style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', background: 'rgba(255,170,51,0.06)' }}>
        {!loading && artist?.found && artist.image ? (
          <img src={artist.image} alt={act.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '32px', fontWeight: 900, color: 'rgba(255,170,51,0.5)' }}>
              {loading ? '···' : initials(act.name)}
            </span>
          </div>
        )}
        {/* Spotify badge if found */}
        {!loading && artist?.found && artist.spotify_url && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#1DB954', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: '12px' }}>
        <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '13px', fontWeight: 700, color: '#f0f0f0', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {act.name}
        </div>
        {(act.role || act.time) && (
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[act.role, act.time].filter(Boolean).join(' · ')}
          </div>
        )}
        {!loading && artist?.found && artist.genres && artist.genres.length > 0 && (
          <div style={{ marginTop: '6px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {artist.genres.slice(0, 1).map(g => (
              <span key={g} style={{ fontSize: '9px', color: 'rgba(255,170,51,0.7)', background: 'rgba(255,170,51,0.08)', padding: '2px 7px', borderRadius: '100px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                {g}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LineupCards({ lineup }: { lineup: Act[] }) {
  if (!lineup || lineup.length === 0) return null
  return (
    <div>
      <div style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: '13px',
        fontWeight: 700,
        color: 'rgba(255,255,255,0.3)',
        letterSpacing: '3px',
        textTransform: 'uppercase',
        marginBottom: '16px',
      }}>
        Lineup
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
        gap: '10px',
      }}>
        {lineup.map((act, i) => <ArtistCard key={i} act={act}/>)}
      </div>
    </div>
  )
}