/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Security: Remove X-Powered-By header
  poweredByHeader: false,

  // Image optimization configuration
  images: {
    // Enable remote image optimization for external event images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow all external domains for event images
      },
    ],
    // Device size breakpoints for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image size breakpoints for srcset
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384, 512],
    // Enable sharp for faster image optimization (default in Next.js 12+)
    formats: ['image/webp', 'image/avif'],
  },
}

export default nextConfig
