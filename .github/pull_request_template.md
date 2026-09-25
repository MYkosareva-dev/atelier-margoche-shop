## What this PR does

<!-- One or two sentences. Name the build phase from BUILD-PROMPTS.md. -->

## SPEC.md blocks touched

<!-- e.g. Block C (Products), Block D1, Block E Screen 2 -->

## Checklist

- [ ] `npm run lint && npx tsc --noEmit && npm run test && npm run build` pass locally
- [ ] No secrets in the diff (`git diff main...HEAD | grep -E "sk_test_|whsec_|postgres(ql)?://"` is empty)
- [ ] Collection changed → migration committed and `payload-types.ts` regenerated (or N/A)
- [ ] User-visible copy matches SPEC.md character-for-character
- [ ] `spec-architect` subagent report: PASS (paste verdict line below)
- [ ] Screenshots attached for UI changes at 1280 and 375 (or N/A)

## spec-architect verdict

<!-- paste the "## Verdict:" line -->

## Evidence (payments PRs only)

<!-- Screenshot: successful 4242 checkout → order Paid in /admin -->
<!-- Screenshot: declined 4000 0000 0000 0002 → order still Pending in /admin -->
<!-- Screenshot: Stripe Dashboard → Webhooks → recent deliveries showing 200 -->
