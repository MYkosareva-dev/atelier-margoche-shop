import Link from 'next/link'
import { Sparkles } from 'lucide-react'

import { ProductCard } from '@/components/ProductCard'
import { getPayload } from '@/lib/payload'

// Safety net; Payload afterChange/afterDelete hooks revalidate immediately (SPEC Rule B10).
export const revalidate = 60

export default async function CataloguePage() {
  const payload = await getPayload()
  const { docs: products } = await payload.find({
    collection: 'products',
    depth: 1,
    limit: 50,
    pagination: false,
    sort: 'createdAt',
  })

  return (
    <>
      <section className="mb-10">
        <h1 className="font-[family-name:var(--font-display)] text-[32px] leading-tight md:text-[44px]">
          Prints from the <span className="gradient-text">atelier</span>
        </h1>
        <p className="mt-3 text-[var(--text-muted)]">
          Photographs and AI-made artworks, printed on archival paper. Free shipping in Europe.
        </p>
      </section>

      {products.length === 0 ? (
        <div id="catalogue-empty" className="flex flex-col items-center gap-3 py-16 text-center">
          <Sparkles className="size-8 text-[var(--accent)]" aria-hidden />
          <h2 className="text-xl font-medium">No prints yet</h2>
          <p className="text-[var(--text-muted)]">The atelier is preparing its first release. Check back soon.</p>
          <Link href="/info/about" className="text-sm underline underline-offset-4">
            About the atelier
          </Link>
        </div>
      ) : (
        <section id="catalogue" className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} priority={i < 3} />
          ))}
        </section>
      )}
    </>
  )
}
