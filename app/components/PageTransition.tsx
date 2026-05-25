'use client'
import { useEffect, useRef, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { gsap } from 'gsap'

export default function PageTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Enter animation
    gsap.fromTo(el,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', clearProps: 'transform' }
    )
  }, [pathname])

  return (
    <div ref={ref} style={{ minHeight: '100vh' }}>
      {children}
    </div>
  )
}