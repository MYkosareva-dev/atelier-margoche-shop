import { cache } from 'react'

import { getPayload } from '@/lib/payload'

/** Deduplicated per request, so generateMetadata and the page share one query. */
export const getProductBySlug = cache(async (slug: string) => {
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'products',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
    pagination: false,
  })
  return docs[0] ?? null
})

export const getPageBySlug = cache(async (slug: string) => {
  const payload = await getPayload()
  const { docs } = await payload.find({
    collection: 'pages',
    where: { slug: { equals: slug } },
    depth: 1,
    limit: 1,
    pagination: false,
  })
  return docs[0] ?? null
})
