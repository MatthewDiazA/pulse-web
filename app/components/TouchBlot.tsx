'use client'
import { useEffect, useRef, useCallback } from 'react'

// Color stops cycling through the acid palette based on hold duration
const HOLD_COLORS = [
  { ms: 0,    color: '#ffaa33', glow: 'rgba(255,170,51,0.8)'  }, // amber   — instant
  { ms: 300,  color: '#ff6600', glow: 'rgba(255,102,0,0.8)'   }, // orange  — 300ms
  { ms: 700,  color: '#e8001d', glow: 'rgba(232,0,29,0.8)'    }, // red     — 700ms
  { ms: 1200, color: '#c01a6f', glow: 'rgba(192,26,111,0.8)'  }, // magenta — 1.2s
  { ms: 2000, color: '#7b2fff', glow: 'rgba(123,47,255,0.8)'  }, // violet  — 2s
]

type Blot = {
  id: number
  x: number
  y: number
  color: string
  glow: string
  born: number
  colorIdx: number
  phase: 'expanding' | 'holding' | 'fading'
}

function haptic(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {}
}

export default function TouchBlot() {
  const blots = useRef<Map<number, Blot>>(new Map())
  const holdTimers = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map())
  const fadeTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const counter = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  // ── Draw loop ──────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const now = Date.now()

    for (const [id, blot] of blots.current) {
      const age = now - blot.born
      const EXPAND = 600   // ms to reach full size
      const FADE   = 3000  // ms to fade out once fading starts — longer for drawing

      let size = 0
      let alpha = 1

      if (blot.phase === 'expanding') {
        const t = Math.min(age / EXPAND, 1)
        size = (1 - Math.pow(2, -10 * t)) * 280
        alpha = 0.38
      } else if (blot.phase === 'holding') {
        size = 280
        alpha = 0.32 + 0.06 * Math.sin(now * 0.004)
      } else {
        // fading
        const fadeAge = age - (blot as any)._fadeStart
        const t = Math.min(fadeAge / FADE, 1)
        size = 280 + t * 60
        alpha = 1 - t
        if (alpha <= 0) {
          blots.current.delete(id)
          continue
        }
      }

      // Outer glow
      const grad = ctx.createRadialGradient(blot.x, blot.y, 0, blot.x, blot.y, size)
      grad.addColorStop(0,   hexToRgba(blot.color, alpha * 0.9))
      grad.addColorStop(0.3, hexToRgba(blot.color, alpha * 0.55))
      grad.addColorStop(0.7, hexToRgba(blot.color, alpha * 0.18))
      grad.addColorStop(1,   hexToRgba(blot.color, 0))

      ctx.globalCompositeOperation = 'screen'
      ctx.beginPath()
      ctx.arc(blot.x, blot.y, size, 0, Math.PI * 2)
      ctx.fillStyle = grad
      ctx.fill()

      // Hot core
      const core = ctx.createRadialGradient(blot.x, blot.y, 0, blot.x, blot.y, size * 0.18)
      core.addColorStop(0, hexToRgba('#ffffff', alpha * 0.35))
      core.addColorStop(1, hexToRgba(blot.color, 0))
      ctx.beginPath()
      ctx.arc(blot.x, blot.y, size * 0.18, 0, Math.PI * 2)
      ctx.fillStyle = core
      ctx.fill()
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [])

  // ── Resize ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)
    rafRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  // ── Touch / pointer handlers ───────────────────────────────────────────────
  const startBlot = useCallback((pointerId: number, x: number, y: number) => {
    const id = ++counter.current
    ;(startBlot as any)._pointerToBlot = (startBlot as any)._pointerToBlot ?? new Map()
    ;(startBlot as any)._pointerToBlot.set(pointerId, id)

    const blot: Blot = {
      id,
      x,
      y,
      color: HOLD_COLORS[0].color,
      glow: HOLD_COLORS[0].glow,
      born: Date.now(),
      colorIdx: 0,
      phase: 'expanding',
    }
    blots.current.set(id, blot)

    haptic(10) // short tap

    // After expand phase, move to holding
    const expandTimer = setTimeout(() => {
      const b = blots.current.get(id)
      if (b && b.phase === 'expanding') b.phase = 'holding'
    }, 600)

    // Color progression on hold
    let colorIdx = 0
    const colorTimer = setInterval(() => {
      const b = blots.current.get(id)
      if (!b || b.phase === 'fading') return
      const next = colorIdx + 1
      if (next >= HOLD_COLORS.length) return
      const nextStop = HOLD_COLORS[next]
      const holdAge = Date.now() - b.born
      if (holdAge >= nextStop.ms) {
        colorIdx = next
        b.color = nextStop.color
        b.glow = nextStop.glow
        haptic([15, 10, 15]) // color-change pulse
      }
    }, 100)

    holdTimers.current.set(id, colorTimer)
    ;(startBlot as any)._expandTimers = (startBlot as any)._expandTimers ?? new Map()
    ;(startBlot as any)._expandTimers.set(id, expandTimer)
    ;(startBlot as any)._pointerToBlot.set(pointerId, id)
  }, [])

  const endBlot = useCallback((pointerId: number) => {
    const map: Map<number, number> = (startBlot as any)._pointerToBlot
    if (!map) return
    const id = map.get(pointerId)
    if (id == null) return
    map.delete(pointerId)

    const colorTimer = holdTimers.current.get(id)
    if (colorTimer) { clearInterval(colorTimer); holdTimers.current.delete(id) }

    const b = blots.current.get(id)
    if (b && b.phase !== 'fading') {
      b.phase = 'fading'
      ;(b as any)._fadeStart = Date.now() - b.born
      haptic(5) // release pulse
    }
  }, [startBlot])

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      startBlot(e.pointerId, e.clientX, e.clientY)
    }
    const onUp = (e: PointerEvent) => endBlot(e.pointerId)
    const onCancel = (e: PointerEvent) => endBlot(e.pointerId)

    window.addEventListener('pointerdown', onDown, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)

    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [startBlot, endBlot])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 10,
        mixBlendMode: 'screen',
      }}
    />
  )
}

// ── Util ───────────────────────────────────────────────────────────────────
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`
}