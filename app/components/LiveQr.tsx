'use client'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { liveCode, QR_STEP_SECONDS } from '../lib/liveQr'

// The ticket holder's QR. With a secret it rotates every 20s (screenshots go stale at the door);
// tickets issued before live codes fall back to their fixed code.
export default function LiveQr({ ticketId, secret, staticCode, dim = false, size = 260 }: {
  ticketId: string
  secret: string | null
  staticCode: string
  dim?: boolean
  size?: number
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [left, setLeft] = useState(QR_STEP_SECONDS)

  useEffect(() => {
    let alive = true
    let lastWindow = -1
    const draw = async () => {
      const now = Date.now()
      const secs = now / 1000
      const window = Math.floor(secs / QR_STEP_SECONDS)
      setLeft(Math.ceil(QR_STEP_SECONDS - (secs % QR_STEP_SECONDS)))
      if (window === lastWindow) return
      lastWindow = window
      const value = secret ? await liveCode(ticketId, secret, now) : staticCode
      const url = await QRCode.toDataURL(value, { width: size * 2, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      if (alive) setSrc(url)
    }
    draw()
    const t = secret ? setInterval(draw, 1000) : undefined
    return () => { alive = false; if (t) clearInterval(t) }
  }, [ticketId, secret, staticCode, size])

  return (
    <div style={{ width: '100%', maxWidth: size, margin: '0 auto' }}>
      {src
        ? <img src={src} alt="Ticket QR code" style={{ width: '100%', aspectRatio: '1', display: 'block', imageRendering: 'pixelated', opacity: dim ? 0.25 : 1 }}/>
        : <div style={{ width: '100%', aspectRatio: '1', background: '#f2f2f2', borderRadius: 8 }}/>}
      {secret && !dim && (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 3, background: 'rgba(0,0,0,0.1)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(left / QR_STEP_SECONDS) * 100}%`, background: '#1a8f4c', transition: 'width 1s linear' }}/>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: 'rgba(0,0,0,0.5)', textAlign: 'center' }}>
            Live code · refreshes in {left}s · screenshots won&apos;t scan
          </div>
        </div>
      )}
    </div>
  )
}
