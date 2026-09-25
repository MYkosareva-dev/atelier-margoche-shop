import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'
import { revalidatePath } from 'next/cache'

export const PROTECTED_SLUGS = ['about', 'impressum', 'privacy', 'terms']

const SLUG_PATTERN = /^[a-z0-9-]{2,40}$/

const isEmptyRichText = (v: unknown) => {
  const children = (v as { root?: { children?: { children?: { text?: string }[] }[] } } | null)?.root?.children
  if (!children?.length) return true
  // Lexical saves an "empty" editor as a single paragraph without text.
  return children.every((node) => !node.children?.some((child) => child.text?.trim()))
}

export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'slug', 'updatedAt'] },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeDelete: [
      async ({ id, req }) => {
        const doc = await req.payload.findByID({ collection: 'pages', id, depth: 0, req })
        if (PROTECTED_SLUGS.includes(doc.slug)) {
          // APIError with isPublic so the admin UI shows this copy instead of a generic error.
          throw new APIError('Legal pages cannot be deleted. Edit the content instead.', 400, undefined, true)
        }
      },
    ],
    // `disableRevalidate` is set by scripts running outside Next.js (seed), where revalidatePath is unavailable.
    afterChange: [
      ({ doc, previousDoc, context }) => {
        if (context.disableRevalidate) return
        revalidatePath(`/info/${doc.slug}`)
        if (previousDoc?.slug && previousDoc.slug !== doc.slug) revalidatePath(`/info/${previousDoc.slug}`)
      },
    ],
    afterDelete: [
      ({ doc, context }) => {
        if (context.disableRevalidate) return
        revalidatePath(`/info/${doc.slug}`)
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      maxLength: 80,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      validate: (v: unknown) =>
        typeof v === 'string' && SLUG_PATTERN.test(v)
          ? true
          : 'Slug must be lowercase letters, numbers and hyphens.',
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
      validate: (v: unknown) => (isEmptyRichText(v) ? 'Content cannot be empty.' : true),
    },
  ],
}
