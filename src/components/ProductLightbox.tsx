'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { X } from 'lucide-react'

type Props = { url: string; alt: string; width: number; height: number }

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Product hero image that opens a full-screen view on click (SPEC Block E Screen 2, #lightbox). */
export function ProductLightbox({ url, alt, width, height }: Props) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key !== 'Tab' || !dialogRef.current) return
      // Keep focus inside the dialog.
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || !dialogRef.current.contains(active))) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      trigger?.focus()
    }
  }, [open, close])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="block w-full cursor-zoom-in rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-2)]"
      >
        <Image
          id="product-image"
          src={url}
          alt={alt}
          width={width}
          height={height}
          sizes="(max-width: 768px) 100vw, 60vw"
          priority
          className="w-full cursor-zoom-in rounded-[14px] object-cover"
        />
      </button>

      {open &&
        createPortal(
          <div
            id="lightbox"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={alt}
            onClick={(e) => {
              if (e.target === e.currentTarget) close()
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg)]/95 p-6 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
          >
            <Image
              src={url}
              alt={alt}
              width={width}
              height={height}
              sizes="100vw"
              className="h-auto max-h-[calc(100dvh-48px)] w-auto max-w-[calc(100vw-48px)] object-contain"
            />
            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full text-[var(--text)] hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-2)]"
            >
              <X className="size-6" aria-hidden />
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}
