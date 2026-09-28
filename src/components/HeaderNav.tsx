'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ImageIcon, LayoutGrid, User } from 'lucide-react'

import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/', label: 'Works', Icon: LayoutGrid },
  { href: '/gallery', label: 'Gallery', Icon: ImageIcon },
  { href: '/info/about', label: 'About', Icon: User },
]

/** Header nav (SPEC Block E shared layout): outlined icon buttons; the current page's button is filled. */
export function HeaderNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-2 text-sm text-[var(--text-muted)]">
      {LINKS.map(({ href, label, Icon }) => {
        const current = pathname === href || (href !== '/' && pathname.startsWith(`${href}/`))
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 transition-colors hover:bg-[var(--surface-2)] focus-visible:ring-2 focus-visible:ring-[var(--accent-2)] focus-visible:outline-none motion-reduce:transition-none',
              current && 'bg-[var(--surface-2)] text-[var(--text)]',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {/* Below 640 px three labelled buttons do not fit next to the logo at 375; the label stays the accessible name. */}
            <span className="sr-only sm:not-sr-only">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
