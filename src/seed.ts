/**
 * Seeds 4 products and 4 pages (SPEC Block C). Run with `npm run seed`.
 * Refuses to run when any product exists; `npm run seed -- --force` upserts anyway.
 * With --force it is idempotent, keyed by slug. Products are upserted: an existing row gets the seed's title, price, kind,
 * description and soldOut back (its image is kept, so no duplicate media). Pages that already exist are
 * left untouched, so the owner's legal texts are never overwritten.
 */
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { getPayload } from 'payload'
import config from '@payload-config'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const IMAGES_DIR = path.resolve(dirname, '../seed/images')

// Hooks check this flag: revalidatePath only works inside a Next.js request.
const context = { disableRevalidate: true }

const PRODUCTS = [
  {
    title: 'Golden Hour, Lisbon',
    slug: 'golden-hour-lisbon',
    price: 4900,
    kind: 'photo',
    shortDescription:
      'Late-afternoon light over the Alfama rooftops. Giclée print on 200 g matte paper, A3.',
    alt: 'Late-afternoon light over Alfama rooftops',
    colors: ['#c9a24a', '#5a3d1e'],
    soldOut: false,
  },
  {
    title: 'Nebula Bloom',
    slug: 'nebula-bloom',
    price: 5900,
    kind: 'ai-art',
    shortDescription:
      'A flower unfolding inside a nebula — generated, then hand-curated and color-graded. A3 giclée print.',
    alt: 'A luminous flower unfolding inside a violet nebula',
    colors: ['#7b5cff', '#1c1030'],
    soldOut: false,
  },
  {
    title: 'Still Water, Bavaria',
    slug: 'still-water-bavaria',
    price: 4500,
    kind: 'photo',
    shortDescription: 'Dawn mist on Eibsee. Giclée print on 200 g matte paper, A3.',
    alt: 'Dawn mist over the still surface of Lake Eibsee',
    colors: ['#6f8fa6', '#14202b'],
    soldOut: false,
  },
  {
    title: 'Brass & Velvet',
    slug: 'brass-and-velvet',
    price: 6900,
    kind: 'ai-art',
    shortDescription:
      'An imagined art-deco interior study. Generated with AI tools, curated by the artist. A2 giclée print.',
    alt: 'An imagined art-deco interior in brass and deep red velvet',
    colors: ['#b8862f', '#4a0f1f'],
    soldOut: true, // fixture for the sold-out checks (US5, Block H #7)
  },
] as const

const DRAFT = 'Draft — replace before taking real payments.'

