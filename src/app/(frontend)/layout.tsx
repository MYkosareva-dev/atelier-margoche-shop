import type { Metadata } from 'next'
import Link from 'next/link'
import { Fraunces, Inter } from 'next/font/google'
import React from 'react'

import './globals.css'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-sans' })
const fraunces = Fraunces({ subsets: ['latin'], weight: ['500', '700'], variable: '--font-display' })

export const metadata: Metadata = {
  title: { default: 'Atelier Margoche', template: '%s · Atelier Margoche' },
  description: 'Photographs and AI-made artworks, printed on archival paper. Free shipping in Europe.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${fraunces.variable} min-h-screen overflow-x-hidden antialiased`}>
        <header
          id="site-header"
          className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur"
        >
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
            <Link href="/" id="logo" className="font-[family-name:var(--font-display)] text-xl">
              Atelier <span className="gradient-text">Margoche</span>
            </Link>
            <nav className="flex gap-6 text-sm text-[var(--text-muted)]">
              <Link href="/">Prints</Link>
              <Link href="/info/about">About</Link>
            </nav>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-10">
          {children}
        </main>
        <footer id="site-footer" className="mt-24 border-t border-[var(--border)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-[var(--text-muted)] md:flex-row md:justify-between">
            <p>© 2026 Atelier Margoche · Prices incl. VAT · Free shipping in Europe · Payments by Stripe (test mode)</p>
            <nav className="flex flex-wrap gap-4">
              <Link href="/info/about">About</Link>
              <Link href="/info/impressum">Impressum</Link>
              <Link href="/info/privacy">Privacy</Link>
              <Link href="/info/terms">Terms &amp; Returns</Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  )
}
