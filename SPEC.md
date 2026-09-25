# Atelier Margoche — Technical Specification
> Version: 1.0 | Date: 2026-09-24 | Status: Production-ready
> Tier: M | Modules: M1 Auth, M2 Database, M3 API, M4 Payments, M5 Legal, M8 File upload, M12 Integrations, M14 Admin panel

> Decision: Tier M, not L. Payments are present, but there is one operator role, no customer accounts, four collections and two runtime integrations (Stripe, Vercel Blob). Depth is scaled accordingly.

## Module checklist

| # | Module | YES/NO | Reason |
|---|---|---|---|
| M1 | Auth & Sessions | YES | The owner logs into the Payload admin panel. Customers never log in. |
| M2 | Database | YES | Supabase Postgres holds products, media metadata, orders, pages. |
| M3 | API Endpoints | YES | Two custom server routes: create Checkout Session, receive Stripe webhook. |
| M4 | Payments | YES | Stripe hosted Checkout, sandbox only, EUR. |
| M5 | Legal & Privacy | YES | Customer email and shipping address are processed; shop is based in Germany and ships across Europe. |
| M6 | i18n | NO | English only. Strings are hardcoded. |
| M7 | Realtime | NO | No live updates; confirmation page polls on a timer (see Rule B9). |
| M8 | File upload | YES | Owner uploads product photos through the admin panel. |
| M9 | Notifications | NO | No emails are sent by the app. Stripe sends its own receipt in test mode only if enabled; the app does not depend on it. |
| M10 | Analytics | NO | No tracking, no cookies beyond the Payload admin session cookie. |
| M11 | Cron | NO | No scheduled jobs. |
| M12 | Integrations | YES | Stripe API, Vercel Blob storage. |
| M13 | Performance & scale | NO | Hard cap: ≤50 products, ≤10,000 orders. No pagination on the public catalogue. |
| M14 | Admin panel | YES | Payload admin at `/admin`. |
| M15 | AI features | NO | The shop sells AI-generated art; the app itself calls no AI API. |

---

## BLOCK A: Overview

**What it is.** Atelier Margoche is a small online print shop: the owner (Margarita) sells a handful of art prints — photographs and AI-generated artworks — edits the catalogue through a login-protected Payload admin panel, and customers pay with Stripe hosted Checkout in sandbox mode. Deployed on Vercel at a public URL.

### Stack

| Layer | Choice | Constraint |
|---|---|---|
| Framework | Next.js App Router + TypeScript, version installed by `npx create-payload-app@latest` (blank template) | Do not upgrade or downgrade Next.js independently of Payload. |
| CMS | Payload 3.x, installed inside the Next.js app | Collections are defined in code; schema is managed by Payload migrations. |
| Database | Supabase Postgres, ONE project, via `@payloadcms/db-postgres` | Connection string = Supabase **Session pooler** URI (IPv4, port 5432). Vercel cannot reach the IPv6 direct connection. |
| File storage | Vercel Blob via `@payloadcms/storage-vercel-blob` | Vercel's filesystem is read-only at runtime; local disk uploads are forbidden in production. |
| Payments | Stripe hosted Checkout, `mode: 'payment'`, card only | Test keys only (`sk_test_…`). Currency: **EUR**. Money stored as INTEGER cents. |
| Styling | Tailwind CSS v4 + shadcn/ui, dark theme | Design polish is a later phase; Block E defines v1 layout and tokens. |
| Icons | `lucide-react` | Exact icon names in Block E. |
| Validation | Zod | Server-side on both custom routes. |
| Tests | Vitest (unit) + Playwright (smoke e2e) | See Block H. |
| Package manager | npm | Developer is on Windows with Node 24 / npm 12. |
| Deploy | Vercel, connected to the developer's personal GitHub repository; pushed to the school repository at hand-in | Build command runs migrations then `next build`. |
| Prohibited | Committing any `.env*` file; storing uploads on local disk in production; marking an order paid anywhere except the verified webhook handler; live Stripe keys (`sk_live_`, `pk_live_`); a shopping cart in v1; customer accounts; analytics or tracking scripts; Supabase Auth or Supabase client SDK (Payload is the only DB client). | |

> Decision: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is not used. Hosted Checkout redirects the browser to `session.url` returned by the server; no Stripe.js runs in the browser. The publishable key may be set in Vercel for completeness but nothing reads it.

> Decision: Payload's `idType: 'uuid'` is enabled so order URLs cannot be enumerated.

> Decision: Schema is owned by Payload (Drizzle migrations), not hand-written SQL. Row-level security is not used: the database is reached only by the server through Payload with a single connection; authorization is Payload access control (Block C). Supabase RLS policies would never be evaluated and are therefore omitted.

> Decision: Free shipping across Europe, prices shown "incl. VAT". Removes shipping-rate logic and satisfies German price-transparency rules in one line.

### Repository layout

```
atelier-margoche-shop/
├── .env.example                      # names only, no values
├── .gitignore                        # contains .env, .env.*, !.env.example
├── .github/
│   ├── workflows/ci.yml              # lint + typecheck + build + unit tests on PR
│   └── pull_request_template.md
├── .claude/                          # produced in stage 2 (not by this spec)
├── CLAUDE.md                         # produced in stage 2
├── README.md
├── SPEC.md                           # this file
├── docs/
│   └── GO-LIVE-PLAN.md               # optional Hard task, written not executed
├── next.config.mjs                   # wrapped with withPayload()
├── package.json
├── payload.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── src/
│   ├── payload-types.ts              # generated by `payload generate:types`
│   ├── collections/
│   │   ├── Users.ts
│   │   ├── Media.ts
│   │   ├── Products.ts
│   │   ├── Orders.ts
│   │   └── Pages.ts
│   ├── lib/
│   │   ├── stripe.ts                 # Stripe client singleton + sk_test_ guard
│   │   ├── money.ts                  # formatEUR(cents)
│   │   ├── countries.ts              # EUROPE_COUNTRIES list
│   │   ├── rate-limit.ts             # in-memory limiter
│   │   └── payload.ts                # getPayload() helper
│   ├── seed.ts                       # `npm run seed` — 4 products, 4 pages
│   ├── migrations/                   # generated by `payload migrate:create`
│   └── app/
│       ├── (payload)/                # generated by create-payload-app; do not edit
│       │   ├── admin/[[...segments]]/page.tsx
│       │   ├── api/[...slug]/route.ts
│       │   └── layout.tsx
│       └── (frontend)/
│           ├── layout.tsx
│           ├── globals.css
│           ├── page.tsx              # / catalogue  (+ loading.tsx)
│           ├── products/[slug]/page.tsx            (+ loading.tsx)
│           ├── order/[orderId]/page.tsx            (+ loading.tsx)
│           ├── order/[orderId]/OrderStatusPoller.tsx
│           ├── info/[slug]/page.tsx  # About, Impressum, Privacy, Terms & Returns (+ loading.tsx)
│           ├── not-found.tsx
│           ├── error.tsx
│           └── next/
│               ├── checkout/route.ts
│               └── stripe/webhook/route.ts
├── seed/images/                      # 4 seed images (jpg/webp), each < 8 MB
└── tests/
    ├── unit/webhook.test.ts
    └── e2e/shop.spec.ts
```

> Decision: Custom routes live under `/next/*`, not `/api/*`. Payload owns `/api/[...slug]` for its REST API; a second `/api/…` handler in another route group would collide. `/next/` is the convention used by Payload's official templates.

### Roles

| Role | Description | Access |
|---|---|---|
| Admin (owner) | Margarita, logs into `/admin` with email + password. Created once via Payload's first-user screen. | Full CRUD on Products, Media, Pages; read + edit status of Orders; manage Users. |
| Visitor (customer) | Anonymous. Never logs in. | Read published Products and Pages; create a Checkout Session; view their own order confirmation via the UUID + Stripe session id in the URL. |

> Decision: The reviewer needs no credentials — the demo is driven by the owner on a screen-shared call. If admin access is requested, the owner creates a separate `reviewer@…` user in `/admin/collections/users` with a temporary password and deletes it after the review. The owner's own password is never shared. README states this under "How the owner edits content".

### Routes

| Path | Screen | Visitor | Admin |
|---|---|---|---|
| `/` | Catalogue: all products | ✓ | ✓ |
| `/products/[slug]` | Product detail + Buy now | ✓ | ✓ |
| `/order/[orderId]?session_id=cs_test_…` | Order confirmation | ✓ (only with matching session_id) | ✓ |
| `/info/[slug]` | Static page (about, impressum, privacy, terms) | ✓ | ✓ |
| `/admin` and `/admin/*` | Payload admin panel | redirect to `/admin/login` | ✓ |
| `/api/*` | Payload REST/GraphQL (used by the admin UI) | per collection access rules | ✓ |
| `POST /next/checkout` | Create Stripe Checkout Session | ✓ | ✓ |
| `POST /next/stripe/webhook` | Stripe webhook receiver | Stripe only (signature) | — |

