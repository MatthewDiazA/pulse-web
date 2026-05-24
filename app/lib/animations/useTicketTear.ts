'use client'
import { useEffect } from 'react'
import { gsap } from 'gsap'

// Drop-in replacement for the CSS ticket tear animation.
// Pass refs to the top and bottom halves of the ticket.
// Call startTear() to trigger the animation sequence.

interface TearRefs {
  topRef: React.RefObject<HTMLElement | null>
  bottomRef: React.RefObject<HTMLElement | null>
  onComplete?: () => void
}

export function useTicketTear({ topRef, bottomRef, onComplete }: TearRefs) {
  const startTear = () => {
    const top = topRef.current
    const bottom = bottomRef.current
    if (!top || !bottom) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onComplete?.()
      return
    }

    const tl = gsap.timeline({ onComplete })

    // Brief pause so user sees the full ticket
    tl.to({}, { duration: 0.7 })

    // Top tears away — accelerates upward with slight rotation and perspective tilt
    tl.to(
      top,
      {
        y: -320,
        rotation: -9,
        skewX: 2,
        opacity: 0,
        duration: 1.0,
        ease: 'power3.in', // accelerates as it flies off — feels like real paper
      },
      '<'
    )

    // Bottom sags and falls — slightly delayed, slower, gravity-weighted
    tl.to(
      bottom,
      {
        y: 320,
        rotation: 7,
        skewX: -1,
        opacity: 0,
        duration: 1.1,
        ease: 'power2.in',
      },
      '<0.05' // 50ms after top starts — the bottom lags slightly
    )
  }

  return { startTear }
}