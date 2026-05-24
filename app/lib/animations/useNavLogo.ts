'use client'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// Attach to any nav logo button/image.
// Fires a subtle scale+fade entrance on mount, settles cleanly.

export function useNavLogo<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.85, filter: 'blur(4px)' },
      {
        opacity: 1,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.7,
        delay: 0.05,
        ease: 'power3.out',
        clearProps: 'filter',
      }
    )
  }, [])

  return ref
}