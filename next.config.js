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
  // Served at root (cwtrainer.eu). No basePath.
  basePath: undefined,
  assetPrefix: undefined,
  // Improve chunk loading reliability for static exports
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Ensure consistent chunk naming for better caching
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
      };
    }
    return config;
  },
  // Turbopack configuration (Next.js 16+ uses Turbopack by default)
  // Empty config allows webpack config to coexist for static exports
  turbopack: {},
}

module.exports = nextConfig
