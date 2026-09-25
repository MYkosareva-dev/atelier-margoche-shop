import type { CollectionConfig } from 'payload'
import { APIError } from 'payload'

// SPEC Rule B3: paid and cancelled are terminal.
const TERMINAL_STATUSES = ['paid', 'cancelled']

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'status', 'total', 'customerEmail', 'paidAt', 'createdAt'],
  },
  defaultSort: '-createdAt',
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false, // only the server (Local API, overrideAccess) creates orders
    update: ({ req }) => Boolean(req.user), // admin may annotate; status flips happen server-side
    delete: () => false, // orders are never deleted
  },
  hooks: {
    beforeChange: [
      ({ req, data, originalDoc }) => {
        // Admin UI requests carry req.user; server-side Local API calls from the webhook do not.
        if (req.user && originalDoc && data.status && data.status !== originalDoc.status) {
          // APIError with isPublic so the admin UI shows this copy instead of a generic error.
          throw new APIError('Order status is set by Stripe confirmation and cannot be edited.', 400, undefined, true)
        }
        if (originalDoc && data.status && data.status !== originalDoc.status && TERMINAL_STATUSES.includes(originalDoc.status)) {
          throw new Error(`Order status cannot change from ${originalDoc.status} to ${data.status}.`)
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'orderNumber',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'Human-readable, e.g. AM-2026-000042' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    { name: 'stripeSessionId', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: 'stripePaymentIntentId', type: 'text', admin: { readOnly: true } },
    {
      name: 'items',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 1, // raised when a cart is added
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: false }, // null if product later deleted
        { name: 'titleSnapshot', type: 'text', required: true },
        { name: 'unitPrice', type: 'number', required: true, min: 0 }, // cents at time of purchase
        { name: 'quantity', type: 'number', required: true, min: 1, defaultValue: 1 },
      ],
    },
    { name: 'currency', type: 'text', required: true, defaultValue: 'eur' },
    { name: 'total', type: 'number', required: true, min: 0, admin: { description: 'Cents' } },
    { name: 'customerEmail', type: 'email' },
    {
      name: 'shippingAddress',
      type: 'group',
      fields: [
        { name: 'name', type: 'text' },
        { name: 'line1', type: 'text' },
        { name: 'line2', type: 'text' },
        { name: 'postalCode', type: 'text' },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'country', type: 'text', admin: { description: 'ISO 3166-1 alpha-2' } },
      ],
    },
    { name: 'paidAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'ownerNote',
      type: 'textarea',
      maxLength: 500,
      admin: { description: 'Private note for the owner (e.g. tracking number).' },
    },
  ],
}