---

## BLOCK B: User Stories

Personas: **Margarita** — the owner. **Jonas** — a customer in Berlin. **Lena** — a customer in Vienna whose card gets declined. **Reviewer** — Turing College reviewer on the 1-1 call.

### US1 — Margarita edits a product and sees it live without redeploy

1. Margarita opens `https://<domain>/admin`, enters email + password, lands on the dashboard.
2. Opens Products → "Golden Hour, Lisbon" → changes price from `4500` to `4900`, edits the short description.
3. Clicks Save. Payload validates: price is a positive integer ≥ 100, description ≤ 200 chars.
4. Opens `https://<domain>/products/golden-hour-lisbon` in a new tab and reloads: new price "€49.00" and new text are visible within 5 seconds.
5. Error path: she enters `49.90` as the price → inline error "Price must be a whole number of cents (e.g. 4900 for €49.00)."; Save is blocked.
6. Error path: session expired → redirected to `/admin/login`; after login she is returned to the product she was editing.

- [ ] Login required for `/admin`; unauthenticated request redirects to `/admin/login`.
- [ ] Saved change is visible on the public page after a hard reload with no deploy triggered.
- [ ] Price field rejects non-integers and values < 100 with the exact copy above.
- [ ] Public pages are rendered dynamically (`export const dynamic = 'force-dynamic'`) or revalidated by a Payload `afterChange` hook — never cached for more than 60 s.

### US2 — Margarita uploads a photo through the admin panel

1. In Products → New, she fills title, price, description, chooses kind "AI art".
2. Clicks the Image field → Upload → picks `nebula-bloom.jpg` (3.2 MB).
3. Payload uploads to Vercel Blob, generates `card` (800 px) and `hero` (1600 px) sizes, requires alt text.
4. She saves; the product appears on `/` with the card image.
5. Error path: file is 14 MB → "File exceeds the 8 MB limit."; upload rejected.
6. Error path: file is `.pdf` → "Only JPEG, PNG and WebP images are allowed."

- [ ] Media collection accepts only `image/jpeg`, `image/png`, `image/webp`, max 8 MB.
- [ ] Alt text is required.
- [ ] Uploaded file URL starts with `https://` and points at Vercel Blob, not `/media/`.
- [ ] Image is served on the product card and product page via `next/image` with the Blob hostname allow-listed.

### US3 — Jonas buys a print with the success card

1. Jonas opens `/`, sees 4 products with badges "Photo" / "AI art", clicks "Golden Hour, Lisbon".
2. Product page shows hero image, description, "€49.00 incl. VAT · Free shipping in Europe", button **Buy now**.
3. Clicks Buy now → button shows spinner "Redirecting to secure checkout…" → server creates Order `pending` and a Stripe Session → browser redirects to `checkout.stripe.com`.
4. On Stripe's page he enters email, shipping address in Germany, card `4242 4242 4242 4242`, `12/34`, `123`, clicks Pay.
5. Stripe redirects to `/order/<uuid>?session_id=cs_test_…`. Page shows "Confirming your payment…" for 0–3 s, then "Order paid — thank you, Jonas!" with the product, price, shipping address.
6. Meanwhile the webhook `checkout.session.completed` hit `/next/stripe/webhook`, signature verified, Order → `paid`.
7. Error path: the webhook is delayed > 30 s → page shows "We're still confirming your payment. This page will update automatically; you can also come back later using this link." and keeps polling every 5 s.

- [ ] Clicking Buy now creates exactly one Order row with `status: pending` before redirect.
- [ ] Order becomes `paid` only inside the webhook handler after `stripe.webhooks.constructEvent` succeeds.
- [ ] Confirmation page never writes to the Order; it only reads.
- [ ] Confirmation page shows product title, unit price, total, customer email and shipping address from the Order row.
- [ ] Margarita sees the order in `/admin/collections/orders` with status Paid.

### US4 — Lena's card is declined; nothing is marked paid

1. Lena opens "Nebula Bloom", clicks Buy now → Order `pending` created → redirected to Stripe.
2. Enters card `4000 0000 0000 0002` → Stripe shows "Your card was declined." on its own page. She stays on Stripe.
3. She clicks the back arrow ("← Atelier Margoche") → lands on `/products/nebula-bloom?checkout=cancelled` → banner "Checkout cancelled. Nothing was charged."
4. In admin, the Order shows `pending`; no `paidAt`.
5. 24 h later Stripe sends `checkout.session.expired` → Order → `cancelled`.
6. Error path: she retries Buy now → a NEW Order `pending` is created; the old one remains and expires independently.

- [ ] Declined card produces no webhook of type `checkout.session.completed`; order stays `pending`.
- [ ] Cancel URL is `/products/[slug]?checkout=cancelled` and renders the banner with the exact copy above.
- [ ] `checkout.session.expired` moves `pending` → `cancelled`, never `paid` → anything.
- [ ] Admin Orders list can be filtered by status.

### US5 — Margarita marks a product sold out

1. In admin → Products → "Nebula Bloom" → ticks **Sold out** → Save.
2. `/` shows the card with a "Sold out" badge and a disabled, greyed button.
3. `/products/nebula-bloom` shows "Sold out" instead of Buy now.
4. Jonas had the product page open from before; clicks Buy now → `POST /next/checkout` returns 409 → toast "Sorry, this print just sold out." — no Order is created, no redirect.
5. Error path: race — Jonas already reached Stripe before the toggle. Payment completes; webhook marks the Order `paid` anyway (the sale was accepted at session creation). Margarita sees it in Orders and handles it manually.

- [ ] `soldOut: true` → server rejects checkout with `{ "error": { "code": "SOLD_OUT", … } }`, HTTP 409.
- [ ] Public UI reflects sold-out state on both catalogue and detail page.
- [ ] Toggle back to available restores the Buy now button without redeploy.

### US6 — Margarita edits the About / legal pages

1. Admin → Pages → "About the atelier" → edits the rich text → Save.
2. `/info/about` shows the new text on reload.
3. Pages `impressum`, `privacy`, `terms` exist as rows and are linked in the footer.
4. Error path: she tries to delete the `impressum` page → allowed by Payload, but the footer link renders a 404 page "This page does not exist." — Block F Rule B12 forbids deleting the four seeded slugs via a `beforeDelete` hook with message "Legal pages cannot be deleted. Edit the content instead."

- [ ] Pages collection: title, slug (unique), content (rich text).
- [ ] Four seeded pages: `about`, `impressum`, `privacy`, `terms`.
- [ ] Footer links to all four on every public page.
- [ ] Deleting a seeded page is blocked with the exact copy above.

### US7 — Reviewer verifies secrets and deployment

1. Opens the live URL; catalogue loads with images.
2. Opens the GitHub repository; searches for `sk_test_`, `postgres://`, `postgresql://`, `BLOB_READ_WRITE_TOKEN=` → zero hits in all commits (`git log -p | grep`).
3. `.env.example` lists variable names with a one-line "where to get it" comment each.
4. Vercel → Settings → Environment Variables shows the same names.
5. README explains what the shop sells, how the owner edits content, how to run locally, env variables and their sources, which optional tasks were done.

- [ ] `git log --all -p | grep -E "sk_test_|sk_live_|whsec_|postgres(ql)?://" | grep -vE "localhost|sk_test_dummy|whsec_dummy"` returns nothing.
- [ ] `.env.example` contains every variable from Block F §Security with no values.
- [ ] README has the five sections listed in step 5.

> Scope decision: IN — catalogue, product page, Buy now (single item, quantity 1), Stripe hosted Checkout with shipping-address collection, webhook-driven order status, confirmation page, admin CRUD for Products/Media/Pages, Orders visible in admin, sold-out toggle, four info pages, CI, smoke tests, GO-LIVE-PLAN.md. OUT — do NOT build a cart, customer accounts, quantity selector, coupons, digital downloads, email sending, search, categories, multi-currency, separate dev/prod databases, custom domain. These are listed as future extensions in README only.

---

## BLOCK C: Data Model

Schema source of truth = the Payload collection configs below. Payload generates the Postgres tables via `npm run payload migrate:create`; never edit tables by hand in Supabase.

```
users      (admin accounts, Payload-managed)
media   1──N products   (products.image → media.id)
products 1──N orders_items (orders_items.product → products.id, ON DELETE SET NULL)
orders  1──N orders_items (array field, ON DELETE CASCADE)
pages      (standalone)
```

### payload.config.ts

```ts
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'
import { Users } from './src/collections/Users'
import { Media } from './src/collections/Media'
import { Products } from './src/collections/Products'
import { Orders } from './src/collections/Orders'
import { Pages } from './src/collections/Pages'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
  admin: { user: Users.slug },
  collections: [Users, Media, Products, Orders, Pages],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET!,
  typescript: { outputFile: path.resolve(dirname, 'src/payload-types.ts') },
  db: postgresAdapter({
    idType: 'uuid',
    pool: { connectionString: process.env.DATABASE_URI! },
    push: process.env.NODE_ENV === 'development', // dev: auto-sync; prod: migrations only
  }),
  sharp,
  plugins: [
    vercelBlobStorage({
      enabled: true,
      collections: { media: true },
      token: process.env.BLOB_READ_WRITE_TOKEN!,
    }),
  ],
})
```

