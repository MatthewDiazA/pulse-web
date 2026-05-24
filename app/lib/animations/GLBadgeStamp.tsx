'use client'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

interface GLBadgeStampProps {
  children: React.ReactNode
  delay?: number
}

export function GLBadgeStamp({ children, delay = 0.3 }: GLBadgeStampProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    gsap.fromTo(
      el,
      { scale: 0, rotation: -12, opacity: 0 },
      {
        scale: 1,
        rotation: 0,
        opacity: 1,
        duration: 0.5,
        delay,
        ease: 'elastic.out(1.2, 0.5)',
        clearProps: 'all',
      }
    )
  }, [delay])

  return (
    <div ref={ref} style={{ display: 'inline-block', transformOrigin: 'center center' }}>
      {children}
    </div>
  )
}
