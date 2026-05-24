'use client'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

export function useNavLogo<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Always visible as fallback
    el.style.opacity = '1'

    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      gsap.fromTo(
        el,
        { opacity: 0, scale: 0.88 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.6,
          delay: 0.05,
          ease: 'power3.out',
          clearProps: 'all',
        }
      )
    } catch (e) {
      el.style.opacity = '1'
    }
  }, [])

  return ref
}