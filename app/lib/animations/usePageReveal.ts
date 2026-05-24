'use client'
import { useEffect } from 'react'
import { gsap } from 'gsap'

interface RevealOptions {
  selectors?: string[]    // elements to reveal in sequence
  duration?: number       // per-element duration (default 0.6)
  stagger?: number        // delay between elements (default 0.1)
  y?: number              // starting y offset (default 20)
  delay?: number          // initial delay before sequence starts (default 0.1)
}

// Reveals a sequence of elements on page mount.
// Pass CSS selectors in the order you want them to appear.
// Example: usePageReveal({ selectors: ['.ev-title', '.ev-meta', '.tickets-panel'] })

export function usePageReveal(options: RevealOptions = {}) {
  const {
    selectors = ['.page-title', '.page-sub', '.section'],
    duration = 0.6,
    stagger = 0.1,
    y = 20,
    delay = 0.1,
  } = options

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const elements = selectors
      .flatMap(s => Array.from(document.querySelectorAll(s)))
      .filter(Boolean)

    if (!elements.length) return

    gsap.set(elements, { opacity: 0, y, willChange: 'transform, opacity' })

    const tl = gsap.timeline({ delay })

    tl.to(elements, {
      opacity: 1,
      y: 0,
      duration,
      stagger,
      ease: 'power3.out',
      clearProps: 'willChange',
    })

    return () => {
      tl.kill()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}