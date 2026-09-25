'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { SoldOutBadge } from '@/components/SoldOutBadge'

type CheckoutResponse = { url?: string; error?: { code: string; message: string } }

export function BuySection({ productId, soldOut: initialSoldOut }: { productId: string; soldOut: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [soldOut, setSoldOut] = useState(initialSoldOut)

  // Coming back from Stripe with the browser's Back button can restore this page from the
  // back/forward cache with the spinner still showing; reset it to idle.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setLoading(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return // double-click guard; the button is also disabled
    setLoading(true)

    let res: Response
    try {
      res = await fetch('/next/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      })
    } catch {
      toast.error('You appear to be offline. Nothing was charged.')
      setLoading(false)
      return
    }

    const body = (await res.json().catch(() => ({}))) as CheckoutResponse
    if (res.ok && body.url) {
      window.location.assign(body.url) // keep the spinner until the browser leaves the page
      return
    }

    toast.error(body.error?.message ?? 'Something went wrong on our side. Nothing was charged.')
    setLoading(false)
    if (res.status === 409) {
      setSoldOut(true)
      router.refresh()
    }
  }

  if (soldOut) {
    return (
      <div className="mt-8">
        <SoldOutBadge id="sold-out" />
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          This edition is gone. New prints are released regularly — see the catalogue.
        </p>
      </div>
    )
  }

  return (
    <form id="buy-form" className="mt-8" onSubmit={onSubmit}>
      <Button
        id="buy-now"
        type="submit"
        size="lg"
        disabled={loading}
        aria-busy={loading}
        className="btn-primary h-12 w-full rounded-[var(--radius)] bg-[image:var(--gradient)] px-6 font-semibold text-[var(--bg)] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden /> Redirecting to secure checkout…
          </>
        ) : (
          'Buy now'
        )}
      </Button>
    </form>
  )
}
