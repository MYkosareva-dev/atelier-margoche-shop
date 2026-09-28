'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type CheckoutResponse = { url?: string; error?: { code: string; message: string } }

type Props = {
  productId: string
  /** `sm` is the compact variant used on gallery cards and the showcase caption. */
  size?: 'lg' | 'sm'
  /** Ids exist once per page (`#buy-form`, `#buy-now` on the product page); compact buttons use classes only. */
  formId?: string
  buttonId?: string
  className?: string
  onSoldOut?: () => void
}

/** Buy now: POST /next/checkout, then redirect to Stripe Checkout (SPEC Block E Screen 2 actions). */
export function BuyNowButton({ productId, size = 'lg', formId, buttonId, className, onSoldOut }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

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
      onSoldOut?.()
      router.refresh()
    }
  }

  return (
    <form id={formId} className={cn('buy-form', className)} onSubmit={onSubmit}>
      <Button
        id={buttonId}
        type="submit"
        size={size}
        disabled={loading}
        aria-busy={loading}
        className={cn(
          'btn-primary rounded-[var(--radius)] bg-[image:var(--gradient)] font-semibold text-[var(--bg)] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-[var(--accent-2)] disabled:cursor-not-allowed disabled:opacity-50',
          size === 'lg' ? 'h-12 w-full px-6 md:w-auto' : 'buy-now-sm h-9 px-4',
        )}
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
