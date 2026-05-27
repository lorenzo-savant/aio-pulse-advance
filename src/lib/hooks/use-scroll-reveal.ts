'use client'

import type { RefObject } from 'react'
import { useEffect, useState } from 'react'

interface UseScrollRevealOptions extends IntersectionObserverInit {
  instant?: boolean
}

export function useOnScreen(
  ref: RefObject<HTMLElement | null>,
  options: UseScrollRevealOptions = {},
): boolean {
  const { instant, ...observerOptions } = options
  const [isVisible, setIsVisible] = useState(instant ?? false)

  useEffect(() => {
    if (instant) return

    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return

        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1, ...observerOptions },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [instant, ref])

  return isVisible
}