> Decision: The Vercel Blob plugin is configured with `enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN)`. While the token is empty (local development) the plugin is off and uploads fall back to Payload's local disk storage under `media/`, which is git-ignored. Production and Preview always have the token, so uploads there go to Blob (US2). The plugin also sets `alwaysInsertFields: true`, which keeps its `prefix` column in the schema even when it is disabled. Without it, a migration generated locally would be missing a column that production needs.

> Decision: The config lives at `src/payload.config.ts` (the create-payload-app blank-template location, resolved through the `@payload-config` tsconfig alias), not at the repository root. Imports are therefore `./collections/*`.

> Decision: Payload replaces its built-in field checks (`required`, `min`, `maxLength`, …) when a field has a custom `validate`. Each custom `validate` therefore enforces the full Block F rule and returns the Block F copy, including the async unique-slug check ("A product with this slug already exists."). The upload errors "Only JPEG, PNG and WebP images are allowed." and "File exceeds the 8 MB limit." come from a Media `beforeOperation` hook, plus `upload.responseOnLimit` for the multipart parser. A Media `beforeDelete` hook returns the Rule B11 copy because `products.image` is required (NOT NULL).

> Decision: The `revalidatePath` hooks do nothing when `context.disableRevalidate` is set. Only `src/seed.ts` sets it, because it runs outside a Next.js request where `revalidatePath` is unavailable.

### Users (admin only)

```ts
import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: {
    tokenExpiration: 7200,          // 2 h session
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000,       // 15 min lock after 5 failures
  },
  admin: { useAsTitle: 'email' },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 80 },
  ],
}
```

> Decision: The very first user is created through Payload's built-in `/admin/create-first-user` screen, which is available only while the users table is empty. No public sign-up exists.

### Media

```ts
import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  upload: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    imageSizes: [
      { name: 'card', width: 800, height: undefined, position: 'centre' },
      { name: 'hero', width: 1600, height: undefined, position: 'centre' },
    ],
    adminThumbnail: 'card',
  },
  fields: [
    { name: 'alt', type: 'text', required: true, maxLength: 160 },
  ],
}
```

Upload size limit (8 MB): add `upload: { limits: { fileSize: 8_388_608 } }` at the top level of `buildConfig` in `payload.config.ts`. Payload returns "File exceeds the 8 MB limit." — set via `upload.limits` error copy in the Media collection's `admin.description` and the custom error in `hooks.beforeValidate` if the default message differs.

### Products

```ts
import type { CollectionConfig } from 'payload'
import { revalidatePath } from 'next/cache'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: { useAsTitle: 'title', defaultColumns: ['title', 'kind', 'price', 'soldOut', 'updatedAt'] },
  access: {
    read: () => true,                             // anyone can view
    create: ({ req }) => Boolean(req.user),       // only logged-in admin
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    afterChange: [({ doc }) => { revalidatePath('/'); revalidatePath(`/products/${doc.slug}`) }],
    afterDelete: [({ doc }) => { revalidatePath('/'); revalidatePath(`/products/${doc.slug}`) }],
  },
  fields: [
    { name: 'title', type: 'text', required: true, minLength: 2, maxLength: 80 },
    {
      name: 'slug', type: 'text', required: true, unique: true, index: true,
      admin: { description: 'Lowercase letters, numbers and hyphens. Used in the URL.' },
      validate: (v: unknown) =>
        typeof v === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) && v.length <= 80
          ? true
          : 'Slug must be lowercase letters, numbers and hyphens only.',
      hooks: {
        beforeValidate: [({ value, data }) =>
          value || (data?.title as string | undefined)?.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')],
      },
    },
    {
      name: 'price', type: 'number', required: true, min: 100, max: 1_000_000,
      admin: { description: 'Whole number of cents, e.g. 4900 for €49.00. Prices include VAT.' },
      validate: (v: unknown) =>
        Number.isInteger(v) && (v as number) >= 100
          ? true
          : 'Price must be a whole number of cents (e.g. 4900 for €49.00).',
    },
    { name: 'shortDescription', type: 'textarea', required: true, minLength: 10, maxLength: 200 },
    { name: 'image', type: 'upload', relationTo: 'media', required: true },
    {
      name: 'kind', type: 'select', required: true, defaultValue: 'photo',
      options: [
        { label: 'Photo', value: 'photo' },
        { label: 'AI art', value: 'ai-art' },
      ],
      admin: { description: 'Shown as a badge. "AI art" also renders the AI-generated disclosure line on the product page.' },
    },
    { name: 'soldOut', type: 'checkbox', defaultValue: false, index: true,
      admin: { description: 'When ticked the site shows "Sold out" and refuses checkout.' } },
  ],
}
```

Resulting table (reference, generated by Payload — do not create manually):

```
products(id uuid PK, title varchar, slug varchar UNIQUE, price numeric, short_description varchar,
         image_id uuid FK→media.id, kind enum('photo','ai-art'), sold_out boolean DEFAULT false,
         updated_at timestamptz, created_at timestamptz)
```

> Decision: Payload stores `number` fields as `numeric`; integrality is enforced by the field `validate` and by the Zod schema on the checkout route (Block D), which is sufficient for a single-writer system.

### Orders

```ts
import type { CollectionConfig } from 'payload'

export const Orders: CollectionConfig = {
  slug: 'orders',
  admin: {
    useAsTitle: 'orderNumber',
    defaultColumns: ['orderNumber', 'status', 'total', 'customerEmail', 'paidAt', 'createdAt'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: () => false,                          // only the server (Local API, overrideAccess) creates orders
    update: ({ req }) => Boolean(req.user),       // admin may annotate; status flips happen server-side
    delete: () => false,                          // orders are never deleted
  },
  hooks: {
    beforeChange: [({ req, data, originalDoc }) => {
      // Admin UI requests carry req.user; server-side Local API calls from the webhook do not.
      if (req.user && originalDoc && data.status && data.status !== originalDoc.status) {
        throw new Error('Order status is set by Stripe confirmation and cannot be edited.')
      }
      return data
    }],
  },
  fields: [
    { name: 'orderNumber', type: 'text', required: true, unique: true, index: true,
      admin: { readOnly: true, description: 'Human-readable, e.g. AM-2026-000042' } },
    {
      name: 'status', type: 'select', required: true, defaultValue: 'pending', index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Paid', value: 'paid' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    { name: 'stripeSessionId', type: 'text', required: true, unique: true, index: true, admin: { readOnly: true } },
    { name: 'stripePaymentIntentId', type: 'text', admin: { readOnly: true } },
    {
      name: 'items', type: 'array', required: true, minRows: 1, maxRows: 1,   // maxRows raised when a cart is added
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: false }, // null if product later deleted
        { name: 'titleSnapshot', type: 'text', required: true },
        { name: 'unitPrice', type: 'number', required: true, min: 0 },          // cents at time of purchase
        { name: 'quantity', type: 'number', required: true, min: 1, defaultValue: 1 },
      ],
    },
    { name: 'currency', type: 'text', required: true, defaultValue: 'eur' },
    { name: 'total', type: 'number', required: true, min: 0, admin: { description: 'Cents' } },
    { name: 'customerEmail', type: 'email' },
    {
      name: 'shippingAddress', type: 'group',
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
    { name: 'ownerNote', type: 'textarea', maxLength: 500, admin: { description: 'Private note for the owner (e.g. tracking number).' } },
  ],
}
```

Resulting tables (reference):

```
orders(id uuid PK, order_number varchar UNIQUE, status enum('pending','paid','cancelled'),
       stripe_session_id varchar UNIQUE, stripe_payment_intent_id varchar, currency varchar,
       total numeric, customer_email varchar, shipping_address_* varchar, paid_at timestamptz,
       owner_note varchar, updated_at, created_at)
orders_items(id varchar PK, _parent_id uuid FK→orders.id ON DELETE CASCADE, _order int,
             product_id uuid FK→products.id ON DELETE SET NULL, title_snapshot varchar,
             unit_price numeric, quantity numeric)
```

`orderNumber` format: `AM-<YYYY>-<6-digit zero-padded sequence>`; sequence = count of orders in the current year + 1, computed in the checkout route inside a single request. Collision on `unique` → retry once with sequence + 1 (Rule B4).

### Pages

