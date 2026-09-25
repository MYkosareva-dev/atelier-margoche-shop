import type { Media } from '@/payload-types'

type Size = 'card' | 'hero'

/** Resolves an upload field to the URL of the requested image size, falling back to the original. */
export function imageFor(image: string | Media | null | undefined, size: Size) {
  if (!image || typeof image === 'string') return null
  const sized = image.sizes?.[size]
  const url = sized?.url || image.url
  if (!url) return null
  return {
    url,
    alt: image.alt,
    width: (sized?.url ? sized.width : image.width) ?? 1200,
    height: (sized?.url ? sized.height : image.height) ?? 1500,
  }
}
