'use client'

import { useEffect, useRef } from 'react'
import lottie from 'lottie-web'
import type { AnimationItem } from 'lottie-web'

interface LottieAnimationProps {
  src: string
  className?: string
  loop?: boolean
  autoplay?: boolean
  speed?: number
}

export function LottieAnimation({
  src,
  className,
  loop = true,
  autoplay = true,
  speed = 1,
}: LottieAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<AnimationItem | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    fetch(src)
      .then((res) => res.json())
      .then((data) => {
        if (!containerRef.current) return
        animRef.current = lottie.loadAnimation({
          container: containerRef.current,
          animationData: data,
          loop,
          autoplay,
        })
        animRef.current.setSpeed(speed)
      })
      .catch(() => {
        // JSON fetch failed silently
      })

    return () => {
      if (animRef.current) {
        animRef.current.destroy()
        animRef.current = null
      }
    }
  }, [src, loop, autoplay, speed])

  return <div ref={containerRef} className={className} aria-hidden="true" />
}
