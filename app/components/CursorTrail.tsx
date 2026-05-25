'use client'
import { useEffect, useRef } from 'react'

const TRAIL_LENGTH = 20
const COLORS = ['#ffaa33', '#ff6600', '#e8001d', '#c01a6f', '#7b2fff']

export default function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // Desktop only
    if (window.matchMedia('(pointer: coarse)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = window.innerWidth
    let H = window.innerHeight
    canvas.width = W
    canvas.height = H

    const resize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W
      canvas.height = H
    }
    window.addEventListener('resize', resize)

    // Trail points
    const trail: { x: number; y: number; age: number; color: string }[] = []
    let mouse = { x: -999, y: -999 }
    let colorIndex = 0
    let frameCount = 0

    const onMove = (e: MouseEvent) => {
      mouse = { x: e.clientX, y: e.clientY }
      frameCount++
      if (frameCount % 2 === 0) { // every other frame
        trail.push({
          x: mouse.x,
          y: mouse.y,
          age: 0,
          color: COLORS[colorIndex % COLORS.length],
        })
        if (trail.length > TRAIL_LENGTH) trail.shift()
        colorIndex++
      }
    }
    window.addEventListener('mousemove', onMove)

    let raf = 0
    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      for (let i = 0; i < trail.length; i++) {
        const p = trail[i]
        p.age++
        const life = 1 - p.age / 40
        if (life <= 0) continue

        const size = (i / trail.length) * 8 * life
        const alpha = life * 0.6

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 3)
        grad.addColorStop(0, p.color.replace(')', `,${alpha})`).replace('rgb', 'rgba'))
        grad.addColorStop(1, 'rgba(0,0,0,0)')

        ctx.globalCompositeOperation = 'screen'
        ctx.beginPath()
        ctx.arc(p.x, p.y, size * 3, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Hot core
        ctx.beginPath()
        ctx.arc(p.x, p.y, size * 0.4, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`
        ctx.fill()
      }

      // Remove dead points
      for (let i = trail.length - 1; i >= 0; i--) {
        if (trail[i].age > 40) trail.splice(i, 1)
      }

      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, width: '100vw', height: '100vh',
        pointerEvents: 'none', zIndex: 9999, mixBlendMode: 'screen',
      }}
    />
  )
}