'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutGrid, User } from 'lucide-react'

import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/gallery', label: 'Gallery', Icon: LayoutGrid },
  { href: '/info/about', label: 'About', Icon: User },
]

/** Header nav (SPEC Block E shared layout): outlined buttons; the current page's button is filled. */
export function HeaderNav() {
  const pathname = usePathname()
  return (
    <nav className="flex gap-2 text-sm text-[var(--text-muted)]">
      {LINKS.map(({ href, label, Icon }) => {
        const current = pathname === href || pathname.startsWith(`${href}/`)
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
            <Icon className="hidden size-4 sm:block" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
