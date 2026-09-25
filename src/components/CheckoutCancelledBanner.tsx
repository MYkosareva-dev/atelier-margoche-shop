'use client'

import { useSearchParams } from 'next/navigation'
import { Info } from 'lucide-react'

import { Alert, AlertDescription } from '@/components/ui/alert'

// Read on the client so the product page stays statically cached (revalidate = 60) instead of
// becoming dynamic because of searchParams. Rendered inside <Suspense> by the page.
export function CheckoutCancelledBanner() {
  const params = useSearchParams()
  if (params.get('checkout') !== 'cancelled') return null

  return (
    <Alert id="checkout-cancelled" className="mb-8 border-[var(--border)] bg-[var(--surface)] text-[var(--text)]">
      <Info aria-hidden />
      <AlertDescription className="text-[var(--text)]">Checkout cancelled. Nothing was charged.</AlertDescription>
    </Alert>
  )
}
