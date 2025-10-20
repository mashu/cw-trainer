/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable static export for GitHub Pages
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  // Optional: basePath/assetPrefix can be set via env BASE_PATH in CI
  basePath: process.env.BASE_PATH || undefined,
  assetPrefix: process.env.BASE_PATH ? `${process.env.BASE_PATH}/` : undefined,
}

module.exports = nextConfig