const PAGES: { slug: string; title: string; blocks: (string | { h: string })[] }[] = [
  {
    slug: 'about',
    title: 'About the atelier',
    blocks: [
      DRAFT,
      'Atelier Margoche is a small print studio based in Germany. We sell a handful of art prints: photographs taken on our travels and artworks created with generative AI tools.',
      'Some works in the catalogue are AI-generated. Every AI-made print is labelled "AI art" and is selected, curated and color-graded by the artist before it is printed.',
      'All prints are giclée prints on archival paper. Shipping is free across Europe.',
    ],
  },
  {
    slug: 'impressum',
    title: 'Impressum',
    blocks: [
      DRAFT,
      { h: 'Information according to § 5 DDG' },
      'Atelier Margoche · [Owner name] · [Street and number] · [Postcode, City] · Germany',
      { h: 'Contact' },
      'Email: [contact email address]',
      { h: 'VAT ID' },
      '[VAT identification number according to § 27a UStG, if applicable]',
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    blocks: [
      DRAFT,
      { h: 'What we process' },
      'When you buy a print we store your email address, your name and your shipping address as delivered by Stripe after payment. Card data is processed by Stripe Payments Europe Ltd as an independent controller; we never see or store it.',
      { h: 'Why' },
      'We use this data only to fulfil and ship your order (Art. 6(1)(b) GDPR).',
      { h: 'How long' },
      'Order records are kept for the statutory retention periods for commercial and tax records.',
      { h: 'Cookies and tracking' },
      'This site sets no cookies for visitors and uses no analytics. The only cookie is the session cookie of the shop owner’s admin login.',
      { h: 'Your rights' },
      'You may request access, correction or deletion of your data, and you may lodge a complaint with a data protection authority. Contact: [contact email address].',
    ],
  },
  {
    slug: 'terms',
    title: 'Terms & Returns',
    blocks: [
      DRAFT,
      { h: 'Right of withdrawal' },
      'You may withdraw from your purchase within 14 days of receiving your print without giving a reason (§ 312g BGB).',
      { h: 'How to return' },
      'Tell us by email that you are withdrawing, then send the print back in its original packaging within 14 days. We refund the full price, including standard shipping, within 14 days of receiving your notice.',
      { h: 'Contact' },
      'Email: [contact email address]',
    ],
  },
]

const textNode = (text: string) => ({
  type: 'text',
  text,
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

const toLexical = (blocks: (string | { h: string })[]) => ({
  root: {
    type: 'root',
    format: '' as const,
    indent: 0,
    version: 1,
    direction: 'ltr' as const,
    children: blocks.map((b) =>
      typeof b === 'string'
        ? { type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', textFormat: 0, children: [textNode(b)] }
        : { type: 'heading', tag: 'h2', format: '', indent: 0, version: 1, direction: 'ltr', children: [textNode(b.h)] },
    ),
  },
})

/** Creates a simple 1200×1500 gradient JPEG so seeding never depends on files being present. */
async function ensureImage(slug: string, [from, to]: readonly [string, string]) {
  const file = path.join(IMAGES_DIR, `${slug}.jpg`)
  try {
    await fs.access(file)
    return file
  } catch {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>
      </linearGradient></defs>
      <rect width="1200" height="1500" fill="url(#g)"/>
      <circle cx="600" cy="640" r="260" fill="#ffffff" fill-opacity="0.08"/>
    </svg>`
    await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toFile(file)
    return file
  }
}

async function findImageFor(slug: string) {
  const files = await fs.readdir(IMAGES_DIR).catch(() => [] as string[])
  const match = files.find((f) => path.parse(f).name === slug && /\.(jpe?g|png|webp)$/i.test(f))
  return match ? path.join(IMAGES_DIR, match) : null
}

async function seed() {
  const payload = await getPayload({ config })

  // Guard against overwriting the owner's live catalogue by accident.
  const force = process.argv.includes('--force')
  const { totalDocs } = await payload.count({ collection: 'products' })
  if (totalDocs > 0 && !force) {
    console.error('Refusing to seed: products already exist. Pass --force to upsert anyway.')
    process.exit(1)
  }

  await fs.mkdir(IMAGES_DIR, { recursive: true })

  for (const p of PRODUCTS) {
    const fields = {
      title: p.title,
      slug: p.slug,
      price: p.price,
      kind: p.kind,
      shortDescription: p.shortDescription,
      soldOut: p.soldOut,
    }
    const existing = await payload.find({ collection: 'products', where: { slug: { equals: p.slug } }, limit: 1 })
    if (existing.docs.length) {
      await payload.update({ collection: 'products', id: existing.docs[0].id, data: fields, context })
      payload.logger.info(`Product "${p.slug}" updated`)
      continue
    }
    const filePath = (await findImageFor(p.slug)) ?? (await ensureImage(p.slug, p.colors))
    const media = await payload.create({ collection: 'media', data: { alt: p.alt }, filePath, context })
    await payload.create({ collection: 'products', data: { ...fields, image: media.id }, context })
    payload.logger.info(`Product "${p.slug}" created`)
  }

  for (const pg of PAGES) {
    const existing = await payload.find({ collection: 'pages', where: { slug: { equals: pg.slug } }, limit: 1 })
    if (existing.docs.length) {
      payload.logger.info(`Page "${pg.slug}" exists — skipped`)
      continue
    }
    await payload.create({
      collection: 'pages',
      data: { title: pg.title, slug: pg.slug, content: toLexical(pg.blocks) },
      context,
    })
    payload.logger.info(`Page "${pg.slug}" created`)
  }

  payload.logger.info('Seed complete')
}

await seed()
process.exit(0)
