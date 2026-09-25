'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const FAST_INTERVAL_MS = 3_000
const FAST_PHASE_MS = 30_000
const SLOW_INTERVAL_MS = 5_000

/**
 * Mounted only while the order is pending (SPEC Rule B9): router.refresh() every 3 s for 30 s,
 * then every 5 s. Pauses while the tab is hidden and refreshes at once when it becomes visible.
 * When the webhook has marked the order paid or cancelled, the refreshed server page no longer
 * renders this component, which stops the polling. Renders the pending heading and body copy,
 * which change after 30 s (Screen 3 status table).
 */
export function OrderStatusPoller({ details }: { details: React.ReactNode }) {
  const router = useRouter()
  const [startedAt] = useState(() => Date.now())
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    const schedule = () => {
      clearTimeout(timer)
      if (document.visibilityState !== 'visible') return
      const elapsed = Date.now() - startedAt
      timer = setTimeout(tick, elapsed < FAST_PHASE_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS)
    }
    const tick = () => {
      if (Date.now() - startedAt >= FAST_PHASE_MS) setSlow(true)
      router.refresh()
      schedule()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
      else clearTimeout(timer)
    }

    schedule()
    const slowTimer = setTimeout(() => setSlow(true), FAST_PHASE_MS)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearTimeout(timer)
      clearTimeout(slowTimer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [router, startedAt])

  return slow ? (
    <>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl">We&apos;re still confirming your payment.</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        This page will update automatically; you can also come back later using this link. Nothing else is needed
        from you.
      </p>
    </>
  ) : (
    <>
      <h1 className="mt-4 font-[family-name:var(--font-display)] text-4xl">Confirming your payment…</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        This usually takes a few seconds. Please keep this page open.
      </p>
      {details}
    </>
  )
}
