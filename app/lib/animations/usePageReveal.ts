'use client'
import { useEffect } from 'react'
import { gsap } from 'gsap'

interface RevealOptions {
  selectors?: string[]
  duration?: number
  stagger?: number
  y?: number
  delay?: number
}

export function usePageReveal(options: RevealOptions = {}) {
  const {
    selectors = ['.page-title', '.page-sub', '.section'],
    duration = 0.6,
    stagger = 0.1,
    y = 20,
    delay = 0.1,
  } = options

  useEffect(() => {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const elements = selectors
        .flatMap(s => Array.from(document.querySelectorAll(s)))
        .filter(Boolean)

      if (!elements.length) return

      // Immediately make everything visible as a safety fallback
      elements.forEach(el => {
        (el as HTMLElement).style.opacity = '1'
      })

      gsap.fromTo(
        elements,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          duration,
          stagger,
          delay,
          ease: 'power3.out',
          clearProps: 'all',
        }
      )
    } catch (e) {
      // If GSAP fails, elements are already visible from the fallback above
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}