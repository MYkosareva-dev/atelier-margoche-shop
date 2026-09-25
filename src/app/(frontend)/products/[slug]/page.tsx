import type { Metadata } from 'next'
import { Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Sparkles, Truck } from 'lucide-react'

import { BuySection } from '@/components/BuySection'
import { CheckoutCancelledBanner } from '@/components/CheckoutCancelledBanner'
import { KindBadge } from '@/components/KindBadge'
import { Price } from '@/components/Price'
import { imageFor } from '@/lib/media'
import { getProductBySlug } from '@/lib/queries'

// Safety net; Payload afterChange/afterDelete hooks revalidate immediately (SPEC Rule B10).
export const revalidate = 60

// No paths at build time: each product page renders on first request, then is cached and revalidated.
export function generateStaticParams() {
  return []
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug)
  return product ? { title: product.title, description: product.shortDescription } : {}
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug)
  if (!product) notFound()

  const img = imageFor(product.image, 'hero')

  return (
    <>
      <Suspense fallback={null}>
        <CheckoutCancelledBanner />
      </Suspense>
      <article id="product" data-product-id={product.id} className="grid grid-cols-1 gap-8 md:grid-cols-[3fr_2fr] md:gap-12">
        {img ? (
          <Image
            id="product-image"
            src={img.url}
            alt={img.alt}
            width={img.width}
            height={img.height}
            sizes="(max-width: 768px) 100vw, 60vw"
            priority
            className="w-full rounded-[14px] object-cover"
          />
        ) : (
          <div id="product-image" className="aspect-[4/5] w-full rounded-[14px] bg-[var(--surface-2)]" />
        )}

        <div id="product-details" className="self-start md:sticky md:top-24">
          <KindBadge kind={product.kind} />
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl">{product.title}</h1>
          <p className="mt-4 text-[var(--text-muted)]">{product.shortDescription}</p>
          {product.kind === 'ai-art' && (
            <p id="ai-disclosure" className="mt-3 flex items-center gap-2 text-sm text-[var(--text-muted)]">
              <Sparkles className="size-4 shrink-0" aria-hidden /> Created with generative AI tools and curated by the
              artist.
            </p>
          )}
          <Price cents={product.price} className="mt-6 text-2xl" suffixClassName="text-base" />
          <p className="mt-1 flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Truck className="size-4 shrink-0" aria-hidden /> Free shipping in Europe · Ships in 5–7 business days
          </p>

          <BuySection productId={product.id} soldOut={Boolean(product.soldOut)} />

          <Link href="/" className="mt-4 flex w-fit items-center gap-2 text-sm">
            <ArrowLeft className="size-4" aria-hidden /> Back to prints
          </Link>
        </div>
      </article>
    </>
  )
}
