---
paths:
  - "src/app/(frontend)/**"
  - "src/components/**"
  - "src/lib/money.ts"
---

# Frontend rules (SPEC.md Block E)

- Dark theme only; tokens live in `globals.css` exactly as in Block E. Use `var(--token)`; do not hardcode hex values in components.
- Element ids and `data-*` attributes named in Block E are contracts for the e2e tests: `#site-header`, `#catalogue`, `.product-card[data-product-id][data-sold-out]`, `#product`, `#buy-form`, `#buy-now`, `#sold-out`, `#ai-disclosure`, `#checkout-cancelled`, `#order[data-order-status]`, `#catalogue-empty`. Keep them.
- Only the catalogue has `loading.tsx` (in the `(catalogue)` group); detail routes have none so `notFound()` returns a real 404. The frontend group has `not-found.tsx` and `error.tsx` with the exact copy from Block E.
- Prices render only through `formatEUR(cents)`; always followed by "incl. VAT".
- Images via `next/image`; Blob hostname allow-listed in `next.config.mjs` `images.remotePatterns`.
- Public pages: `export const dynamic = 'force-dynamic'` is NOT used; use `export const revalidate = 60` plus hook-driven `revalidatePath`.
- Buy now button: disabled while loading, shows `Loader2` + "Redirecting to secure checkout…"; errors surface via `sonner` toast with the server's `error.message`; on 409 re-render the sold-out state.
- No client-side state libraries, no analytics, no third-party scripts. shadcn/ui + lucide-react only.
- Test at 1280 and 375; no horizontal overflow.
