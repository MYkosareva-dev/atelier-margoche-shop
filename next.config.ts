import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// Payload serves uploads through its own /api/media/file route on the app's domain, so the production
// host must be allowed as an image source. A missing or malformed env must not crash the config.
function serverHostname(): string | null {
  try {
    return process.env.NEXT_PUBLIC_SERVER_URL ? new URL(process.env.NEXT_PUBLIC_SERVER_URL).hostname : null
  } catch {
    return null
  }
}
const appHostname = serverHostname()

const nextConfig: NextConfig = {
  // Don't advertise the stack; withPayload also drops its own "Next.js, Payload" header when this is false.
  poweredByHeader: false,
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
      ...(appHostname && appHostname !== 'localhost'
        ? [{ protocol: 'https' as const, hostname: appHostname, pathname: '/api/media/**' }]
        : []),
      // Preview deployments get their own *.vercel.app hostname.
      { protocol: 'https', hostname: '*.vercel.app', pathname: '/api/media/**' },
    ],
  },
  // SPEC Block F §Security: public routes get the full set; /admin only adds anti-framing (SAMEORIGIN, since
  // Payload's admin may frame its own pages); /api keeps Payload's defaults.
  async headers() {
    return [
      {
        source: '/((?!admin|api).*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      {
        source: '/admin/:path*',
        headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }],
      },
    ]
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