```ts
import type { CollectionConfig } from 'payload'
import { revalidatePath } from 'next/cache'

const PROTECTED_SLUGS = ['about', 'impressum', 'privacy', 'terms']

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
    beforeDelete: [async ({ id, req }) => {
      const doc = await req.payload.findByID({ collection: 'pages', id })
      if (PROTECTED_SLUGS.includes(doc.slug)) throw new Error('Legal pages cannot be deleted. Edit the content instead.')
    }],
    afterChange: [({ doc }) => revalidatePath(`/info/${doc.slug}`)],
  },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 80 },
    { name: 'slug', type: 'text', required: true, unique: true, index: true,
      validate: (v: unknown) => typeof v === 'string' && /^[a-z0-9-]{2,40}$/.test(v) ? true : 'Slug must be lowercase letters, numbers and hyphens.' },
    { name: 'content', type: 'richText', required: true },
  ],
}
```

### Seed data (4 products, 4 pages) — `src/seed.ts`, run once with `npm run seed`

| title | slug | price (cents) | kind | shortDescription |
|---|---|---|---|---|
| Golden Hour, Lisbon | golden-hour-lisbon | 4900 | photo | Late-afternoon light over the Alfama rooftops. Giclée print on 200 g matte paper, A3. |
| Nebula Bloom | nebula-bloom | 5900 | ai-art | A flower unfolding inside a nebula — generated, then hand-curated and color-graded. A3 giclée print. |
| Still Water, Bavaria | still-water-bavaria | 4500 | photo | Dawn mist on Eibsee. Giclée print on 200 g matte paper, A3. |
| Brass & Velvet | brass-and-velvet | 6900 | ai-art | An imagined art-deco interior study. Generated with AI tools, curated by the artist. A2 giclée print. |

Pages: `about` ("About the atelier"), `impressum` ("Impressum"), `privacy` ("Privacy Policy"), `terms` ("Terms & Returns"). Seed content is placeholder legal text clearly marked "Draft — replace before taking real payments"; images for seeding are the four files in `seed/images/`.

---

## BLOCK D: API Endpoints

Canonical error shape everywhere: `{ "error": { "code": "ERROR_CODE", "message": "Human-readable text" } }`.

### D1 — `POST /next/checkout` — `src/app/(frontend)/next/checkout/route.ts`

Auth: none (public). Rate limit: 10 requests / minute / IP (Rule S3).

Request body:
```json
{ "productId": "3f9c2a7e-6b1d-4e0a-9c55-1a2b3c4d5e6f" }
```

200 response:
```json
{ "url": "https://checkout.stripe.com/c/pay/cs_test_a1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuVwXyZ" }
```

| Status | code | message | When |
|---|---|---|---|
| 400 | `INVALID_BODY` | Request body must contain a valid productId. | Zod fails |
| 404 | `PRODUCT_NOT_FOUND` | This product does not exist. | no row |
| 409 | `SOLD_OUT` | Sorry, this print just sold out. | `soldOut === true` |
| 429 | `RATE_LIMITED` | Too many checkout attempts. Please wait a minute and try again. | > 10/min |
| 502 | `STRIPE_UNAVAILABLE` | Checkout is temporarily unavailable. Please try again in a moment. | Stripe call throws / times out |
| 500 | `INTERNAL` | Something went wrong on our side. Nothing was charged. | any other exception |

```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from '@/lib/payload'
import { stripe } from '@/lib/stripe'
import { EUROPE_COUNTRIES } from '@/lib/countries'
import { rateLimit } from '@/lib/rate-limit'

const Body = z.object({ productId: z.string().uuid() })

const err = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status })

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  if (!rateLimit(`checkout:${ip}`, 10, 60_000)) return err(429, 'RATE_LIMITED', 'Too many checkout attempts. Please wait a minute and try again.')

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return err(400, 'INVALID_BODY', 'Request body must contain a valid productId.')

  const payload = await getPayload()
  const product = await payload.findByID({ collection: 'products', id: parsed.data.productId, depth: 1 }).catch(() => null)
  if (!product) return err(404, 'PRODUCT_NOT_FOUND', 'This product does not exist.')
  if (product.soldOut) return err(409, 'SOLD_OUT', 'Sorry, this print just sold out.')
  if (!Number.isInteger(product.price) || product.price < 100) return err(500, 'INTERNAL', 'Something went wrong on our side. Nothing was charged.')

  const base = process.env.NEXT_PUBLIC_SERVER_URL!
  const image = typeof product.image === 'object' && product.image?.url ? [product.image.url] : []

  // 1) create the order first (pending), so the webhook always finds a row
  const order = await payload.create({
    collection: 'orders',
    overrideAccess: true,
    data: {
      orderNumber: await nextOrderNumber(payload),
      status: 'pending',
      stripeSessionId: `placeholder-${crypto.randomUUID()}`,   // replaced below; column is NOT NULL UNIQUE
      items: [{ product: product.id, titleSnapshot: product.title, unitPrice: product.price, quantity: 1 }],
      currency: 'eur',
      total: product.price,
    },
  })

  // 2) create the Stripe session
  let session
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: product.price,
            product_data: { name: product.title, description: product.shortDescription, images: image },
          },
        }],
        shipping_address_collection: { allowed_countries: EUROPE_COUNTRIES },
        metadata: { orderId: order.id, orderNumber: order.orderNumber },
        client_reference_id: order.id,
        success_url: `${base}/order/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/products/${product.slug}?checkout=cancelled`,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,   // 1 h; minimum Stripe allows is 30 min
      },
      { idempotencyKey: `order-${order.id}`, timeout: 10_000 },
    )
  } catch {
    await payload.update({ collection: 'orders', id: order.id, overrideAccess: true, data: { status: 'cancelled' } })
    return err(502, 'STRIPE_UNAVAILABLE', 'Checkout is temporarily unavailable. Please try again in a moment.')
  }

  // 3) bind the session to the order
  await payload.update({ collection: 'orders', id: order.id, overrideAccess: true, data: { stripeSessionId: session.id } })

  return NextResponse.json({ url: session.url })
}

async function nextOrderNumber(payload: Awaited<ReturnType<typeof getPayload>>): Promise<string> {
  const year = new Date().getUTCFullYear()
  const { totalDocs } = await payload.count({
    collection: 'orders',
    where: { createdAt: { greater_than_equal: `${year}-01-01T00:00:00.000Z` } },
  })
  return `AM-${year}-${String(totalDocs + 1).padStart(6, '0')}`
}
```

`src/lib/countries.ts`:
```ts
// EU-27 + EEA (IS, LI, NO) + CH + GB. Stripe two-letter codes.
export const EUROPE_COUNTRIES = [
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
  'IS','LI','NO','CH','GB',
] as const satisfies readonly string[]
```

`src/lib/stripe.ts`:
```ts
import Stripe from 'stripe'
if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
  throw new Error('STRIPE_SECRET_KEY must be a Stripe TEST key (sk_test_...). Live keys are forbidden in this project.')
}
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true })
```

`src/lib/rate-limit.ts` (in-memory, per serverless instance — adequate for this scale):
```ts
const buckets = new Map<string, { count: number; resetAt: number }>()
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) { buckets.set(key, { count: 1, resetAt: now + windowMs }); return true }
  if (b.count >= limit) return false
  b.count += 1
  return true
}
```

### D2 — `POST /next/stripe/webhook` — `src/app/(frontend)/next/stripe/webhook/route.ts`

Auth: Stripe signature header `stripe-signature` verified against `STRIPE_WEBHOOK_SECRET`. Any other caller gets 400. Body must be read as raw text.

Events subscribed in the Stripe Dashboard (and in `stripe listen`): `checkout.session.completed`, `checkout.session.expired`.

Inbound payload (abridged, realistic):
```json
{
  "id": "evt_1Q9xYzAbCdEfGhIj",
  "type": "checkout.session.completed",
  "data": {
    "object": {
      "id": "cs_test_a1B2c3D4e5F6g7H8i9J0kLmNoPqRsTuVwXyZ",
      "object": "checkout.session",
      "payment_status": "paid",
      "payment_intent": "pi_3Q9xYzAbCdEfGhIj0KlMnOpQ",
      "amount_total": 4900,
      "currency": "eur",
      "client_reference_id": "3f9c2a7e-6b1d-4e0a-9c55-1a2b3c4d5e6f",
      "metadata": { "orderId": "3f9c2a7e-6b1d-4e0a-9c55-1a2b3c4d5e6f", "orderNumber": "AM-2026-000042" },
      "customer_details": { "email": "jonas.weber@example.com", "name": "Jonas Weber" },
      "collected_information": {
        "shipping_details": {
          "name": "Jonas Weber",
          "address": { "line1": "Bergmannstraße 12", "line2": null, "postal_code": "10961", "city": "Berlin", "state": null, "country": "DE" }
        }
      }
    }
  }
}
```

Responses:

| Status | Body | When |
|---|---|---|
| 200 | `{ "received": true }` | processed, or already processed (idempotent), or event type ignored |
| 400 | `{ "error": { "code": "INVALID_SIGNATURE", "message": "Webhook signature verification failed." } }` | bad/missing signature |
| 404 | `{ "error": { "code": "ORDER_NOT_FOUND", "message": "No order matches this Checkout Session." } }` | unknown session — Stripe will retry; after 3 days it gives up |
| 500 | `{ "error": { "code": "INTERNAL", "message": "Webhook processing failed." } }` | DB error — Stripe retries with backoff |

