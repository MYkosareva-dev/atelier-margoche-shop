import type { CollectionConfig } from 'payload'
import { APIError, ValidationError } from 'payload'

export const MAX_UPLOAD_BYTES = 8_388_608 // 8 MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    description: 'JPEG, PNG or WebP, up to 8 MB. Alt text is required.',
  },
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    // Runs before Payload processes the file, so the admin sees SPEC copy instead of Payload's generic messages.
    beforeOperation: [
      ({ operation, req }) => {
        if ((operation !== 'create' && operation !== 'update') || !req.file) return
        if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
          throw new ValidationError({
            collection: 'media',
            errors: [{ message: 'Only JPEG, PNG and WebP images are allowed.', path: 'file' }],
          })
        }
        if (req.file.size > MAX_UPLOAD_BYTES) {
          throw new ValidationError({
            collection: 'media',
            errors: [{ message: 'File exceeds the 8 MB limit.', path: 'file' }],
          })
        }
      },
    ],
    // products.image is required, so deleting a referenced image would fail on the NOT NULL column (Rule B11).
    beforeDelete: [
      async ({ id, req }) => {
        const { totalDocs } = await req.payload.count({
          collection: 'products',
          where: { image: { equals: id } },
          req,
        })
        if (totalDocs > 0) {
          throw new APIError('This image is used by a product. Replace it there first.', 400, undefined, true)
        }
      },
    ],
  },
  upload: {
    mimeTypes: ALLOWED_MIME_TYPES,
    imageSizes: [
      { name: 'card', width: 800, height: undefined, position: 'centre' },
      { name: 'hero', width: 1600, height: undefined, position: 'centre' },
    ],
    adminThumbnail: 'card',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      maxLength: 160,
      validate: (v: unknown) =>
        typeof v === 'string' && v.trim().length > 0 && v.length <= 160
          ? true
          : 'Alt text is required for accessibility.',
    },
  ],
}
