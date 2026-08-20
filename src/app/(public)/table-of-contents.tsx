'use client'

import { useState, useEffect, useCallback } from 'react'
import { FileText, ChevronRight, CheckCircle2, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TocSection {
  id: string
  title: string
}

export function TableOfContents({
  sections,
  title = 'Table of Contents',
}: {
  sections: TocSection[]
  title?: string
}) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '')
  const [readProgress, setReadProgress] = useState<number>(0)

  // Scroll listener for reading progress calculation & active section spy fallback
  const handleScroll = useCallback(() => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight
    if (totalHeight > 0) {
      const progress = Math.min(100, Math.max(0, Math.round((window.scrollY / totalHeight) * 100)))
      setReadProgress(progress)
    }

    // Scroll spy: find current section based on scroll position
    const headingElements = sections
      .map((sec) => document.getElementById(sec.id))
      .filter((el): el is HTMLElement => el !== null)

    const scrollPosition = window.scrollY + 140

    for (let i = headingElements.length - 1; i >= 0; i--) {
      const heading = headingElements[i]
      if (heading.offsetTop <= scrollPosition) {
        setActiveId(heading.id)
        break
      }
    }
  }, [sections])

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    const rafId = requestAnimationFrame(handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      cancelAnimationFrame(rafId)
    }
  }, [handleScroll])

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault()
    const target = document.getElementById(id)
    if (target) {
      const headerOffset = 96
      const elementPosition = target.getBoundingClientRect().top
      const offsetPosition = elementPosition + window.scrollY - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })

      window.history.pushState(null, '', `#${id}`)
      setActiveId(id)
    }
  }

  const activeIndex = sections.findIndex((s) => s.id === activeId)
  const currentSectionNum = activeIndex >= 0 ? activeIndex + 1 : 1

  return (
    <div className="sticky top-24 flex max-h-[calc(100vh-7.5rem)] flex-col gap-3.5 overflow-hidden rounded-2xl border border-border/80 bg-card/85 p-5 shadow-lg backdrop-blur-xl">
      {/* Header & Progress Indicator */}
      <div className="flex flex-col gap-2 border-b border-border/60 pb-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            <span className="font-heading text-xs font-bold uppercase tracking-wider text-foreground">
              {title}
            </span>
          </div>
          <span className="font-mono text-2xs font-bold text-primary">
            {readProgress}%
          </span>
        </div>

        {/* Reading Progress Bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className="h-full bg-primary transition-all duration-150 ease-out"
            style={{ width: `${readProgress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-2xs text-muted-foreground">
          <span>Section {currentSectionNum} of {sections.length}</span>
          <span className="flex items-center gap-1 font-mono text-[10px]">
            <Bookmark className="size-2.5 text-primary" /> Auto-Tracking
          </span>
        </div>
      </div>

      {/* Nav Link List (Scrollable if viewport is short) */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto pr-1 text-xs scrollbar-thin">
        {sections.map((sec, idx) => {
          const isActive = activeId === sec.id
          const isPassed = activeIndex > idx

          return (
            <a
              key={sec.id}
              href={`#${sec.id}`}
              onClick={(e) => scrollToSection(e, sec.id)}
              className={cn(
                'group flex items-center justify-between rounded-xl px-3 py-2 transition-all duration-150 cursor-pointer text-left',
                isActive
                  ? 'border-l-3 border-l-primary bg-primary/10 text-primary font-semibold shadow-xs'
                  : isPassed
                  ? 'text-foreground/80 hover:bg-muted/50 hover:text-foreground'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
              )}
            >
              <span className="line-clamp-1 leading-snug">{sec.title}</span>
              {isActive ? (
                <ChevronRight className="size-3.5 shrink-0 text-primary animate-pulse ml-1" />
              ) : isPassed ? (
                <CheckCircle2 className="size-3 shrink-0 text-primary/40 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
              ) : (
                <ChevronRight className="size-3 shrink-0 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
              )}
            </a>
          )
        })}
      </nav>

      {/* Footer Info */}
      <div className="border-t border-border/40 pt-2 text-2xs text-muted-foreground text-center font-mono">
        Alta Vision Legal Framework
      </div>
    </div>
  )
}
