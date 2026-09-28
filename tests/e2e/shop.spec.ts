import { expect, test } from '@playwright/test'

// Requires `npm run dev` and a seeded database (`npm run seed`).

test('/ renders the Works catalogue with at least 4 product cards', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Works')
  // At least the 4 seeded products; the owner may have added more through the admin panel.
  await expect(page.locator('#catalogue .product-card').nth(3)).toBeVisible()
})

test('/gallery shows the showcase: image, caption with price, arrows and side previews', async ({ page }) => {
  await page.goto('/gallery')
  const showcase = page.locator('#showcase')
  await expect(showcase).toBeVisible()
  const image = () => showcase.locator('a:not([aria-hidden]) img').first()
  await expect(image()).toBeVisible()
  await expect(page.locator('#showcase-caption')).toContainText(/€\d+\.\d{2} incl\. VAT/)
  // Default viewport is 1280 wide; the seed has 3 available works (Brass & Velvet is sold out), so both previews show.
  await expect(page.locator('#showcase-prev-preview')).toBeVisible()
  await expect(page.locator('#showcase-next-preview')).toBeVisible()

  const first = await image().getAttribute('alt')
  await page.getByRole('button', { name: 'Next work' }).click()
  await expect(image()).not.toHaveAttribute('alt', first ?? '')
  await page.locator('#showcase-prev-preview').click()
  await expect(image()).toHaveAttribute('alt', first ?? '')

  await page.locator('#all-works').click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Works')
})

test('header buttons lead to Works, Gallery and About and mark the current page', async ({ page }) => {
  await page.goto('/')
  const nav = page.locator('#site-header nav')
  await expect(nav.getByRole('link', { name: 'Works' })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: 'Gallery' }).click()
  await expect(page).toHaveURL(/\/gallery$/)
  await expect(nav.getByRole('link', { name: 'Gallery' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Works' })).not.toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: 'About' }).click()
  await expect(page).toHaveURL(/\/info\/about$/)
})

test('Buy now on a Works card starts checkout for that card without opening the product page', async ({ page }) => {
  // CI runs with dummy Stripe keys, so the server call is stubbed; the request body proves which product was bought.
  await page.route('**/next/checkout', (route) =>
    route.fulfill({ json: { url: 'https://checkout.stripe.com/c/pay/cs_test_e2e' } }),
  )
  await page.route('https://checkout.stripe.com/**', (route) => route.fulfill({ body: 'stripe checkout stub' }))

  await page.goto('/')
  const card = page.locator('#catalogue .product-card[href="/products/golden-hour-lisbon"]')
  const productId = await card.getAttribute('data-product-id')
  const button = card.locator('xpath=..').getByRole('button', { name: 'Buy now' })

  // Default viewport is 1280 wide: the button is revealed only on hover (SPEC Block E Screen 1).
  const opacity = () => button.evaluate((el) => getComputedStyle(el.closest('form')!).opacity)
  expect(await opacity()).toBe('0')
  await card.hover()
  await expect.poll(opacity).toBe('1')

  const request = page.waitForRequest('**/next/checkout')
  await button.click()
  expect((await request).postDataJSON()).toEqual({ productId })
  await expect(page).toHaveURL(/^https:\/\/checkout\.stripe\.com\//)
})

test('clicking the product image opens the lightbox and Esc closes it', async ({ page }) => {
  await page.goto('/products/golden-hour-lisbon')
  await expect(page.locator('main a[href="/"]', { hasText: 'Works' })).toBeVisible()
  await page.locator('#product-image').click()
  await expect(page.locator('#lightbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('#lightbox')).toBeHidden()
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
  await expect(page.getByRole('link', { name: 'Back to works' })).toHaveAttribute('href', '/')
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
