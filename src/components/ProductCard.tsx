import Image from 'next/image'
import Link from 'next/link'

import { Card } from '@/components/ui/card'
import { KindBadge } from '@/components/KindBadge'
import { Price } from '@/components/Price'
import { SoldOutBadge } from '@/components/SoldOutBadge'
import { imageFor } from '@/lib/media'
import { cn } from '@/lib/utils'
import type { Product } from '@/payload-types'

export function ProductCard({ product, priority }: { product: Product; priority?: boolean }) {
  const img = imageFor(product.image, 'card')
  const soldOut = Boolean(product.soldOut)

  return (
    <Link
      href={`/products/${product.slug}`}
      className="product-card group block rounded-[var(--radius)] focus-visible:outline-2 focus-visible:outline-[var(--accent-2)]"
      data-product-id={product.id}
      data-sold-out={String(soldOut)}
    >
      <Card className="h-full gap-0 overflow-hidden rounded-[var(--radius)] border-[var(--border)] bg-[var(--surface)] py-0 shadow-none transition-shadow group-hover:gradient-ring">
        <div className="relative">
          {img ? (
            <Image
              src={img.url}
              alt={img.alt}
              width={img.width}
              height={img.height}
              sizes="(max-width: 768px) 100vw, 33vw"
              priority={priority}
              className={cn(
                'aspect-[4/5] w-full rounded-t-[14px] object-cover',
                soldOut && 'grayscale opacity-70',
              )}
            />
          ) : (
            <div className="aspect-[4/5] w-full rounded-t-[14px] bg-[var(--surface-2)]" />
          )}
          {soldOut && <SoldOutBadge className="absolute top-3 left-3" />}
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium">{product.title}</h2>
            <KindBadge kind={product.kind} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">{product.shortDescription}</p>
          <Price cents={product.price} className="mt-3" />
        </div>
      </Card>
    </Link>
  )
}