```ts
import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { getPayload } from '@/lib/payload'

export const runtime = 'nodejs'

const err = (status: number, code: string, message: string) =>
  NextResponse.json({ error: { code, message } }, { status })

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig ?? '', process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return err(400, 'INVALID_SIGNATURE', 'Webhook signature verification failed.')
  }

  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.expired') {
    return NextResponse.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const payload = await getPayload()
  const found = await payload.find({
    collection: 'orders', overrideAccess: true, limit: 1,
    where: { stripeSessionId: { equals: session.id } },
  })
  const order = found.docs[0]
  if (!order) return err(404, 'ORDER_NOT_FOUND', 'No order matches this Checkout Session.')

  try {
    if (event.type === 'checkout.session.completed') {
      if (order.status === 'paid') return NextResponse.json({ received: true })          // idempotent
      if (session.payment_status !== 'paid') return NextResponse.json({ received: true }) // card-only → always 'paid' here; guard anyway
      const ship = session.collected_information?.shipping_details ?? (session as unknown as { shipping_details?: Stripe.Checkout.Session.CollectedInformation.ShippingDetails }).shipping_details
      await payload.update({
        collection: 'orders', id: order.id, overrideAccess: true,
        data: {
          status: 'paid',
          paidAt: new Date(event.created * 1000).toISOString(),
          stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
          customerEmail: session.customer_details?.email ?? undefined,
          total: session.amount_total ?? order.total,
          shippingAddress: ship ? {
            name: ship.name ?? undefined,
            line1: ship.address?.line1 ?? undefined,
            line2: ship.address?.line2 ?? undefined,
            postalCode: ship.address?.postal_code ?? undefined,
            city: ship.address?.city ?? undefined,
            state: ship.address?.state ?? undefined,
            country: ship.address?.country ?? undefined,
          } : undefined,
        },
      })
    } else if (event.type === 'checkout.session.expired') {
      if (order.status === 'pending') {
        await payload.update({ collection: 'orders', id: order.id, overrideAccess: true, data: { status: 'cancelled' } })
      }
    }
  } catch {
    return err(500, 'INTERNAL', 'Webhook processing failed.')
  }
  return NextResponse.json({ received: true })
}
```

> Decision: Stripe's API moved the shipping address from `session.shipping_details` to `session.collected_information.shipping_details` in 2025 API versions. The handler reads the new location first and falls back to the old one so it works regardless of the account's pinned API version.

### D3 — Payload REST API `/api/*`

Used only by the admin UI. Public reads of `products`, `media`, `pages` are allowed by the access rules; everything else requires the admin cookie. No custom endpoints are added to it. Public pages use the Local API (`payload.find`) in Server Components, never `fetch('/api/…')`.

---

## BLOCK E: UI/UX

Test widths: **1280** and **375**. Nothing overflows horizontally at either. Dark theme only (no toggle in v1). A later design phase replaces visuals but must keep every id, state and copy text defined here.

### Design tokens — `src/app/(frontend)/globals.css`

```css
@import "tailwindcss";

:root {
  --bg: #0b0b0f;            /* page background */
  --surface: #14141b;       /* cards, footer */
  --surface-2: #1c1c26;     /* hover, inputs */
  --border: #2a2a38;
  --text: #f2f2f5;
  --text-muted: #9a9aad;
  --accent: #c9a24a;        /* brass */
  --accent-2: #7b5cff;      /* violet, gradient partner */
  --gradient: linear-gradient(135deg, #c9a24a 0%, #7b5cff 100%);
  --danger: #ff5c7a;
  --success: #41d39a;
  --radius: 14px;
  --font-sans: "Inter", system-ui, sans-serif;
  --font-display: "Fraunces", Georgia, serif;
}
body { background: var(--bg); color: var(--text); font-family: var(--font-sans); }
.gradient-text { background: var(--gradient); -webkit-background-clip: text; color: transparent; }
.gradient-ring { box-shadow: 0 0 0 1px var(--border), 0 0 40px -12px var(--accent-2); }
```

Fonts: Inter (body) and Fraunces (display) via `next/font/google`, weights 400/500/600 and 500/700.

### Shared layout — `(frontend)/layout.tsx`

```html
<header id="site-header" class="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/80 backdrop-blur">
  <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
    <a href="/" id="logo" class="font-[family-name:var(--font-display)] text-xl">Atelier <span class="gradient-text">Margoche</span></a>
    <nav class="flex gap-6 text-sm text-[var(--text-muted)]"><a href="/">Prints</a><a href="/info/about">About</a></nav>
  </div>
</header>
<main id="main" class="mx-auto max-w-6xl px-4 py-10">…</main>
<footer id="site-footer" class="mt-24 border-t border-[var(--border)] bg-[var(--surface)]">
  <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-[var(--text-muted)] md:flex-row md:justify-between">
    <p>© 2026 Atelier Margoche · Prices incl. VAT · Free shipping in Europe · Payments by Stripe (test mode)</p>
    <nav class="flex flex-wrap gap-4"><a href="/info/about">About</a><a href="/info/impressum">Impressum</a><a href="/info/privacy">Privacy</a><a href="/info/terms">Terms &amp; Returns</a></nav>
  </div>
</footer>
```

### Component table

| Component | shadcn/ui | Size / colors / states |
|---|---|---|
| Primary button (Buy now) | `Button` size `lg` | h-12, px-6, rounded-[var(--radius)], `background: var(--gradient)`, text `#0b0b0f` font-semibold; hover brightness-110; focus ring 2px `--accent-2`; disabled opacity-50 cursor-not-allowed; loading shows `Loader2` spinning + "Redirecting to secure checkout…" |
| Secondary button (Back to prints) | `Button` variant `outline` | h-10, border `--border`, text `--text` |
| Product card | `Card` | bg `--surface`, border `--border`, rounded 14, `.gradient-ring` on hover, image aspect 4/5 object-cover |
| Badge kind | `Badge` variant `secondary` | "Photo" bg `--surface-2`; "AI art" `background: var(--gradient)` text `#0b0b0f` |
| Badge sold out | `Badge` variant `destructive` | bg `--danger`/15, text `--danger`, text "Sold out" |
| Price | `<span class="tabular-nums">` | €49.00 from `formatEUR(4900)`; muted suffix "incl. VAT" |
| Banner (cancelled) | `Alert` | border `--border`, icon `Info`, text as in US4 |
| Toast | `sonner` `toast.error()` | bottom-right on 1280, bottom-center on 375, auto-dismiss 6 s |
| Skeleton | `Skeleton` | bg `--surface-2`, pulse |
| Status pill (order) | `Badge` | paid → `--success`/15 text `--success` "Paid"; pending → `--accent`/15 text `--accent` "Confirming…"; cancelled → `--danger`/15 "Cancelled" |

Icons (lucide-react): `Loader2`, `Info`, `CheckCircle2`, `Clock3`, `XCircle`, `ArrowLeft`, `Sparkles` (next to "AI art" disclosure), `Truck`.

`src/lib/money.ts`:
```ts
export const formatEUR = (cents: number) =>
  new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(cents / 100)  // "€49.00"
```

### Screen 1 — `/` Catalogue

Layout: hero (h1 + one line) then grid. 1280: `grid-cols-3 gap-8`; 375: `grid-cols-1 gap-6`. Hero h1 in Fraunces 44px/32px: "Prints from the <span class="gradient-text">atelier</span>". Sub: "Photographs and AI-made artworks, printed on archival paper. Free shipping in Europe."

```html
<section id="catalogue" class="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
  <a href="/products/golden-hour-lisbon" class="product-card" data-product-id="…" data-sold-out="false">
    <img src="…/card.webp" alt="Late-afternoon light over Alfama rooftops" class="aspect-[4/5] w-full rounded-t-[14px] object-cover" />
    <div class="p-4">
      <div class="flex items-center justify-between"><h2 class="text-lg font-medium">Golden Hour, Lisbon</h2><span class="badge-kind">Photo</span></div>
      <p class="mt-1 line-clamp-2 text-sm text-[var(--text-muted)]">Late-afternoon light over the Alfama rooftops…</p>
      <p class="mt-3 tabular-nums">€49.00 <span class="text-sm text-[var(--text-muted)]">incl. VAT</span></p>
    </div>
  </a>
</section>
```

| State | Exact rendering |
|---|---|
| Loading | Server-rendered; `loading.tsx` shows 3 (1 on 375) `Skeleton` cards 4/5 aspect + two text lines. |
| Empty | `<div id="catalogue-empty">` icon `Sparkles`, h2 "No prints yet", p "The atelier is preparing its first release. Check back soon.", link "About the atelier" → `/info/about`. |
| Error | `error.tsx`: h2 "We couldn't load the prints", p "Please refresh the page. If it keeps happening, the shop is temporarily down.", button "Try again" calling `reset()`. |

