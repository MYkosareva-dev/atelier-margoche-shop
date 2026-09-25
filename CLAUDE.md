# Atelier Margoche — CLAUDE.md

## What this project is

Atelier Margoche is a small online print shop. The owner (Margarita) sells a handful of art prints — photographs and AI-generated artworks — and edits the catalogue herself through a login-protected admin panel, with changes going live on the site without a redeploy. Customers pick a print, click "Buy now", and pay through Stripe's hosted Checkout in **sandbox mode** (test keys only; no real money ever moves). An order is recorded as paid **only** when Stripe's webhook reaches our server and its signature is verified — never because the customer reached the thank-you page. The shop is deployed on Vercel at a public URL.

This project needs both halves by design: the **CMS** (Payload, owner-editable Products and Pages) and the **payment** (Stripe Checkout + verified webhook). Neither is optional.

## Single source of truth

`SPEC.md` at the repository root is the complete technical specification. When this file and SPEC.md disagree, SPEC.md wins. When SPEC.md is silent, choose the simplest option that keeps every acceptance box in SPEC.md Block B green, and record the choice as a `> Decision:` line in SPEC.md.

Do not invent features that are listed under "OUT" in SPEC.md Block B (cart, customer accounts, quantity selector, coupons, digital downloads, email sending, search, categories, multi-currency, separate databases, custom domain).

## Stack (see SPEC.md Block A for versions and constraints)

Next.js App Router + TypeScript · Payload 3 (inside the Next.js app) · Supabase Postgres (one project; Session pooler locally, Transaction pooler on Vercel) · Vercel Blob for uploads · Stripe hosted Checkout (EUR, test mode) · Tailwind v4 + shadcn/ui (dark theme) · Zod · Vitest + Playwright · npm · Vercel.

## Commands

```bash
npm run dev            # Next.js + Payload at http://localhost:3000, admin at /admin
npm run build          # next build (type errors fail the build)
npm run ci             # Vercel build: payload migrate && next build on Production, only next build on Preview
npm run lint           # eslint
npm run test           # vitest (unit)
npm run test:e2e       # playwright (needs `npm run dev` + seeded DB)
npm run seed           # 4 products + 4 pages from src/seed.ts
npm run payload migrate:create   # after ANY collection change
npm run migrate                  # apply pending migrations (db push is off everywhere)
# after changing any collection: npm run payload migrate:create && npm run migrate
npm run payload generate:types   # refresh src/payload-types.ts
stripe listen --forward-to localhost:3000/next/stripe/webhook   # local webhooks
```

## Non-negotiables (also enforced by `.claude/rules/`)

1. **Secrets never enter git — and never enter this conversation.** `.env`, `.env.*` are ignored; only `.env.example` (names + source comments) is committed. Read secrets exclusively via `process.env.*` in code. Never open, print, grep or echo `.env*` files or environment variables containing keys — `.claude/settings.json` denies those tools, and if you believe a value is wrong, ask the owner to check it themselves rather than reading it. To verify env presence use `node -e "console.log(Boolean(process.env.STRIPE_SECRET_KEY))"` (prints true/false only).
2. **`status: 'paid'` is written in exactly one place:** `src/app/(frontend)/next/stripe/webhook/route.ts`, after `stripe.webhooks.constructEvent` succeeds. The confirmation page only reads.
3. **Test keys only.** `src/lib/stripe.ts` throws unless `STRIPE_SECRET_KEY` starts with `sk_test_`. Never remove that guard.
4. **Money is integer cents** everywhere; `formatEUR()` is the only formatter.
5. **Custom server routes live under `/next/*`**, never `/api/*` (Payload owns `/api`).
6. **Payload owns the schema.** Change collections in `src/collections/*.ts`, then run `payload migrate:create`. Never edit tables in Supabase by hand.
7. **Access rules:** Products/Media/Pages — read: anyone; create/update/delete: `req.user` only. Orders — read/update: `req.user`; create/delete: never via API (server Local API only).
8. **Every user-visible string comes from SPEC.md** (Blocks B, D, E, F). Do not paraphrase error copy.
9. **Never push, merge or deploy.** git push, PR merges and Vercel deploys are done by the owner only, after she reviews the diff. You may create branches and make commits; you stop there and report what is ready to push.

## How to work

- Work in phases as listed in `BUILD-PROMPTS.md`; one branch and one PR per phase, merged into `main` only with green CI.
- Before starting a phase, re-read the SPEC.md blocks the phase prompt names.
- After finishing a phase, run `npm run lint && npx tsc --noEmit && npm run test && npm run build` locally, then invoke the `spec-architect` subagent to review the diff against SPEC.md before opening the PR.
- Before the final hand-in run `legal-compliance` and `qa-reviewer` subagents, then `/workflows:full-review` and `/tools:security-scan`.
- Skills: the Payload skills (`npx skills add payloadcms/skills`) and the Stripe plugin (`claude plugin install stripe@claude-plugins-official`) are installed in this project. Use them for Payload config and Stripe API shapes instead of memory; they are current, training data may not be.
- Keep commits small and conventional: `feat(products): …`, `fix(webhook): …`, `docs(readme): …`, `chore(ci): …`.

## Language

All documentation, code comments, commit messages, PR descriptions and UI copy are in **English**. Conversation with the owner may be in Russian, but nothing Russian goes into the repository.

## Definition of Done

SPEC.md Block H, all ten points. The hand-in adds: repository pushed to the Turing College remote with full history, live Vercel URL in README, and screenshots of the successful (4242) and declined (4000 0000 0000 0002) checkouts attached to the payments PR.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
