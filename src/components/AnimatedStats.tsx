'use client'

import { useEffect, useState, useRef } from 'react'

interface StatCounterProps {
  value: string
  label: string
}

function AnimatedCounter({ value, isVisible }: { value: string; isVisible: boolean }) {
  const numericValue = parseInt(value, 10)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!isVisible || isNaN(numericValue)) {
      setCount(numericValue)
      return
    }

    let startTime: number
    let animationFrame: number
    const duration = 1500

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(easeOutQuart * numericValue))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)
    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [numericValue, isVisible])

  if (isNaN(numericValue)) return <>{value}</>

  return (
    <>
      {count}
      <span className="text-brand absolute -right-2 top-0 text-2xl font-bold opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
        +
      </span>
    </>
  )
}

export function AnimatedStats() {
  const stats: StatCounterProps[] = [
    { value: '4', label: 'AI Engines Monitored' },
    { value: '50', label: 'Metrics Tracked' },
    { value: '99', label: 'Analysis Accuracy' },
    { value: '2', label: 'Average Audit Time' },
  ]

  const [isVisible, setIsVisible] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 },
    )

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  const suffixes: Record<string, string> = {
    '4': '+',
    '50': '+',
    '99': '%',
    '2': 's',
  }

  return (
    <div ref={sectionRef} className="mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="group text-center transition-transform duration-300 hover:-translate-y-1"
        >
          <div className="relative inline-flex">
            <span className="text-5xl font-black tracking-tight text-text-on-surface transition-all duration-300 group-hover:scale-110">
              <AnimatedCounter value={stat.value} isVisible={isVisible} />
              {suffixes[stat.value]}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-text-muted-surface">{stat.label}</p>
        </div>
      ))}
    </div>
  )
}
