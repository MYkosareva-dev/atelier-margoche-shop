import { expect, test } from '@playwright/test'

// Requires `npm run dev` and a seeded database (`npm run seed`). Checkout scenarios are added in Phase 2.

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
