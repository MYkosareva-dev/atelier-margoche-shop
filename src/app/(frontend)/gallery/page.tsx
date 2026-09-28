import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles } from 'lucide-react'

import { Showcase, type ShowcaseItem } from '@/components/Showcase'
import { imageFor } from '@/lib/media'
import { getPayload } from '@/lib/payload'

// Safety net; Payload afterChange/afterDelete hooks revalidate immediately (SPEC Rule B10).
export const revalidate = 60

export const metadata: Metadata = { title: 'Gallery' }

export default async function GalleryPage() {
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'products',
    where: { or: [{ soldOut: { equals: false } }, { soldOut: { exists: false } }] },
    depth: 1,
    limit: 50,
    pagination: false,
    sort: 'createdAt',
  })

  // Only what the client component needs; products without an uploaded image stay in the Works grid only.
  const items: ShowcaseItem[] = docs.flatMap((p) => {
    const hero = imageFor(p.image, 'hero')
    const card = imageFor(p.image, 'card')
    if (!hero || !card) return []
    return [{ id: p.id, title: p.title, slug: p.slug, price: p.price, kind: p.kind, hero, card }]
  })

  return (
    <>
      <h1 className="sr-only">Gallery</h1>
      {items.length === 0 ? (
        <div id="showcase-empty" className="flex flex-col items-center gap-3 py-16 text-center">
          <Sparkles className="size-8 text-[var(--accent)]" aria-hidden />
          <h2 className="text-xl font-medium">No prints yet</h2>
          <p className="text-[var(--text-muted)]">The atelier is preparing its first release. Check back soon.</p>
          <Link href="/" className="text-sm underline underline-offset-4">
            All works →
          </Link>
        </div>
      ) : (
        <>
          <Showcase items={items} />
          <p className="mt-10 text-center">
            <Link href="/" id="all-works" className="text-sm underline-offset-4 hover:underline">
              All works →
            </Link>
          </p>
        </>
      )}
    </>
  )
}
