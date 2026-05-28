'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode, ElementType, HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type RevealDirection =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'scale'
  | 'up-lg'
  | 'down-lg'
  | 'left-lg'
  | 'right-lg'

interface RevealProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType
  direction?: RevealDirection
  /** Stagger delay step index (1-8) matching .q-reveal--d1..d8. */
  delay?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  /** If true, applies .q-stagger so direct children animate in sequence. */
  stagger?: boolean
  /** Fraction of element that must be visible to trigger (default 0.15). */
  threshold?: number
  /** Margin around root for early-trigger; matches IntersectionObserver rootMargin. */
  rootMargin?: string
  /** If true, animation re-runs every time the element re-enters the viewport. */
  retrigger?: boolean
  children: ReactNode
}

export function Reveal({
  as,
  direction = 'up',
  delay,
  stagger = false,
  threshold = 0.15,
  rootMargin = '0px 0px -10% 0px',
  retrigger = false,
  className,
  children,
  ...rest
}: RevealProps) {
  const Tag = (as ?? 'div') as ElementType
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        if (entry.isIntersecting) {
          setVisible(true)
          if (!retrigger) observer.disconnect()
        } else if (retrigger) {
          setVisible(false)
        }
      },
      { threshold, rootMargin },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin, retrigger])

  const revealClass = stagger ? 'q-stagger' : `q-reveal q-reveal--${direction}`
  const delayClass = !stagger && delay ? `q-reveal--d${delay}` : ''

  return (
    <Tag
      ref={ref as never}
      className={cn(revealClass, delayClass, visible && 'is-visible', className)}
      {...rest}
    >
      {children}
    </Tag>
  )
}