Actions: click card → `/products/[slug]`. Sold-out card: badge "Sold out" over the image top-left, image `grayscale opacity-70`, still clickable.

### Screen 2 — `/products/[slug]` Product detail

Layout 1280: two columns `grid-cols-[3fr_2fr] gap-12`, image left (hero size), details right sticky top-24. 375: single column, image first.

```html
<article id="product" data-product-id="…">
  <img id="product-image" src="…/hero.webp" alt="…" class="w-full rounded-[14px] object-cover" />
  <div id="product-details">
    <span class="badge-kind">AI art</span>
    <h1 class="mt-3 font-[family-name:var(--font-display)] text-4xl">Nebula Bloom</h1>
    <p class="mt-4 text-[var(--text-muted)]">A flower unfolding inside a nebula…</p>
    <p id="ai-disclosure" class="mt-3 flex items-center gap-2 text-sm text-[var(--text-muted)]"><svg data-icon="sparkles"/> Created with generative AI tools and curated by the artist.</p>
    <p class="mt-6 text-2xl tabular-nums">€59.00 <span class="text-base text-[var(--text-muted)]">incl. VAT</span></p>
    <p class="mt-1 flex items-center gap-2 text-sm text-[var(--text-muted)]"><svg data-icon="truck"/> Free shipping in Europe · Ships in 5–7 business days</p>
    <form id="buy-form" class="mt-8"><button id="buy-now" type="submit" class="btn-primary">Buy now</button></form>
    <a href="/" class="mt-4 inline-flex items-center gap-2 text-sm"><svg data-icon="arrow-left"/> Back to prints</a>
  </div>
</article>
```

`#ai-disclosure` renders only when `kind === 'ai-art'`. Banner `#checkout-cancelled` (Alert, icon Info) renders above `#product` when `?checkout=cancelled` is present: "Checkout cancelled. Nothing was charged."

| State | Exact rendering |
|---|---|
| Loading | `loading.tsx`: image Skeleton 4/5 + 4 text Skeletons. |
| Empty (sold out) | `#buy-now` replaced by `<span id="sold-out" class="badge-soldout">Sold out</span>` + p "This edition is gone. New prints are released regularly — see the catalogue." |
| Not found | `notFound()` → `not-found.tsx`: h1 "This page does not exist.", link "Back to prints". |
| Error | Toast on failed checkout, copy = `error.message` from Block D table; button returns to idle. |

Actions table:

| Trigger | Result | Failure |
|---|---|---|
| Submit `#buy-form` | Button → loading; `fetch('/next/checkout', {method:'POST', body:{productId}})`; on 200 `window.location.assign(url)` | 409 → toast "Sorry, this print just sold out." and page re-renders sold-out state; 429/502/500 → toast with server message; network error → toast "You appear to be offline. Nothing was charged." |
| Double-click Buy now | Second click ignored (`disabled` while loading) | — |

### Screen 3 — `/order/[orderId]?session_id=…` Order confirmation

Server component loads the order by UUID; **if `order.stripeSessionId !== session_id` → `notFound()`**. Renders status; if `pending`, mounts `OrderStatusPoller` (client) that calls `router.refresh()` every 3 s for 30 s, then every 5 s indefinitely.

```html
<section id="order" data-order-status="paid" class="mx-auto max-w-2xl">
  <span class="status-pill status-paid"><svg data-icon="check-circle-2"/> Paid</span>
  <h1 class="mt-4 font-[family-name:var(--font-display)] text-4xl">Order paid — thank you, Jonas!</h1>
  <p class="mt-2 text-[var(--text-muted)]">Order AM-2026-000042 · 24 Sep 2026</p>
  <div class="mt-8 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-6">
    <div class="flex gap-4"><img class="h-24 w-20 rounded object-cover" src="…/card.webp" alt="…"/><div><p class="font-medium">Golden Hour, Lisbon</p><p class="text-sm text-[var(--text-muted)]">1 × €49.00</p></div></div>
    <hr class="my-4 border-[var(--border)]"/>
    <p class="flex justify-between"><span>Total</span><span class="tabular-nums">€49.00</span></p>
  </div>
  <div id="shipping" class="mt-6 text-sm"><h2 class="font-medium">Ships to</h2><address class="mt-1 not-italic text-[var(--text-muted)]">Jonas Weber<br/>Bergmannstraße 12<br/>10961 Berlin<br/>Germany</address></div>
  <p class="mt-6 text-sm text-[var(--text-muted)]">A receipt was sent to jonas.weber@example.com by Stripe (test mode).</p>
  <a href="/" class="btn-secondary mt-8">Back to prints</a>
</section>
```

| Status | Pill | H1 | Body |
|---|---|---|---|
| `paid` | Paid (success) | "Order paid — thank you, {firstName}!" (if no name: "Order paid — thank you!") | items, total, shipping, email line |
| `pending` (≤30 s) | Confirming… (accent, `Clock3`) | "Confirming your payment…" | "This usually takes a few seconds. Please keep this page open." + items + total; no shipping (not yet known) |
| `pending` (>30 s) | Confirming… | "We're still confirming your payment." | "This page will update automatically; you can also come back later using this link. Nothing else is needed from you." |
| `cancelled` | Cancelled (danger, `XCircle`) | "This checkout was not completed." | "Nothing was charged. You can start again from the product page." + link to product |

| State | Exact rendering |
|---|---|
| Loading | `loading.tsx`: pill Skeleton + h1 Skeleton + card Skeleton. |
| Empty / not found | UUID unknown or `session_id` mismatch → `not-found.tsx` (copy as Screen 2). |
| Error | `error.tsx` (same as Screen 1) with h2 "We couldn't load your order". |

### Screen 4 — `/info/[slug]` Static page

Layout: `max-w-2xl mx-auto prose prose-invert`. h1 = page title; rich text rendered via `@payloadcms/richtext-lexical/react` `RichText`. Slug not found → `not-found.tsx`. Loading: h1 Skeleton + 6 line Skeletons. Empty: content is required, so cannot be empty. Error: `error.tsx` "We couldn't load this page".

> Decision: Every route has a `loading.tsx`, so Next.js streams the page shell before the data query finishes. A `notFound()` after that point renders `not-found.tsx` as a soft 404: HTTP 200 plus `<meta name="robots" content="noindex">`. Tests check the rendered copy and the noindex tag, not the status code. `/products/[slug]` and `/info/[slug]` return `[]` from `generateStaticParams`, so the build never queries them; they render on first request and are then cached with `revalidate = 60` plus hook-driven `revalidatePath`.

### Admin `/admin`

Payload's default UI, unmodified except: `admin.meta.titleSuffix: ' · Atelier Margoche'`. Orders list default sort `-createdAt`, default columns per collection config. No custom components in v1.

### Responsive

| Breakpoint | Change |
|---|---|
| `< 768` (375 test) | Single-column grids; header nav keeps two links (fits); footer stacks; product detail image above text; buttons full width (`w-full`). |
| `≥ 768` | Catalogue 3 columns; product detail two columns; footer row. |
| `≥ 1280` (1280 test) | `max-w-6xl` container (1152 px) centered; no other change. |

Images use `next/image` with `sizes="(max-width: 768px) 100vw, 33vw"` on cards and `60vw` on hero; `remotePatterns` includes `*.public.blob.vercel-storage.com`.

---

## BLOCK F: Business Logic

### Validation

**Admin — Product form** (enforced by Payload field config in Block C; copy shown inline under the field):

| Field | Type | Rules (ordered) | Error copy | On violation |
|---|---|---|---|---|
| title | text | required; 2–80 chars | "Title is required (2–80 characters)." | Save blocked |
| slug | text | auto from title if empty; `^[a-z0-9]+(?:-[a-z0-9]+)*$`; ≤80; unique | "Slug must be lowercase letters, numbers and hyphens only." / "A product with this slug already exists." | Save blocked |
| price | number | required; integer; 100 ≤ p ≤ 1,000,000 | "Price must be a whole number of cents (e.g. 4900 for €49.00)." | Save blocked |
| shortDescription | textarea | required; 10–200 chars | "Description must be 10–200 characters." | Save blocked |
| image | upload | required; jpeg/png/webp; ≤ 8 MB | "A product photo is required." / "Only JPEG, PNG and WebP images are allowed." / "File exceeds the 8 MB limit." | Save blocked |
| kind | select | required; `photo` or `ai-art` | "Choose Photo or AI art." | Save blocked |
| soldOut | checkbox | boolean | — | — |

**Admin — Media**: `alt` required, ≤160 → "Alt text is required for accessibility."
**Admin — Page**: title required ≤80; slug `^[a-z0-9-]{2,40}$` unique; content required → "Content cannot be empty."
**Admin — Login**: email format; password ≥ 8 chars (Payload default) → Payload's own copy "The email or password provided is incorrect." (never reveals which).
**Public — `POST /next/checkout`**: `productId` UUID → 400 `INVALID_BODY` (Block D).

### Business rules

