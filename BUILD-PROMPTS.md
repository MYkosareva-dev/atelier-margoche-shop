# BUILD-PROMPTS.md — phased build plan for Claude Code

Each phase = one branch, one PR, green CI, `spec-architect` PASS, merge to `main`.
"👤" steps are done by the owner in a terminal or a dashboard. "🤖" blocks are pasted into Claude Code verbatim.
Never skip Phase 0. Never start Phase 2 before Phase 1's live-edit proof works locally.

---

## Phase 0 — Accounts, project skeleton, skills (👤, ~1 h)

### 0.1 Accounts (all free tiers, all already exist)
- **Supabase**: New project `atelier-margoche`, region `eu-central-1 (Frankfurt)`. Save the DB password. Project Settings → Database → Connection string → **Session pooler** → copy URI → this is `DATABASE_URI`.
- **Stripe**: Dashboard, toggle **Test mode** ON. Developers → API keys → copy Secret key (`sk_test_…`). Do **not** activate the account.
- **Stripe CLI**: `winget install Stripe.StripeCli` → `stripe login` (opens browser, test mode).
- **Vercel**: nothing yet (Phase 3).
- **GitHub**: create a private repo `atelier-margoche-shop` under your personal account. Do not add a README from the UI.

### 0.2 Create the app
```powershell
cd "D:\Claude BAI\4_sprint\CMS_and_Payments"
npx create-payload-app@latest atelier-margoche-shop
#   template: blank · database: postgres · paste DATABASE_URI when asked (or leave and set in .env) · package manager: npm
cd atelier-margoche-shop
```

### 0.3 Drop in the stage-2 files (from this bundle)
Copy into the project root, overwriting where files already exist:
`SPEC.md`, `CLAUDE.md`, `BUILD-PROMPTS.md`, `.gitignore`, `.env.example`, `.claude/rules/*`, `.claude/agents/*`, `.github/*`.

Then create `.env` from `.env.example` and fill `DATABASE_URI`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL=http://localhost:3000`, `STRIPE_SECRET_KEY`. Leave `STRIPE_WEBHOOK_SECRET` and `BLOB_READ_WRITE_TOKEN` empty for now.

