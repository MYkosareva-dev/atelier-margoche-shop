import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
import { Media, MAX_UPLOAD_BYTES } from './collections/Media'
import { Products } from './collections/Products'
import { Pages } from './collections/Pages'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default buildConfig({
  serverURL: process.env.NEXT_PUBLIC_SERVER_URL,
  admin: {
    user: Users.slug,
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' · Atelier Margoche' },
  },
  collections: [Users, Media, Products, Pages],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET!,
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: postgresAdapter({
    idType: 'uuid',
    pool: { connectionString: process.env.DATABASE_URI! },
    push: process.env.NODE_ENV === 'development', // dev: auto-sync; prod: migrations only
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  sharp,
  upload: {
    limits: { fileSize: MAX_UPLOAD_BYTES },
    responseOnLimit: 'File exceeds the 8 MB limit.',
  },
  plugins: [
    vercelBlobStorage({
      // Without a token (local dev) the plugin is off and uploads fall back to media/ on disk.
      enabled: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
      // Keep the plugin's columns in the schema even when disabled, so local migrations match production.
      alwaysInsertFields: true,
      collections: { media: true },
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
  ],
})
