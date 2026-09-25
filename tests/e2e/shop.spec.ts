import { expect, test } from '@playwright/test'

// Requires `npm run dev` and a seeded database (`npm run seed`).

test('catalogue renders 4 product cards', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#catalogue .product-card')).toHaveCount(4)
})

test('AI disclosure shows only for AI art', async ({ page }) => {
  await page.goto('/products/nebula-bloom')
  await expect(page.locator('#ai-disclosure')).toHaveText(
    'Created with generative AI tools and curated by the artist.',
  )
  await page.goto('/products/golden-hour-lisbon')
  await expect(page.locator('#ai-disclosure')).toHaveCount(0)
})

test('unknown product renders the not-found page', async ({ page }) => {
  const res = await page.goto('/products/does-not-exist')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page does not exist.')
})

test('/info/impressum renders and every footer link is present', async ({ page }) => {
  await page.goto('/info/impressum')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Impressum')
  const footer = page.locator('#site-footer')
  for (const href of ['/info/about', '/info/impressum', '/info/privacy', '/info/terms']) {
    await expect(footer.locator(`a[href="${href}"]`)).toHaveCount(1)
  }
})

test('/order/<uuid> with a wrong session_id renders a real 404', async ({ page }) => {
  const res = await page.goto('/order/3f9c2a7e-6b1d-4e0a-9c55-1a2b3c4d5e6f?session_id=cs_test_not_this_one')
  expect(res?.status()).toBe(404)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This page does not exist.')
})

test('POST /next/checkout rejects an invalid productId with 400 INVALID_BODY', async ({ request }) => {
  const res = await request.post('/next/checkout', { data: { productId: '1 OR 1=1' } })
  expect(res.status()).toBe(400)
  expect(await res.json()).toEqual({
    error: { code: 'INVALID_BODY', message: 'Request body must contain a valid productId.' },
  })
})

test('sold-out product shows "Sold out" and checkout returns 409', async ({ page, request }) => {
  // Seeded with soldOut: true (SPEC Block C seed table).
  await page.goto('/')
  const card = page.locator('#catalogue .product-card[href="/products/brass-and-velvet"]')
  await expect(card).toHaveAttribute('data-sold-out', 'true')
  await expect(card.locator('.badge-soldout')).toHaveText('Sold out')
  const productId = await card.getAttribute('data-product-id')

  await card.click()
  await expect(page.locator('#sold-out')).toHaveText('Sold out')
  await expect(page.locator('#buy-now')).toHaveCount(0)

  const res = await request.post('/next/checkout', { data: { productId } })
  expect(res.status()).toBe(409)
  expect(await res.json()).toEqual({ error: { code: 'SOLD_OUT', message: 'Sorry, this print just sold out.' } })
})