| # | Rule | Violation / failure behaviour |
|---|---|---|
| B1 | Money is INTEGER cents, currency EUR, formatted only by `formatEUR` at render. | Non-integer price cannot be saved (validation). Checkout route returns 500 `INTERNAL` if it ever reads one. |
| B2 | An Order is created with `status: pending` **before** the Stripe Session, then bound to `stripeSessionId`. | Stripe failure → order set `cancelled`, 502 to client. Never leave a pending order without a session for > 1 request. |
| B3 | `status` transitions allowed: `pending → paid` (webhook completed only), `pending → cancelled` (webhook expired, or Stripe create failure). `paid` is terminal. `cancelled` is terminal. | Any other transition attempted in code → throw; the admin UI may edit `ownerNote` only — a `beforeChange` hook on Orders rejects status changes by admins with "Order status is set by Stripe confirmation and cannot be edited." |
| B4 | `orderNumber` = `AM-YYYY-NNNNNN`, sequence per UTC year. | Unique collision → recompute once with `+1`; second collision → 500 `INTERNAL`. |
| B5 | Sold-out check happens server-side at session creation. UI state is a convenience only. | `soldOut` → 409 `SOLD_OUT`, no order row. |
| B6 | A product marked sold out **after** a session was created is still sold if paid. Stock is not decremented automatically (single-edition prints are toggled by the owner). | Owner sees the order and resolves manually. |
| B7 | Webhook is the only writer of `paid`. Signature must verify. Handler is idempotent on `order.status`. | Bad signature → 400, nothing written. Duplicate event → 200, nothing written. |
| B8 | Confirmation page is read-only and requires `session_id` to equal `order.stripeSessionId`. | Mismatch → 404. |
| B9 | Confirmation polling: `router.refresh()` every 3 s for 30 s, then every 5 s; stops when status ≠ pending. | Tab hidden → polling pauses (`document.visibilityState`), resumes on focus. |
| B10 | Public pages revalidate on Payload `afterChange`/`afterDelete` via `revalidatePath`; additionally `export const revalidate = 60` as a safety net. | Edit visible ≤ 60 s worst case, typically immediate. |
| B11 | Deleting a Product sets `orders_items.product` to null; `titleSnapshot`/`unitPrice` keep the history. Deleting Media used by a product is blocked by Payload's relationship integrity → copy "This image is used by a product. Replace it there first." | — |
| B12 | The four seeded Pages slugs cannot be deleted (hook in Block C). | Error copy "Legal pages cannot be deleted. Edit the content instead." |
| B13 | `kind === 'ai-art'` renders the AI disclosure line on the product page and the "AI art" badge everywhere the product appears. | Missing kind cannot happen (required, default `photo`). |
| B14 | Mutation pipeline (public): validate → write DB → call Stripe → bind → redirect. Any failure after the DB write rolls the order to `cancelled` and shows the user the exact error copy from Block D. | — |
| B15 | `STRIPE_SECRET_KEY` must start with `sk_test_`; the app refuses to boot otherwise. | Thrown at import of `lib/stripe.ts`. |

### Auth (M1) — Payload built-in, admin only

| Flow | Steps |
|---|---|
| First user | Users table empty → `/admin` redirects to `/admin/create-first-user` → name, email, password (≥ 8 chars) → logged in. Screen disappears forever after. |
| Login | `/admin/login` → email + password → Payload sets HTTP-only cookie `payload-token` (JWT, `SameSite=Lax`, `Secure` in prod), expiry 2 h. 5 failed attempts → account locked 15 min, copy "This account is locked due to too many failed attempts. Try again in 15 minutes." |
| Logout | `/admin/logout` clears the cookie. |
| Password reset | No email transport is configured. Reset path: run `npm run reset-password -- --email owner@example.com --password 'NewStrongPass1!'` locally (script uses Local API `payload.update` with `overrideAccess`). > Decision: avoids configuring an email provider for a one-person shop; documented in README. |
| New admin | Only an existing admin can create a user in `/admin/collections/users`. |

### Security (M2/M3)

| Topic | Rule |
|---|---|
| CORS | `payload.config.ts`: `cors: [process.env.NEXT_PUBLIC_SERVER_URL]`, `csrf: [process.env.NEXT_PUBLIC_SERVER_URL]`. Custom `/next/*` routes are same-origin only (no CORS headers set). |
| Rate limiting | `/next/checkout` 10/min/IP → 429. `/admin/login` protected by Payload lock (above). Webhook has no rate limit (Stripe-signed). |
| Input sanitization | Zod on `/next/checkout`; Payload validates admin input; rich text rendered by Payload's React renderer (escapes by construction); never `dangerouslySetInnerHTML`. |
| ID forgery | Order UUIDs + `session_id` match (B8). Products are public. Orders/Users REST reads require the admin cookie. |
| Secrets | Only via `process.env.*`. `.env` and `.env.*` ignored; `.env.example` committed with names + source comments. Vercel envs set for Production and Preview. |
| Headers | `next.config.mjs` `headers()`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` for `/(frontend)` routes. Admin routes keep Payload defaults. |

Environment variables (`.env.example`):

```bash
DATABASE_URI=            # Supabase → Project Settings → Database → Connection string → "Session pooler" (URI). Port 5432.
PAYLOAD_SECRET=          # any 32+ random chars: `openssl rand -hex 32` (Git Bash) or `[guid]::NewGuid()` twice in PowerShell
NEXT_PUBLIC_SERVER_URL=  # http://localhost:3000 locally; https://<project>.vercel.app on Vercel
STRIPE_SECRET_KEY=       # Stripe Dashboard (Test mode ON) → Developers → API keys → Secret key, starts with sk_test_
STRIPE_WEBHOOK_SECRET=   # locally: printed by `stripe listen`; on Vercel: Developers → Webhooks → your endpoint → Signing secret, starts with whsec_
BLOB_READ_WRITE_TOKEN=   # Vercel → Storage → Blob store → .env.local tab (auto-injected when the store is linked to the project)
```

### Payments (M4) — Stripe, sandbox

| Item | Value |
|---|---|
| Provider | Stripe hosted Checkout, `mode: 'payment'`, `payment_method_types: ['card']`, prices passed inline via `price_data` (no Stripe Products created). |
| Currency / VAT | EUR; prices are VAT-inclusive; no Stripe Tax. |
| Shipping | `shipping_address_collection` with `EUROPE_COUNTRIES` (32 countries); no shipping fee. |
| Session lifetime | 1 h (`expires_at`). |
| Webhook | Contract in Block D2. Local: `stripe listen --forward-to localhost:3000/next/stripe/webhook`. Prod: Dashboard endpoint `https://<domain>/next/stripe/webhook`, events `checkout.session.completed`, `checkout.session.expired`. |
| Idempotency | Stripe create: `idempotencyKey: order-<uuid>`. Webhook: status check (B7). |
| Test cards | Success `4242 4242 4242 4242`; decline `4000 0000 0000 0002`; any future expiry, any CVC. |
| Refunds / cancellation | Not implemented in-app. Owner refunds in the Stripe Dashboard and writes `ownerNote`. Order status stays `paid` (history). > Decision: a `refunded` status is out of v1 scope; listed in README extensions. |
| Failure | Stripe unreachable → 502 `STRIPE_UNAVAILABLE`, order `cancelled`. |

### Integrations (M12)

| Integration | Sends | Receives | Timeout | Retry | Fallback when down |
|---|---|---|---|---|---|
| Stripe `checkout.sessions.create` | Block D1 params | `{ id: "cs_test_…", url: "https://checkout.stripe.com/…" }` | 10 s | 1 automatic retry by the Stripe SDK on network error (same idempotency key) | 502 to user, order → cancelled, exact copy in Block D |
| Stripe webhook (inbound) | — | Block D2 event | n/a | Stripe retries non-2xx with exponential backoff for up to 3 days | Order stays `pending`; confirmation page shows the >30 s copy; owner can inspect Stripe Dashboard → Webhooks → resend |
| Vercel Blob (`@payloadcms/storage-vercel-blob`) | uploaded image bytes | public `https://…public.blob.vercel-storage.com/…` URL | adapter default | none | Admin sees Payload upload error "Upload failed. Please try again."; product save blocked because image is required |

### Legal & Privacy (M5)

Shop operator is based in Germany, ships to Europe. This section lists what the app must implement; the seeded page texts are drafts marked for replacement before real payments (GO-LIVE-PLAN.md).

| Requirement | Implementation |
|---|---|
| Impressum (§5 DDG) | Page `impressum`, footer link on every page. |
| Privacy policy (GDPR Art. 13) | Page `privacy`: data processed (email, shipping address, payment handled by Stripe Payments Europe Ltd as independent controller for card data), purposes (order fulfilment), storage (orders kept for statutory retention), no cookies except the admin session cookie, no analytics. |
| Terms & Returns (BGB §312g, 14-day withdrawal) | Page `terms`: withdrawal right, return procedure, contact. |
| Price transparency (PAngV) | Every price shows "incl. VAT"; footer states "Free shipping in Europe". |
| Button clarity (§312j BGB) | The payment obligation button is Stripe's "Pay €49.00" on the hosted page; our "Buy now" only starts checkout. |
| EU AI Act Art. 50 transparency | `kind: 'ai-art'` products show badge "AI art" and the disclosure line "Created with generative AI tools and curated by the artist." on the product page; `about` page states that some works are AI-generated. |
| Data minimisation | The app stores only what the webhook delivers (email, name, address). No customer accounts, no IP logging beyond Vercel's default request logs. |

