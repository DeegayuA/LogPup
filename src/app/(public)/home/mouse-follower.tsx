'use client'

import { useEffect, useRef, useState } from 'react'

export function MouseFollower() {
  const followerRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [isCardHovered, setIsCardHovered] = useState(false)
  const [isClicked, setIsClicked] = useState(false)

  useEffect(() => {
    // Check if device supports fine hover and user has not requested reduced motion
    const hasFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!hasFinePointer || prefersReducedMotion) return

    let mouseX = -100
    let mouseY = -100
    let followerX = -100
    let followerY = -100
    let animationFrameId: number

    const onMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY

      if (!isVisible) setIsVisible(true)

      // Move the instant center dot immediately
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`
      }

      // Check what element is currently under the cursor
      const target = e.target as HTMLElement | null
      if (target) {
        const interactive = target.closest('button, a, input, [role="button"], [data-interactive]')
        const card = target.closest('[data-spotlight-card], .group')
        setIsHovered(!!interactive)
        setIsCardHovered(!interactive && !!card)
      }
    }

    const onMouseDown = () => setIsClicked(true)
    const onMouseUp = () => setIsClicked(false)

    const onMouseLeave = () => setIsVisible(false)
    const onMouseEnter = () => setIsVisible(true)

    // Smooth Lerp animation loop for trailing ring
    const render = () => {
      // Linear interpolation: 0.18 for a snappy yet silky smooth trailing fluid feel
      const ease = 0.18
      followerX += (mouseX - followerX) * ease
      followerY += (mouseY - followerY) * ease

      if (followerRef.current) {
        followerRef.current.style.transform = `translate3d(${followerX}px, ${followerY}px, 0)`
      }

      animationFrameId = requestAnimationFrame(render)
    }

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mouseleave', onMouseLeave)
    document.addEventListener('mouseenter', onMouseEnter)

    animationFrameId = requestAnimationFrame(render)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mouseleave', onMouseLeave)
      document.removeEventListener('mouseenter', onMouseEnter)
      cancelAnimationFrame(animationFrameId)
    }
  }, [isVisible])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden transition-opacity duration-300"
      style={{ opacity: isVisible ? 1 : 0 }}
      aria-hidden="true"
    >
      {/* Trailing smooth glow ring / spotlight */}
      <div
        ref={followerRef}
        className="pointer-events-none fixed left-0 top-0 -translate-x-1/2 -translate-y-1/2 will-change-transform"
      >
        <div
          className="rounded-full transition-all duration-200 ease-out flex items-center justify-center"
          style={{
            width: isHovered ? '48px' : isCardHovered ? '64px' : isClicked ? '20px' : '30px',
            height: isHovered ? '48px' : isCardHovered ? '64px' : isClicked ? '20px' : '30px',
            backgroundColor: isHovered
              ? 'oklch(var(--primary) / 0.18)'
              : isCardHovered
              ? 'oklch(var(--primary) / 0.1)'
              : 'transparent',
            border: isHovered
              ? '1.5px solid oklch(var(--primary) / 0.7)'
              : isCardHovered
              ? '1px solid oklch(var(--primary) / 0.4)'
              : '1px solid oklch(var(--primary) / 0.45)',
            boxShadow: isHovered
              ? '0 0 24px oklch(var(--primary) / 0.35), inset 0 0 12px oklch(var(--primary) / 0.2)'
              : isCardHovered
              ? '0 0 30px oklch(var(--primary) / 0.2)'
              : '0 0 14px oklch(var(--primary) / 0.15)',
            backdropFilter: isHovered ? 'blur(1px)' : 'none',
          }}
        />
      </div>

      {/* Instant Precision Center Dot */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed left-0 top-0 -translate-x-1/2 -translate-y-1/2 will-change-transform"
      >
        <div
          className="rounded-full transition-transform duration-100 ease-out"
          style={{
            width: isHovered ? '8px' : isClicked ? '10px' : '5px',
            height: isHovered ? '8px' : isClicked ? '10px' : '5px',
            backgroundColor: 'var(--primary)',
            boxShadow: '0 0 8px var(--primary)',
            transform: isClicked ? 'scale(1.4)' : isHovered ? 'scale(0.8)' : 'scale(1)',
          }}
        />
      </div>
    </div>
  )
}
