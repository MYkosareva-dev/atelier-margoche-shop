import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  images: {
    // Next 16's optimizer refuses upstream hosts that resolve to a private IP (SSRF guard), so it cannot
    // fetch http://localhost:3000/api/media/… in dev. Serve images as-is locally; production optimizes Blob URLs.
    unoptimized: process.env.NODE_ENV === 'development',
    // Local dev uploads (Blob plugin disabled) are served by Payload from /api/media/file.
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      // With NEXT_PUBLIC_SERVER_URL set, Payload returns absolute local media URLs in dev.
      { protocol: 'http', hostname: 'localhost', port: '3000', pathname: '/api/media/**' },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
