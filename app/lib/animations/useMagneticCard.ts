// app/lib/animations/useMagneticCard.ts
// Like useMagneticButton but for full cards — gentler pull, 3D tilt on hover
import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'

interface Options {
  strength?: number
  tilt?: boolean
}

export function useMagneticCard<T extends HTMLElement>(options: Options = {}) {
  const { strength = 0.12, tilt = true } = options
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = e.clientX - cx
      const dy = e.clientY - cy

      gsap.to(el, {
        x: dx * strength,
        y: dy * strength,
        rotateX: tilt ? -(dy / rect.height) * 8 : 0,
        rotateY: tilt ? (dx / rect.width) * 8 : 0,
        transformPerspective: 800,
        ease: 'power2.out',
        duration: 0.5,
      })
    }

    const onLeave = () => {
      gsap.to(el, {
        x: 0, y: 0, rotateX: 0, rotateY: 0,
        ease: 'elastic.out(1, 0.4)',
        duration: 0.8,
        clearProps: 'rotateX,rotateY',
      })
    }

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [strength, tilt])

  return ref
}