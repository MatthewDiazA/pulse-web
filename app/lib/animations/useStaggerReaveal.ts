'use client'
import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface StaggerOptions {
  selector?: string       // child selector to stagger (default '.card')
  stagger?: number        // delay between each item in seconds (default 0.06)
  duration?: number       // animation duration per item (default 0.5)
  y?: number              // starting y offset (default 28)
  trigger?: 'scroll' | 'mount'  // when to fire (default 'scroll')
  once?: boolean          // only animate once (default true)
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
  } = options

  const ref = useRef<T>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const items = container.querySelectorAll(selector)
    if (!items.length) return

    // Set initial state
    gsap.set(items, { opacity: 0, y, willChange: 'transform, opacity' })

    const anim = gsap.to(items, {
      opacity: 1,
      y: 0,
      duration,
      stagger,
      ease: 'power3.out',
      clearProps: 'willChange',
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

    return () => {
      anim.kill()
      ScrollTrigger.getAll().forEach(st => st.kill())
    }
  }, [selector, stagger, duration, y, trigger, once])

  return ref
}