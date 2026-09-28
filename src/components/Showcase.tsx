'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { BuyNowButton } from '@/components/BuyNowButton'
import { KindBadge } from '@/components/KindBadge'
import { Price } from '@/components/Price'
import { cn } from '@/lib/utils'
import type { Product } from '@/payload-types'

type ShowcaseImage = { url: string; alt: string; width: number; height: number }

export type ShowcaseItem = {
  id: string
  title: string
  slug: string
  price: number
  kind: Product['kind']
  hero: ShowcaseImage
  card: ShowcaseImage
}

const INTERVAL_MS = 7000
const SWIPE_PX = 50

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const subscribeReducedMotion = (onChange: () => void) => {
  const mql = window.matchMedia(REDUCED_MOTION)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

/** Home showcase (SPEC Block E Screen 0): one large work, arrows, thumbnails, caption with Buy now. */
export function Showcase({ items }: { items: ShowcaseItem[] }) {
  const count = items.length
  const [storedIndex, setIndex] = useState(0)
  // `items` can shrink on router.refresh() (e.g. a work sold out), so the stored index is clamped.
  const index = Math.min(storedIndex, Math.max(count - 1, 0))
  // Auto-advance stops for good after the first user interaction; hover and focus only pause it.
  const [stopped, setStopped] = useState(false)
  const [hovering, setHovering] = useState(false)
  const [focused, setFocused] = useState(false)
  const paused = hovering || focused
  // Treated as reduced on the server, so auto-advance never starts before the client knows.
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => true,
  )
  const sectionRef = useRef<HTMLElement>(null)
  const touchX = useRef<number | null>(null)

  const wrap = useCallback((i: number) => ((i % count) + count) % count, [count])
  const jump = useCallback((to: number) => {
    setStopped(true)
    setIndex(to)
  }, [])
  const step = useCallback(
    (delta: number) => {
      setStopped(true)
      setIndex((i) => wrap(Math.min(i, count - 1) + delta))
    },
    [wrap, count],
  )

  useEffect(() => {
    if (stopped || paused || reducedMotion || count < 2) return
    const t = setTimeout(() => setIndex((i) => wrap(Math.min(i, count - 1) + 1)), INTERVAL_MS)
    return () => clearTimeout(t)
  }, [index, stopped, paused, reducedMotion, count, wrap])

  useEffect(() => {
    if (count < 2) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      step(e.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [count, step])

  if (count === 0) return null
  const current = items[index]
  // The next work is rendered hidden so its image is already loaded when it becomes current.
  const slides = count > 1 ? [current, items[wrap(index + 1)]] : [current]

  return (
    <section
      id="showcase"
      ref={sectionRef}
      aria-roledescription="carousel"
      aria-label="Featured works"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!sectionRef.current?.contains(e.relatedTarget as Node | null)) setFocused(false)
      }}
    >
      <div
        className="relative"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchX.current
          touchX.current = null
          const end = e.changedTouches[0]?.clientX
          if (start == null || end == null || count < 2) return
          const dx = end - start
          if (Math.abs(dx) >= SWIPE_PX) step(dx < 0 ? 1 : -1)
        }}
      >
        <div className="relative mx-auto aspect-[4/5] max-h-[calc(100dvh-9rem)] w-full">
          {slides.map((item) => {
            const isCurrent = item.id === current.id
            return (
              <Link
                key={item.id}
                href={`/products/${item.slug}`}
                aria-hidden={isCurrent ? undefined : true}
                tabIndex={isCurrent ? undefined : -1}
                className={cn(
                  'absolute inset-0 rounded-[var(--radius)] focus-visible:outline-2 focus-visible:outline-[var(--accent-2)]',
                  !isCurrent && 'pointer-events-none invisible',
                )}
              >
                <Image
                  src={item.hero.url}
                  alt={item.hero.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 60vw"
                  priority={isCurrent && index === 0}
                  loading={isCurrent && index === 0 ? undefined : 'eager'}
                  className="object-contain"
                />
              </Link>
            )
          })}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous work"
              onClick={() => step(-1)}
              className="absolute top-1/2 left-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--bg)]/60 text-[var(--text)] backdrop-blur hover:bg-[var(--surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--accent-2)] focus-visible:outline-none"
            >
              <ChevronLeft className="size-6" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next work"
              onClick={() => step(1)}
              className="absolute top-1/2 right-2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--bg)]/60 text-[var(--text)] backdrop-blur hover:bg-[var(--surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--accent-2)] focus-visible:outline-none"
            >
              <ChevronRight className="size-6" aria-hidden />
            </button>
          </>
        )}
      </div>

      <div
        id="showcase-caption"
        aria-live={stopped || reducedMotion ? 'polite' : 'off'}
        className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm"
      >
        <span className="text-base font-medium">{current.title}</span>
        <KindBadge kind={current.kind} />
        <span aria-hidden className="text-[var(--text-muted)]">
          ·
        </span>
        <Price cents={current.price} />
        <span aria-hidden className="text-[var(--text-muted)]">
          ·
        </span>
        <BuyNowButton key={current.id} productId={current.id} size="sm" />
        <span aria-hidden className="text-[var(--text-muted)]">
          ·
        </span>
        <Link href={`/products/${current.slug}`} className="underline-offset-4 hover:underline">
          View →
        </Link>
      </div>

      {count > 1 && (
        <div id="showcase-thumbs" className="mx-auto mt-6 flex w-fit max-w-full gap-3 overflow-x-auto p-1">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              aria-label={item.title}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => jump(i)}
              className={cn(
                'relative h-20 w-16 shrink-0 overflow-hidden rounded-md border border-[var(--border)] opacity-60 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--accent-2)] focus-visible:outline-none motion-reduce:transition-none',
                i === index && 'opacity-100 ring-2 ring-[var(--accent)]',
              )}
            >
              <Image src={item.card.url} alt="" fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