---

## BLOCK G: Edge Cases (28)

**Network**

| # | Situation → Trigger → Expected |
|---|---|
| G1 | Customer clicks Buy now while offline → fetch rejects → toast "You appear to be offline. Nothing was charged."; button idle; no order created (request never reached the server). |
| G2 | Server created the order but the response is lost before redirect → order `pending` bound to a session; customer retries → new order; the first expires in 1 h → `cancelled` via webhook. |
| G3 | Stripe API times out (>10 s) → 502 `STRIPE_UNAVAILABLE`, order `cancelled`, toast with that copy. |
| G4 | Webhook delivery fails (Vercel 5xx during deploy) → Stripe retries; order stays `pending`; confirmation page keeps polling and shows the >30 s copy. |
| G5 | Blob storage unreachable during admin upload → Payload error "Upload failed. Please try again."; product not saved. |

**Storage & data**

| # | Situation → Trigger → Expected |
|---|---|
| G6 | Two admins edit the same product simultaneously → last save wins (Payload default); no lock. Acceptable for one owner. |
| G7 | Product deleted after an order was paid → `orders_items.product` null; confirmation page and admin show `titleSnapshot` and `unitPrice`; image slot shows a neutral placeholder square. |
| G8 | Media deleted while referenced → blocked with "This image is used by a product. Replace it there first." |
| G9 | `orderNumber` collision (two checkouts in the same millisecond) → unique constraint fails → recompute once; second failure → 500 and order not created. |
| G10 | Migration pending in production (schema drift) → build step `payload migrate` applies it before `next build`; if it fails the deploy fails and the previous deployment stays live. |
| G11 | Webhook arrives for a session whose order row does not exist (order created in a preview deployment with another DB) → 404 `ORDER_NOT_FOUND`; Stripe retries then gives up; nothing marked paid. |

**Input & security**

| # | Situation → Trigger → Expected |
|---|---|
| G12 | Forged webhook with valid JSON but wrong signature → 400 `INVALID_SIGNATURE`; no DB access happens. |
| G13 | Replayed genuine webhook (same event id) → order already `paid` → 200, no write (idempotent). |
| G14 | Attacker guesses `/order/<uuid>` without `session_id` or with another session's id → 404. |
| G15 | Body `{ "productId": "1 OR 1=1" }` → Zod UUID check fails → 400. Payload uses parameterised queries; no injection surface. |
| G16 | Admin pastes `<script>` into a description → stored as text; rendered escaped by React; rich text rendered by Payload's serializer (no raw HTML nodes enabled). |
| G17 | Someone POSTs to `/api/products` without cookie → Payload access `create: false` for anonymous → 403 by Payload. |
| G18 | `STRIPE_SECRET_KEY` accidentally set to `sk_live_…` → app throws at boot (B15); Vercel deployment fails; nothing goes live. |
| G19 | Brute-force on `/admin/login` → 5 failures lock the account 15 min with the exact copy in Block F. |

**Limits**

| # | Situation → Trigger → Expected |
|---|---|
| G20 | Upload 14 MB image → "File exceeds the 8 MB limit." |
| G21 | Upload `.gif` or `.pdf` → "Only JPEG, PNG and WebP images are allowed." |
| G22 | Description 201 chars → "Description must be 10–200 characters." |
| G23 | Price 99 or 0 → price error copy; price 1,000,001 → same rule (max). |
| G24 | 51st product → allowed by code (no hard block), but README states the catalogue is designed for ≤50 and the catalogue page has no pagination. |

**Time**

| # | Situation → Trigger → Expected |
|---|---|
| G25 | Checkout started at 23:59:30 UTC on 31 Dec → orderNumber year = year of `createdAt` in UTC; sequence resets with the new year on the next order. Displayed dates use `Europe/Berlin` via `Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin' })`. |
| G26 | Customer completes payment 55 min after session creation (session still valid) → webhook `completed` → `paid`; the expired event never fires. |

**Payments**

| # | Situation → Trigger → Expected |
|---|---|
| G27 | Double charge attempt: customer pays, then presses back and pays again on the same Stripe page → Stripe blocks (session already complete) and redirects to `success_url`; one order, one charge. |
| G28 | Customer abandons Stripe page mid-payment → session expires after 1 h → `checkout.session.expired` → order `cancelled`; nothing charged. Declined card (`4000 0000 0000 0002`) → Stripe shows the decline inline; no `completed` event; order `pending` until expiry. Refund issued in Dashboard → no webhook handled; order remains `paid`; owner records it in `ownerNote`. |

---

## BLOCK H: Definition of Done

1. **Files & routes.** Exactly 5 collections (`users`, `media`, `products`, `orders`, `pages`); exactly 2 custom route handlers (`/next/checkout`, `/next/stripe/webhook`); public routes `/`, `/products/[slug]`, `/order/[orderId]`, `/info/[slug]` plus `not-found.tsx`, `error.tsx`, `loading.tsx` for each. `npm run build` passes with zero TypeScript errors and zero ESLint errors.
2. **Acceptance boxes.** Every checkbox in Block B passes at 1280 and 375; no horizontal scrollbar at either width on any public route.
3. **Zero console errors** on this click-script in a fresh browser: `/` → click first card → click Buy now → complete with 4242 → land on `/order/…` → wait for "Paid" → click Back to prints → footer Impressum → footer Privacy → footer Terms.
4. **Payment invariants.** (a) `grep -rn "status: 'paid'" src/` returns exactly one hit, inside `next/stripe/webhook/route.ts`. (b) A declined-card checkout leaves the order `pending` (screenshot of admin Orders list attached to the payments PR). (c) Replaying the same webhook event with `stripe events resend` produces no second write. (d) A request to the webhook without a signature returns 400.
5. **Live-edit invariant.** Editing a product price in `/admin` on the production deployment is visible on the public page within 60 s without a new Vercel deployment (Vercel → Deployments shows no new build).
6. **Secrets.** `git log --all -p | grep -E "sk_test_|sk_live_|whsec_|postgres(ql)?://" | grep -vE "localhost|sk_test_dummy|whsec_dummy"` returns nothing (the `localhost` example in `.env.example` and CI dummy values are the only tolerated matches). `.env.example` lists all 6 variables with source comments. Vercel has the same 6 set for Production and Preview.
7. **Tests.** `npm run test` (Vitest): `tests/unit/webhook.test.ts` — valid signature (built with `stripe.webhooks.generateTestHeaderString`) marks a mocked pending order paid; invalid signature → 400; duplicate → no second update; `expired` → cancelled. `npm run test:e2e` (Playwright, against `npm run dev` with seeded DB): catalogue renders 4 cards; sold-out product shows "Sold out" and `POST /next/checkout` returns 409; product page shows AI disclosure only for `ai-art`; `/order/<uuid>` with wrong `session_id` → 404; `/info/impressum` renders.
8. **CI.** `.github/workflows/ci.yml` runs on every PR: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run build` (with dummy env values that satisfy B15's `sk_test_` prefix check and a `DATABASE_URI` pointing at a `postgres:16` service container). PR template contains the checklist: tests green · no secrets · matches SPEC.md · screenshots for UI changes.
9. **Deployment.** Live at `https://<project>.vercel.app`; Vercel build command `npm run ci` where `"ci": "payload migrate && next build"`; Blob store linked; Stripe webhook endpoint registered and showing recent 200s in the Dashboard; project deployed from the developer's personal GitHub repository, and the full history pushed to the Turing College repository at hand-in.
10. **Docs.** `README.md` sections in this order: What the shop sells · How the owner edits content (login URL, Products, Pages, sold-out toggle, Orders view) · Run locally (prereqs Node ≥ 20, `npm install`, `.env` from `.env.example`, `npm run dev`, `stripe listen …`, `npm run seed`) · Environment variables and where each value comes from (no secrets) · Optional tasks completed (Orders collection, Order confirmation page, Sold-out state, Second collection: Pages, Written go-live plan → `docs/GO-LIVE-PLAN.md`) · Test cards · Future extensions (cart, digital downloads, refunds status, health check). `docs/GO-LIVE-PLAN.md` covers: Stripe account activation, key swap with new env values, live webhook endpoint + new signing secret, VAT/OSS registration note for cross-border EU sales, replacing draft legal texts, removing the `sk_test_` boot guard deliberately as the last step. `CLAUDE.md` (stage 2) opens with the plain-language description of the shop and states that it needs both a CMS and a payment.
