'use client'
import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface StaggerOptions {
  selector?: string
  stagger?: number
  duration?: number
  y?: number
  trigger?: 'scroll' | 'mount'
  once?: boolean
  deps?: any[]
}

export function useStaggerReveal<T extends HTMLElement>(
  options: StaggerOptions = {}
) {
  const {
    selector = '.card',
    stagger = 0.06,
    duration = 0.5,
    y = 28,
    trigger = 'scroll',
    once = true,
    deps = [],
  } = options

  const ref = useRef<T>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const timeout = setTimeout(() => {
      const items = container.querySelectorAll(selector)
      if (!items.length) return

      gsap.set(items, { opacity: 0, y, willChange: 'transform, opacity' })

      gsap.to(items, {
        opacity: 1,
        y: 0,
        duration,
        stagger,
        ease: 'power3.out',
        clearProps: 'willChange,transform,opacity',
        ...(trigger === 'scroll'
          ? {
              scrollTrigger: {
                trigger: container,
                start: 'top 88%',
                toggleActions: once ? 'play none none none' : 'play none none reverse',
              },
            }
          : {}),
      })
    }, 50)

    return () => {
      clearTimeout(timeout)
      ScrollTrigger.getAll().forEach(st => st.kill())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, stagger, duration, y, trigger, once, ...deps])

  return ref
}
