// The Content-Security-Policy is set per page in src/middleware.ts (it needs a fresh nonce each time)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The e2e suite builds into its own folder, so it can run next to `npm run dev`
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 60,
  },
  
  // Enable compression
  compress: true,
  
  // Native argon2 binding must be required at runtime, not bundled
  experimental: {
    serverComponentsExternalPackages: ["@node-rs/argon2"],
  },
  
  // Optimize headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
      {
        // The service worker must never be cached, or updates don't reach installed apps
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ];
  },
};

export default nextConfig;
