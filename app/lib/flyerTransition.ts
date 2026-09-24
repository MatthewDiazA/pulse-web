// Open an event with the tapped flyer morphing into the event page's poster.
// Uses the View Transitions API: the source image and the event page's `.poster`
// share the name `flyer`. Browsers without it (or reduced motion) just navigate.

type Router = { push: (href: string) => void }

export function openEventWithFlyer(router: Router, eventId: string) {
  const href = `/events/${eventId}`
  const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => { finished: Promise<void> } }
  const source = document.querySelector<HTMLElement>(`[data-flyer-src="${eventId}"]`)
  if (!source || !doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    router.push(href)
    return
  }

  source.style.viewTransitionName = 'flyer'
  const t = doc.startViewTransition(() => new Promise<void>(resolve => {
    router.push(href)
    // The event page loads its data client-side; hold the snapshot until its poster
    // is on screen, but never freeze the tap for more than ~1.2s.
    const started = Date.now()
    const poll = () => {
      if (document.querySelector('.poster[data-flyer]') || Date.now() - started > 1200) resolve()
      else setTimeout(poll, 30)
    }
    poll()
  }))
  t.finished.finally(() => { source.style.viewTransitionName = '' })
}
