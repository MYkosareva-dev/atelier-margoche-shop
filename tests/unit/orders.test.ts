import { describe, expect, it } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'

import { Orders } from '@/collections/Orders'

const hook = Orders.hooks!.beforeChange![0] as CollectionBeforeChangeHook
const run = (args: { user?: object | null; data: Record<string, unknown>; originalDoc?: Record<string, unknown> }) =>
  hook({ req: { user: args.user ?? null }, data: args.data, originalDoc: args.originalDoc } as never)

describe('Orders beforeChange hook (SPEC Rule B3)', () => {
  it('rejects a status change made by an admin with the exact copy', () => {
    expect(() => run({ user: { id: 'admin' }, data: { status: 'paid' }, originalDoc: { status: 'pending' } })).toThrow(
      'Order status is set by Stripe confirmation and cannot be edited.',
    )
  })

  it('lets an admin save an owner note without changing the status', () => {
    const data = { status: 'paid', ownerNote: 'DHL 00340434161234567890' }
    expect(run({ user: { id: 'admin' }, data, originalDoc: { status: 'paid' } })).toBe(data)
  })

  it('allows the server to move pending → paid and pending → cancelled', () => {
    expect(() => run({ data: { status: 'paid' }, originalDoc: { status: 'pending' } })).not.toThrow()
    expect(() => run({ data: { status: 'cancelled' }, originalDoc: { status: 'pending' } })).not.toThrow()
  })

  it('treats paid and cancelled as terminal', () => {
    expect(() => run({ data: { status: 'cancelled' }, originalDoc: { status: 'paid' } })).toThrow()
    expect(() => run({ data: { status: 'pending' }, originalDoc: { status: 'cancelled' } })).toThrow()
  })
})
