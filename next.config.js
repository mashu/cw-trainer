/** @type {import('next').NextConfig} */
// Only enable static export when building for production (not in dev mode)
// This allows normal Next.js dev server to work locally while still exporting for GitHub Pages
const isDev = process.env.NODE_ENV === 'development'

const nextConfig = {
  reactStrictMode: true,
  // Enable static export for GitHub Pages (only when building, not in dev mode)
  ...(isDev ? {} : { output: 'export' }),
  images: { unoptimized: true },
  trailingSlash: true,
  // Optional: basePath/assetPrefix can be set via env BASE_PATH in CI
  basePath: process.env.BASE_PATH || undefined,
  assetPrefix: process.env.BASE_PATH ? `${process.env.BASE_PATH}/` : undefined,
}

module.exports = nextConfig
