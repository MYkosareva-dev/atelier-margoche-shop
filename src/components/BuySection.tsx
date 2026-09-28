'use client'

import { useState } from 'react'

import { BuyNowButton } from '@/components/BuyNowButton'
import { SoldOutBadge } from '@/components/SoldOutBadge'

export function BuySection({ productId, soldOut: initialSoldOut }: { productId: string; soldOut: boolean }) {
  const [soldOut, setSoldOut] = useState(initialSoldOut)

  if (soldOut) {
    return (
      <div className="mt-8">
        <SoldOutBadge id="sold-out" />
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          This edition is gone. New prints are released regularly — see all works.
        </p>
      </div>
    )
  }

  return (
    <BuyNowButton
      productId={productId}
      formId="buy-form"
      buttonId="buy-now"
      className="mt-8"
      onSoldOut={() => setSoldOut(true)}
    />
  )
}
