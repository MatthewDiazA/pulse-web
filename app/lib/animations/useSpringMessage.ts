'use client'
import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'

// Attach to the messages container. Every new child that appears
// gets a spring entrance animation automatically via MutationObserver.

export function useSpringMessage<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const container = ref.current
    if (!container) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const animateIn = (el: Element) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 16, scale: 0.97 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.4,
          ease: 'back.out(1.4)',
          clearProps: 'all',
        }
      )
    }

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element) animateIn(node)
        })
      }
    })

    observer.observe(container, { childList: true })

    return () => observer.disconnect()
  }, [])

  return ref
}