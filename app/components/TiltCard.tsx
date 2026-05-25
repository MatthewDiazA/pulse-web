'use client'
import { useRef, useEffect, ReactNode } from 'react'
import { gsap } from 'gsap'

interface TiltCardProps {
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  intensity?: number // 0-1
  onClick?: () => void
}

export default function TiltCard({ children, className, style, intensity = 1, onClick }: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const glareRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const MAX_TILT = 12 * intensity
    const MAX_GLARE = 0.25 * intensity

    const onMove = (e: MouseEvent | TouchEvent) => {
      const rect = card.getBoundingClientRect()
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY
      const x = (clientX - rect.left) / rect.width   // 0-1
      const y = (clientY - rect.top) / rect.height    // 0-1
      const tiltX = (y - 0.5) * -MAX_TILT * 2
      const tiltY = (x - 0.5) * MAX_TILT * 2

      gsap.to(card, {
        rotateX: tiltX,
        rotateY: tiltY,
        transformPerspective: 800,
        ease: 'power2.out',
        duration: 0.4,
      })

      // Glare highlight
      if (glareRef.current) {
        const glareX = x * 100
        const glareY = y * 100
        const glareAlpha = Math.sqrt((x - 0.5) ** 2 + (y - 0.5) ** 2) * MAX_GLARE
        gsap.to(glareRef.current, {
          background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,${glareAlpha}) 0%, transparent 60%)`,
          duration: 0.3,
        })
      }
    }

    const onLeave = () => {
      gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.6, ease: 'elastic.out(1, 0.5)' })
      if (glareRef.current) {
        gsap.to(glareRef.current, { background: 'transparent', duration: 0.4 })
      }
    }

    // Gyroscope support on mobile
    const onGyro = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return
      const tiltX = Math.max(-MAX_TILT, Math.min(MAX_TILT, (e.beta - 45) * 0.5))
      const tiltY = Math.max(-MAX_TILT, Math.min(MAX_TILT, e.gamma * 0.5))
      gsap.to(card, { rotateX: -tiltX, rotateY: tiltY, transformPerspective: 800, ease: 'power2.out', duration: 0.6 })
    }

    card.addEventListener('mousemove', onMove)
    card.addEventListener('mouseleave', onLeave)
    card.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('deviceorientation', onGyro)

    return () => {
      card.removeEventListener('mousemove', onMove)
      card.removeEventListener('mouseleave', onLeave)
      card.removeEventListener('touchmove', onMove)
      window.removeEventListener('deviceorientation', onGyro)
    }
  }, [intensity])

  return (
    <div
      ref={cardRef}
      className={className}
      style={{ ...style, transformStyle: 'preserve-3d', willChange: 'transform', cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
    >
      {children}
      {/* Glare layer */}
      <div
        ref={glareRef}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, borderRadius: 'inherit',
          pointerEvents: 'none', zIndex: 5, transition: 'background 0.3s',
        }}
      />
    </div>
  )
}