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
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
