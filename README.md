# Atelier Margoche

A small online shop for art prints — photographs and AI-generated artworks — with an owner-editable catalogue and Stripe checkout.

**Live:** https://atelier-margoche-shop.vercel.app

## How it works

- **Works** (`/`) is the full catalogue grid; every available card has its own Buy now, so a print can be bought without opening its page.
- **Gallery** (`/gallery`) is a showcase of the prints that are not sold out, one large work at a time, with arrows, side previews of the previous and next work, and auto-advance every 7 s that pauses on hover. Each product page opens its image in a full-screen lightbox.
- The owner edits products and pages in the Payload admin; changes go live within a minute, with no redeploy.
- "Buy now" opens Stripe's hosted Checkout in sandbox (test) mode — no real money moves. An order is marked paid only by the Stripe webhook, after its signature is verified — never by the thank-you page.
- A declined card leaves the order `pending`; nothing is marked paid.

## Screenshots

![Works](docs/screenshots/works.jpg)

*Works — the catalogue grid at `/`; Buy now appears on a card on hover.*

![Gallery](docs/screenshots/gallery.jpg)

*Gallery — the showcase at `/gallery` with arrows, side previews and the caption with Buy now.*

![Product page](docs/screenshots/product.jpg)

*Product page — price incl. VAT, shipping note and Buy now.*

![Lightbox](docs/screenshots/lightbox.jpg)

*Lightbox — the product image full-screen; Esc, × or a click on the backdrop closes it.*

![Sold out](docs/screenshots/works-sold-out.jpg)

*Sold out set from the admin panel: badge, no Buy now, checkout refused.*

<p>
  <img src="docs/screenshots/order-paid.png" alt="Order confirmation showing Paid" width="49%">
  <img src="docs/screenshots/admin-orders.png" alt="Admin Orders list" width="49%">
</p>

*Order confirmation after the webhook marked it paid · the Orders list in the admin panel.*

## Owner guide

Log in at [/admin](https://atelier-margoche-shop.vercel.app/admin) with email and password.

- **Products** — title, slug, price (in cents), short description, image, kind (Photo / AI art) and the **Sold out** toggle. A sold-out product keeps its card in Works with a "Sold out" badge and no Buy now, leaves the Gallery showcase, and its product page shows "Sold out"; checkout for it is refused.
- **Pages** — About, Impressum, Privacy, Terms & Returns: title, slug, rich-text content. The four legal pages can be edited but not deleted.
- **Media** — uploaded images are stored in Vercel Blob (JPEG, PNG or WebP, up to 8 MB).
- **Orders** — every checkout with status (`pending`, `paid`, `cancelled`), items, total, customer email and shipping address; the owner can add a note. Orders are created by the server only.

Reviewers need no credentials: the demo runs on a screen-shared call, and if admin access is requested the owner creates a temporary `reviewer@…` user and deletes it afterwards.

## Run locally

Requires Node ≥ 20 and the [Stripe CLI](https://docs.stripe.com/stripe-cli).

```bash
cp .env.example .env      # then fill in the values (see below)
npm install
npm run migrate
npm run seed
npm run dev               # http://localhost:3000
```

`npm run seed` refuses to run once any product exists, so it cannot overwrite a live catalogue; `npm run seed -- --force` upserts the seed products anyway.

Local development should set `BLOB_READ_WRITE_TOKEN` too, so media served by Payload resolves: the files live in Vercel Blob, not in the local `media/` folder.

On first start, open http://localhost:3000/admin and create the first admin user.

```bash
stripe listen --events checkout.session.completed,checkout.session.expired --forward-to localhost:3000/next/stripe/webhook
```

## Environment variables

| Name | Where to get it |
|---|---|
| `DATABASE_URI` | Supabase → Project Settings → Database → Connection string (URI) |
| `PAYLOAD_SECRET` | Any 32+ random characters, e.g. `openssl rand -hex 32` |
| `NEXT_PUBLIC_SERVER_URL` | `http://localhost:3000` locally; `https://atelier-margoche-shop.vercel.app` on Vercel |
| `STRIPE_SECRET_KEY` | Stripe Dashboard (Test mode) → Developers → API keys → Secret key (`sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | Locally: printed by `stripe listen`. Vercel: Developers → Webhooks → endpoint → Signing secret (`whsec_…`) |
| `BLOB_READ_WRITE_TOKEN` | Vercel → Storage → Blob store (injected automatically when linked). Set it locally too |

Use the Supabase **Session pooler** URI (port 5432) locally and the **Transaction pooler** URI (port 6543) on Vercel. The app refuses to start unless the Stripe key starts with `sk_test_`.

## Deployment

- Vercel project connected to this GitHub repository; env variables set for Production and Preview.
- Build command `npm run ci`: Production deploys run `payload migrate && next build`; Preview deploys only run `next build`, so a PR branch never changes the live schema. Migrations apply when the PR is merged and Production deploys.
- A Vercel Blob store is linked to the project, and a Stripe webhook endpoint points at `https://atelier-margoche-shop.vercel.app/next/stripe/webhook` (events `checkout.session.completed`, `checkout.session.expired`).

## Optional tasks delivered

- Orders collection
- Order confirmation page (`/order/[orderId]`)
- Sold-out state
- Second collection: Pages
- Written go-live plan — [docs/GO-LIVE-PLAN.md](docs/GO-LIVE-PLAN.md)

## Test cards

Success: `4242 4242 4242 4242` · Decline: `4000 0000 0000 0002` (the order stays `pending`).
Any future expiry date, any CVC, any postcode.

## Stack

Next.js (App Router, TypeScript) · Payload 3 · Supabase Postgres · Vercel Blob · Stripe Checkout · Tailwind v4 + shadcn/ui · Zod · Vitest + Playwright · Vercel — built with the Payload skills and the Stripe Claude Code plugin installed beforehand.

Planned: cart, per-product mockup image, digital downloads.
