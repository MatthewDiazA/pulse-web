'use client'
import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

interface MagneticOptions {
  strength?: number      // how much the button follows cursor (default 0.4)
  ease?: number          // spring ease back speed (default 0.15)
  scaleOnHover?: number  // scale up on hover (default 1.04)
}

export function useMagneticButton<T extends HTMLElement>(
  options: MagneticOptions = {}
) {
  const { strength = 0.4, ease = 0.15, scaleOnHover = 1.04 } = options
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = (e.clientX - cx) * strength
      const dy = (e.clientY - cy) * strength
      gsap.to(el, { x: dx, y: dy, duration: 0.4, ease: 'power2.out' })
    }

    const onEnter = () => {
      el.addEventListener('mousemove', onMove)
      gsap.to(el, { scale: scaleOnHover, duration: 0.3, ease: 'power2.out' })
    }

    const onLeave = () => {
      el.removeEventListener('mousemove', onMove)
      gsap.to(el, { x: 0, y: 0, scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' })
    }

    const onDown = () => {
      gsap.to(el, { scale: 0.96, duration: 0.1, ease: 'power2.in' })
    }

    const onUp = () => {
      gsap.to(el, { scale: scaleOnHover, duration: 0.2, ease: 'elastic.out(1.5, 0.4)' })
    }

    el.addEventListener('mouseenter', onEnter)
    el.addEventListener('mouseleave', onLeave)
    el.addEventListener('mousedown', onDown)
    el.addEventListener('mouseup', onUp)

    return () => {
      el.removeEventListener('mouseenter', onEnter)
      el.removeEventListener('mouseleave', onLeave)
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mousedown', onDown)
      el.removeEventListener('mouseup', onUp)
      gsap.killTweensOf(el)
    }
  }, [strength, ease, scaleOnHover])

  return ref
}