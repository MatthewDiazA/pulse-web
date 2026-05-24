'use client'
import { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

interface CountUpOptions {
  end: number
  duration?: number       // seconds (default 1.6)
  prefix?: string         // e.g. '$' (default '')
  suffix?: string         // e.g. '+' (default '')
  decimals?: number       // decimal places (default 0)
  ease?: string           // gsap ease (default 'power2.out')
  delay?: number          // seconds delay before starting (default 0)
}

export function useCountUp(options: CountUpOptions) {
  const {
    end,
    duration = 1.6,
    prefix = '',
    suffix = '',
    decimals = 0,
    ease = 'power2.out',
    delay = 0,
  } = options

  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = `${prefix}${end.toFixed(decimals)}${suffix}`
      return
    }

    const obj = { val: 0 }

    const tween = gsap.to(obj, {
      val: end,
      duration,
      delay,
      ease,
      scrollTrigger: {
        trigger: el,
        start: 'top 90%',
        toggleActions: 'play none none none',
      },
      onUpdate: () => {
        el.textContent = `${prefix}${obj.val.toFixed(decimals)}${suffix}`
      },
      onComplete: () => {
        el.textContent = `${prefix}${end.toFixed(decimals)}${suffix}`
      },
    })

    return () => {
      tween.kill()
    }
  }, [end, duration, prefix, suffix, decimals, ease, delay])

  return ref
}