### 0.4 Install the agent skills (requirement #2 — must precede any build prompt)
```powershell
npx skills add payloadcms/skills
claude plugin install stripe@claude-plugins-official
```
Optional review commands (used in Phase 5):
```powershell
git clone https://github.com/wshobson/commands.git $HOME\.claude\commands
git clone https://github.com/wshobson/agents.git   $HOME\.claude\agents-wshobson
```
(`full-review` references agents from the second repo; if Claude Code reports missing agents, move the needed ones into `$HOME\.claude\agents\`.)

### 0.5 First commit — secrets guard before anything else
```powershell
git init
git add .gitignore .env.example
git commit -m "chore: gitignore and env template"
git add .
git commit -m "chore: payload skeleton, spec, rules, agents, ci"
git branch -M main
git remote add origin https://github.com/<you>/atelier-margoche-shop.git
git push -u origin main
```
Verify: `git log -p | Select-String "sk_test_|postgres"` prints nothing.

### 0.6 Sanity run
```powershell
npm run dev
```
Open `http://localhost:3000/admin` → create the first user (your email, a strong password). Stop the server.

---

## Phase 1 — CMS: Products, Media, Pages, public catalogue (branch `feat/cms`)

👤 `git checkout -b feat/cms` → open Claude Code in the project folder → paste:

🤖
```
Read CLAUDE.md, then SPEC.md Blocks A, B (US1, US2, US6), C, E (Screens 1, 2, 4) and F (Validation, rules B1, B10–B13).
Use the installed Payload skills for every Payload API shape.

Build Phase 1:
1. payload.config.ts exactly as in SPEC Block C (uuid ids, postgres adapter with push only in development, sharp, Vercel Blob plugin enabled for media, lexical editor, upload limit 8 MB).
2. Collections Users, Media, Products, Pages exactly as in Block C, including access functions, validation copy, hooks (slug auto-generation, revalidatePath, protected page slugs). Do NOT create Orders yet.
3. Add a Products collection to the shop. Each product needs a name, a price, a short description, and a single photo uploaded through the admin panel. Anyone visiting the site can view products, but only a logged-in admin can create, edit, or delete them.
4. Public frontend in src/app/(frontend): layout with header/footer from Block E, globals.css tokens, Screen 1 (/), Screen 2 (/products/[slug]) WITHOUT the Buy now behaviour yet (render the button disabled with title "Checkout arrives in Phase 2"), Screen 4 (/info/[slug]); loading.tsx for each, not-found.tsx, error.tsx, exact copy from Block E. shadcn/ui + lucide-react + next/font (Inter, Fraunces).
5. src/lib/money.ts, src/lib/payload.ts.
6. src/seed.ts + `npm run seed` script: 4 products and 4 pages from Block C seed table; images from seed/images/ (create 4 simple 1200x1500 placeholder JPEGs with sharp if the folder is empty, so seeding never fails).
7. Run `npm run payload migrate:create` and `npm run payload generate:types`; commit the migration.
8. Update package.json scripts: dev, build, ci ("payload migrate && next build"), lint, test, test:e2e, seed, payload.

Local uploads: while BLOB_READ_WRITE_TOKEN is empty, the Blob plugin must be disabled (enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN)) so dev uploads fall back to local disk under media/ (git-ignored). Record this as a `> Decision:` in SPEC.md Block C.

Finish with: npm run lint, npx tsc --noEmit, npm run build all green. Then summarise what you built against SPEC Block B acceptance boxes for US1, US2, US6 and list anything you could not satisfy.
```

👤 Verify the live-edit proof locally: `npm run dev`, `npm run seed`, edit a product price in `/admin`, reload `/products/<slug>` → new price visible.
👤 Run the review: 🤖 `Use the spec-architect subagent to review branch feat/cms against SPEC.md.` Fix BLOCKER/MAJOR items, then open the PR, fill the template, merge when CI is green.

---

## Phase 2 — Payments: Orders, checkout, webhook, confirmation (branch `feat/payments`)

👤 Terminal 2: `stripe listen --forward-to localhost:3000/next/stripe/webhook` → copy the printed `whsec_…` into `.env` as `STRIPE_WEBHOOK_SECRET`. Keep it running.

🤖
```
Read CLAUDE.md, .claude/rules/payments.md, then SPEC.md Blocks B (US3, US4, US5), C (Orders), D (all), E (Screen 2 actions, Screen 3), F (Payments, Integrations, rules B2–B9, B14–B15) and G (Payments).
Use the installed Stripe plugin for API shapes and the Payload skills for the Local API.

Build Phase 2:
1. Orders collection exactly as in Block C, including the beforeChange hook. Migration + types.
2. src/lib/stripe.ts with the sk_test_ boot guard, src/lib/countries.ts, src/lib/rate-limit.ts as in Block D.
3. POST /next/checkout exactly as Block D1: order created pending first, Stripe session with price_data, shipping_address_collection for EUROPE_COUNTRIES, metadata, idempotency key, 1 h expiry, all error responses with the exact copy.
4. POST /next/stripe/webhook exactly as Block D2. When a customer completes payment, Stripe will notify my app's server directly. Only record the order as paid when that confirmation arrives from Stripe and is verified as genuine, never just because the customer reached the thank-you page.
5. Wire Buy now on Screen 2 (client component): loading state, redirect on 200, toasts per the actions table, 409 re-renders the sold-out state. Cancel banner for ?checkout=cancelled.
6. Screen 3 /order/[orderId]: read-only, notFound() unless session_id matches, status table copy from Block E, OrderStatusPoller with the B9 timing and visibility pause. After a successful payment, show a confirmation page that lists the product the customer just bought and confirms the order is paid.
7. Sold-out: badge on catalogue + detail page, server-side 409, disabled UI.
8. tests/unit/webhook.test.ts per SPEC Block H #7 using stripe.webhooks.generateTestHeaderString and a mocked Payload Local API.

Finish with lint, typecheck, unit tests, build green. Then run `grep -rn "status: 'paid'" src/` and paste the output — it must be exactly one line.
```

👤 Manual test (keep `stripe listen` running):
1. Buy with `4242 4242 4242 4242`, any future expiry, any CVC, a German address → confirmation shows **Paid**; `/admin/collections/orders` shows the row as Paid with the address. **Screenshot.**
2. Buy again with `4000 0000 0000 0002` → Stripe shows the decline; press back → banner; admin shows a second order **Pending**. **Screenshot.**
3. `stripe events resend <evt_id>` for the paid event → admin unchanged.
4. Tick Sold out on a product → catalogue badge; Buy now on a stale tab → toast "Sorry, this print just sold out."

👤 🤖 `Use the spec-architect subagent to review branch feat/payments against SPEC.md.` → fix → PR with the two screenshots → merge.

---

## Phase 3 — Deploy to Vercel (branch `chore/deploy`)

👤
1. Vercel → Add New Project → import `atelier-margoche-shop` from GitHub. Framework: Next.js. **Build Command: `npm run ci`**. Do not deploy yet — first set env.
2. Storage → Create Blob store → connect to the project → `BLOB_READ_WRITE_TOKEN` is injected automatically (check Settings → Environment Variables).
3. Settings → Environment Variables (Production + Preview): `DATABASE_URI`, `PAYLOAD_SECRET` (a different random value than local), `NEXT_PUBLIC_SERVER_URL=https://<project>.vercel.app`, `STRIPE_SECRET_KEY`. Leave `STRIPE_WEBHOOK_SECRET` for step 5.
4. Deploy. Open `https://<project>.vercel.app/admin` → create the first admin user on production (the production DB is the same Supabase project; if you already created one locally it already exists — log in).
5. Stripe → Developers → Webhooks → Add endpoint `https://<project>.vercel.app/next/stripe/webhook`, events `checkout.session.completed`, `checkout.session.expired` → copy Signing secret → Vercel env `STRIPE_WEBHOOK_SECRET` → **Redeploy** (env changes need a redeploy).
6. Seed production: run `npm run seed` locally with `.env` temporarily pointing `DATABASE_URI` at the same Supabase project (it already does) and `BLOB_READ_WRITE_TOKEN` copied from Vercel so images land in Blob. Then remove the Blob token from local `.env` again if you prefer local-disk uploads in dev.
7. Prove live edit on production: change a price in `/admin`, reload the public page, confirm Vercel → Deployments shows no new build.
8. Test purchase on production with 4242 → Paid; Stripe Dashboard → Webhooks shows 200.

🤖
```
Read SPEC.md Block H #9–#10. Write README.md with exactly the sections and order in H #10, using the live URL https://<project>.vercel.app, the env table from Block F (names + sources, no values), the local run steps including stripe listen and npm run seed, the reviewer-access note from Block A (Roles decision), the test cards, the list of optional tasks delivered, and the future-extensions list. Also add next.config.mjs security headers from Block F §Security if missing. English only.
```

👤 PR → merge. Vercel auto-deploys `main`.

---

## Phase 4 — Optional tasks not yet covered + go-live plan (branch `feat/optional`)

Already delivered by Phases 1–3: Orders collection, order confirmation page, sold-out state, second collection (Pages). Remaining:

🤖
```
Read SPEC.md Block H #10 (GO-LIVE-PLAN.md) and Block F §Payments and §Legal.
Use the Stripe plugin's documentation on the go-live checklist.
Write docs/GO-LIVE-PLAN.md: a written plan, NOT executed, of exactly what changes to accept real payments — activating the Stripe account, replacing sk_test_ with sk_live_ in Vercel env (and deliberately removing the sk_test_ boot guard in src/lib/stripe.ts as the last step, with the reason), registering a live-mode webhook endpoint with its new signing secret, the fact that this app passes price_data inline so no Products/Prices need recreating in live mode (but note what would if the app ever switched to Stripe Prices), VAT/OSS registration considerations for cross-border EU sales, replacing the draft Impressum/Privacy/Terms texts, and a rollback plan. Keep everything in the sandbox; do not touch keys or code.
```

👤 PR → merge.

---

## Phase 5 — Quality gates and hand-in prep (branch `chore/quality`)

🤖
```
Read SPEC.md Block H #7–#8 and .claude/rules/frontend.md (test ids).
1. Add Playwright: playwright.config.ts (baseURL http://localhost:3000, projects chromium at 1280x800 and 375x812), tests/e2e/shop.spec.ts covering the five e2e checks in H #7 using the ids from Block E.
2. Ensure .github/workflows/ci.yml runs on this repo without changes; if a script name differs, align package.json, not the workflow.
3. Run everything: npm run lint, npx tsc --noEmit, npm run test, npm run build, npm run test:e2e (against npm run dev with a seeded DB). Paste results.
```

👤 Then, in order:
- 🤖 `Use the qa-reviewer subagent on branch chore/quality.` → fix until READY.
- 🤖 `Use the legal-compliance subagent.` → fix FAIL items that are cheap (copy on pages); leave DRAFT markers on legal texts.
- 🤖 `/workflows:full-review` and 🤖 `/tools:security-scan` → triage findings; fix anything touching payments, secrets or access rules; note the rest in the PR.
- PR → merge.

### Hand-in
```powershell
git remote add school https://github.com/TuringCollegeSubmissions/<your-repo>.git
git push school main
```
Submit: school repo URL, live URL, README. Prepare for the call: one Paid and one Pending order visible in `/admin`, `stripe listen` not needed (production webhook is live), browser tabs open on `/`, `/admin`, Stripe Dashboard (test mode), Vercel Deployments.

---

## Phase 6 — Design pass (after everything above is merged)

Goal: replace the v1 visuals while keeping every id, state and copy from SPEC Block E. Inputs: 21st.dev components (3–5 max), one shader background on the hero only, dark theme with gradient details. Process: pick components together → 🤖 prompt that names the exact components and forbids new dependencies beyond those agreed → `qa-reviewer` (e2e must stay green at both widths) → PR. SPEC Block E is then amended, not bypassed.

## Phase 7 — Extensions (optional, only if time remains)

Cart (Orders.items maxRows already allows it), digital downloads (`kind: 'digital'` + Blob private file + signed URL after webhook), `refunded` status via `charge.refunded` webhook, daily health-check workflow. Each starts with a SPEC.md amendment, then a prompt.
