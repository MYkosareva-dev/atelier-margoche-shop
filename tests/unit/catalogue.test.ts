import { describe, expect, it } from 'vitest'
import type { Field, Validate } from 'payload'

import { formatEUR } from '@/lib/money'
import { Products } from '@/collections/Products'
import { Pages } from '@/collections/Pages'
import { Media } from '@/collections/Media'

const validator = (fields: Field[], name: string) => {
  const field = fields.find((f) => 'name' in f && f.name === name) as { validate?: Validate } | undefined
  if (!field?.validate) throw new Error(`No validate on ${name}`)
  return (value: unknown) => field.validate!(value, {} as never)
}

describe('formatEUR (Rule B1)', () => {
  it('formats integer cents as euros', () => {
    expect(formatEUR(4900)).toBe('€49.00')
    expect(formatEUR(6900)).toBe('€69.00')
  })
})

describe('Product validation copy (Block F)', () => {
  const price = validator(Products.fields, 'price')
  const PRICE_ERROR = 'Price must be a whole number of cents (e.g. 4900 for €49.00).'

  it('accepts whole cents between 100 and 1,000,000', () => {
    expect(price(4900)).toBe(true)
    expect(price(100)).toBe(true)
    expect(price(1_000_000)).toBe(true)
  })

  it('rejects decimals, values below 100 and above 1,000,000', () => {
    expect(price(49.9)).toBe(PRICE_ERROR)
    expect(price(99)).toBe(PRICE_ERROR)
    expect(price(0)).toBe(PRICE_ERROR)
    expect(price(1_000_001)).toBe(PRICE_ERROR)
  })

  it('enforces title and description lengths', () => {
    const title = validator(Products.fields, 'title')
    const description = validator(Products.fields, 'shortDescription')
    expect(title('A')).toBe('Title is required (2–80 characters).')
    expect(title('Nebula Bloom')).toBe(true)
    expect(description('x'.repeat(201))).toBe('Description must be 10–200 characters.')
    expect(description('Too short')).toBe('Description must be 10–200 characters.')
    expect(description('A flower unfolding inside a nebula.')).toBe(true)
  })

  it('requires a photo and a valid kind', () => {
    expect(validator(Products.fields, 'image')(null)).toBe('A product photo is required.')
    expect(validator(Products.fields, 'kind')('video')).toBe('Choose Photo or AI art.')
    expect(validator(Products.fields, 'kind')('ai-art')).toBe(true)
  })
})

describe('Media and Page validation copy (Block F)', () => {
  it('requires alt text', () => {
    expect(validator(Media.fields, 'alt')('')).toBe('Alt text is required for accessibility.')
  })

  it('validates page slug and non-empty content', () => {
    expect(validator(Pages.fields, 'slug')('About Us')).toBe('Slug must be lowercase letters, numbers and hyphens.')
    expect(validator(Pages.fields, 'slug')('about')).toBe(true)
    const content = validator(Pages.fields, 'content')
    const empty = { root: { children: [{ type: 'paragraph', children: [] }] } }
    const filled = { root: { children: [{ type: 'paragraph', children: [{ text: 'Hello' }] }] } }
    expect(content(empty)).toBe('Content cannot be empty.')
    expect(content(filled)).toBe(true)
  })
})
