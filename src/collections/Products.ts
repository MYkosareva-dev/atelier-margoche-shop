import type { CollectionConfig, TextFieldSingleValidation } from 'payload'
import { revalidatePath } from 'next/cache'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const validateSlug: TextFieldSingleValidation = async (v, { req, id }) => {
  if (!(typeof v === 'string' && SLUG_PATTERN.test(v) && v.length <= 80)) {
    return 'Slug must be lowercase letters, numbers and hyphens only.'
  }
  const existing = await req.payload.find({
    collection: 'products',
    where: id ? { and: [{ slug: { equals: v } }, { id: { not_equals: id } }] } : { slug: { equals: v } },
    limit: 1,
    depth: 0,
    pagination: false,
    req,
  })
  return existing.docs.length === 0 ? true : 'A product with this slug already exists.'
}

const slugify = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'price', 'soldOut', 'updatedAt'],
  },
  access: {
    read: () => true, // anyone can view
    create: ({ req }) => Boolean(req.user), // only logged-in admin
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    // `disableRevalidate` is set by scripts running outside Next.js (seed), where revalidatePath is unavailable.
    afterChange: [
      ({ doc, previousDoc, context }) => {
        if (context.disableRevalidate) return
        revalidatePath('/')
        revalidatePath(`/products/${doc.slug}`)
        if (previousDoc?.slug && previousDoc.slug !== doc.slug) revalidatePath(`/products/${previousDoc.slug}`)
      },
    ],
    afterDelete: [
      ({ doc, context }) => {
        if (context.disableRevalidate) return
        revalidatePath('/')
        revalidatePath(`/products/${doc.slug}`)
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      minLength: 2,
      maxLength: 80,
      validate: (v: unknown) =>
        typeof v === 'string' && v.trim().length >= 2 && v.length <= 80
          ? true
          : 'Title is required (2–80 characters).',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Lowercase letters, numbers and hyphens. Used in the URL.' },
      validate: validateSlug,
      hooks: {
        beforeValidate: [
          ({ value, data }) => value || (typeof data?.title === 'string' ? slugify(data.title) : value),
        ],
      },
    },
    {
      name: 'price',
      type: 'number',
      required: true,
      min: 100,
      max: 1_000_000,
      admin: { description: 'Whole number of cents, e.g. 4900 for €49.00. Prices include VAT.' },
      validate: (v: unknown) =>
        Number.isInteger(v) && (v as number) >= 100 && (v as number) <= 1_000_000
          ? true
          : 'Price must be a whole number of cents (e.g. 4900 for €49.00).',
    },
    {
      name: 'shortDescription',
      type: 'textarea',
      required: true,
      minLength: 10,
      maxLength: 200,
      validate: (v: unknown) =>
        typeof v === 'string' && v.trim().length >= 10 && v.length <= 200
          ? true
          : 'Description must be 10–200 characters.',
    },
    {
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      required: true,
      validate: (v: unknown) => (v ? true : 'A product photo is required.'),
    },
    {
      name: 'kind',
      type: 'select',
      required: true,
      defaultValue: 'photo',
      options: [
        { label: 'Photo', value: 'photo' },
        { label: 'AI art', value: 'ai-art' },
      ],
      admin: {
        description: 'Shown as a badge. "AI art" also renders the AI-generated disclosure line on the product page.',
      },
      validate: (v: unknown) => (v === 'photo' || v === 'ai-art' ? true : 'Choose Photo or AI art.'),
    },
    {
      name: 'soldOut',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: { description: 'When ticked the site shows "Sold out" and refuses checkout.' },
    },
  ],
}
