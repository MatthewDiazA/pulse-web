'use client'
import { useEffect, useRef, useCallback } from 'react'

const HOLD_COLORS = [
  { ms: 0,    color: '#ffaa33' },
  { ms: 400,  color: '#ff6600' },
  { ms: 900,  color: '#e8001d' },
  { ms: 1500, color: '#c01a6f' },
  { ms: 2500, color: '#7b2fff' },
]

function getMaxSize(intensity: number) {
  const base = typeof window !== 'undefined' && window.innerWidth <= 768 ? 110 : 224
  return base * intensity
}

type Blot = {
  id: number
  x: number
  y: number
  color: string
  born: number
  colorIdx: number
  phase: 'expanding' | 'holding' | 'fading'
  _fadeStart?: number
}

function haptic(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern)
  } catch {}
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`
}

interface TouchBlotProps {
  // 1.0 = full homepage intensity, 0.5 = half size + half opacity
  intensity?: number
}

export default function TouchBlot({ intensity = 1.0 }: TouchBlotProps) {
  const blots = useRef<Map<number, Blot>>(new Map())
  const holdTimers = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map())
  const pointerToBlot = useRef<Map<number, number>>(new Map())
  const expandTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const counter = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const now = Date.now()
    const MAX = getMaxSize(intensity)
    const EXPAND = 500
    const FADE = 1200
    // Scale opacity by intensity so low-intensity blots are dimmer
    const alphaScale = 0.4 + 0.6 * intensity

    for (const [id, blot] of blots.current) {
      const age = now - blot.born
      let size = 0
      let alpha = 1

      if (blot.phase === 'expanding') {
        const t = Math.min(age / EXPAND, 1)
        size = (1 - Math.pow(2, -10 * t)) * MAX
        alpha = 0.65 * alphaScale
      } else if (blot.phase === 'holding') {
        size = MAX
        alpha = (0.55 + 0.08 * Math.sin(now * 0.004)) * alphaScale
      } else {
        const fadeAge = age - (blot._fadeStart ?? 0)
        const t = Math.min(fadeAge / FADE, 1)
        size = MAX + t * (MAX * 0.2)
        alpha = (1 - t) * alphaScale
        if (alpha <= 0) { blots.current.delete(id); continue }
      }

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

      const coreSize = size * (window.innerWidth <= 768 ? 0.12 : 0.18)
      const core = ctx.createRadialGradient(blot.x, blot.y, 0, blot.x, blot.y, coreSize)
      core.addColorStop(0, hexToRgba('#ffffff', alpha * 0.55 * intensity))
      core.addColorStop(1, hexToRgba(blot.color, 0))
      ctx.beginPath()
      ctx.arc(blot.x, blot.y, coreSize, 0, Math.PI * 2)
      ctx.fillStyle = core
      ctx.fill()
    }

    rafRef.current = requestAnimationFrame(draw)
  }, [intensity])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    rafRef.current = requestAnimationFrame(draw)
    return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(rafRef.current) }
  }, [draw])

  const startBlot = useCallback((pointerId: number, x: number, y: number) => {
    const id = ++counter.current
    pointerToBlot.current.set(pointerId, id)
    const blot: Blot = { id, x, y, color: HOLD_COLORS[0].color, born: Date.now(), colorIdx: 0, phase: 'expanding' }
    blots.current.set(id, blot)
    haptic(8)

    const expandTimer = setTimeout(() => {
      const b = blots.current.get(id)
      if (b && b.phase === 'expanding') b.phase = 'holding'
    }, 500)
    expandTimers.current.set(id, expandTimer)

    let colorIdx = 0
    const colorTimer = setInterval(() => {
      const b = blots.current.get(id)
      if (!b || b.phase === 'fading') return
      const next = colorIdx + 1
      if (next >= HOLD_COLORS.length) return
      if (Date.now() - b.born >= HOLD_COLORS[next].ms) {
        colorIdx = next
        b.color = HOLD_COLORS[next].color
        haptic([12, 8, 12])
      }
    }, 80)
    holdTimers.current.set(id, colorTimer)
  }, [])

  const endBlot = useCallback((pointerId: number) => {
    const id = pointerToBlot.current.get(pointerId)
    if (id == null) return
    pointerToBlot.current.delete(pointerId)
    const colorTimer = holdTimers.current.get(id)
    if (colorTimer) { clearInterval(colorTimer); holdTimers.current.delete(id) }
    const expandTimer = expandTimers.current.get(id)
    if (expandTimer) { clearTimeout(expandTimer); expandTimers.current.delete(id) }
    const b = blots.current.get(id)
    if (b && b.phase !== 'fading') {
      b.phase = 'fading'
      b._fadeStart = Date.now() - b.born
      haptic(5)
    }
  }, [])

  useEffect(() => {
    const onDown = (e: PointerEvent) => { e.preventDefault(); startBlot(e.pointerId, e.clientX, e.clientY) }
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
      style={{ position:'fixed', inset:0, width:'100vw', height:'100vh', pointerEvents:'none', zIndex:10, mixBlendMode:'screen' }}
    />
  )
}