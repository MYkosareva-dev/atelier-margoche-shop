---
paths:
  - "src/collections/**"
  - "payload.config.ts"
  - "src/migrations/**"
  - "src/seed.ts"
---

# CMS / Payload rules (SPEC.md Block C)

- Collection configs in SPEC.md Block C are authoritative: field names, types, validation copy, access functions, hooks. Copy them; do not "improve" them.
- Access functions: public read for `products`, `media`, `pages`; everything else requires `req.user`. Orders `create: () => false`, `delete: () => false`.
- After any change to a collection: `npm run payload migrate:create` → commit the migration → `npm run payload generate:types`. A PR that changes a collection without a migration is incomplete.
- `db.push` is `false` everywhere. Schema changes go through `npm run payload migrate:create && npm run migrate`; Vercel applies them in `npm run ci`.
- Uploads go through `@payloadcms/storage-vercel-blob`. Never write files to `public/` or `media/` at runtime.
- Revalidation: `afterChange` / `afterDelete` hooks call `revalidatePath` for `/` and the affected detail route. Public pages also set `export const revalidate = 60`.
- Use the Payload skills installed in this project for API shapes (`buildConfig`, adapters, hooks, Local API). Prefer the Local API (`payload.find`, `payload.findByID`) in Server Components; never `fetch('/api/…')` from our own server code.
- Do not add custom admin components, custom REST endpoints, or GraphQL changes in v1.
