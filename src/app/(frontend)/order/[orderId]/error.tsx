'use client'

import { Button } from '@/components/ui/button'

export default function OrderError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h2 className="text-xl font-medium">We couldn&apos;t load your order</h2>
      <p className="text-[var(--text-muted)]">
        Please refresh the page. If it keeps happening, the shop is temporarily down.
      </p>
      <Button variant="outline" className="mt-2 h-10 border-[var(--border)] text-[var(--text)]" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  )
}
