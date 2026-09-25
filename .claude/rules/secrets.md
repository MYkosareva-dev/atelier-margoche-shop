# Secrets and environment rules (SPEC.md Block F §Security)

- **Never read `.env*` files or print environment variables.** `.claude/settings.json` blocks Read/Edit on `.env*` and shell commands like `cat .env`, `grep -r`, `printenv`, `echo $STRIPE_SECRET_KEY`. Do not look for workarounds (`node -e "console.log(process.env)"`, `python -c`, `Get-Content` via other aliases). If a value seems wrong, tell the owner which variable to check; only they look at it.
- Allowed presence check (prints true/false, never the value): `node -e "console.log(Boolean(process.env.STRIPE_SECRET_KEY))"`.
- Allowed shape check for Stripe key: `node -e "console.log(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))"`.

- Never write a real value for `DATABASE_URI`, `PAYLOAD_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BLOB_READ_WRITE_TOKEN` into any file except `.env` / `.env.local`, which are git-ignored.
- `.env.example` contains variable names and a `#` comment saying where the value comes from. No values, not even fake-looking ones.
- Before every commit run `git diff --cached | grep -P "sk_(test|live)_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{20,}|postgres(ql)?://[^:\s]+:[^@\s]+@(?!localhost)"`; if it matches, unstage and fix. (Dummy values and `localhost` connection strings do not match the pattern.) In Git Bash on Windows, `grep -P` needs `LC_ALL=C.UTF-8` or it errors out and prints nothing, which looks like a pass.
- Do not print secrets in logs, error messages, test output, or CI output. Do not `console.log(process.env)`.
- CI uses dummy values that satisfy the boot guards only: `STRIPE_SECRET_KEY=sk_test_dummy`, `STRIPE_WEBHOOK_SECRET=whsec_dummy`, `PAYLOAD_SECRET=ci-secret-not-real-0000000000000000`, `DATABASE_URI` pointing at the CI Postgres service container. `BLOB_READ_WRITE_TOKEN` is deliberately left unset in CI: an empty token keeps the Vercel Blob plugin disabled (same as local dev), and the adapter rejects dummy tokens.
- Vercel: environment variables are set in the dashboard for Production and Preview. Never commit `vercel.json` with env values.
- If a secret is ever committed by mistake: rotate it immediately in the provider's dashboard (Stripe, Supabase, Vercel), then rewrite history. Rotation first, history second.
