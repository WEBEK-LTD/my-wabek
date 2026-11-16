/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // The in-app docs moved to the public documentation site.
      { source: '/dashboard/docs', destination: '/docs', permanent: false },
    ]
  },
  async rewrites() {
    return [
      { source: '/sitemap.xml', destination: '/api/sitemap' },
      { source: '/robots.txt', destination: '/api/robots' },
    ]
  },
  reactStrictMode: true,
  images: {
    domains: ['avatars.githubusercontent.com', 'lh3.googleusercontent.com'],
  },
  async headers() {
    // No global CORS on /api/*: the dashboard API is same-origin only and uses
    // cookies/bearer tokens. Only the public, API-key authenticated routes are
    // callable cross-origin — and never with credentials.
    const publicCors = [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type, X-API-Key' },
    ]
    return [
      { source: '/api/v1/:path*', headers: publicCors },
      { source: '/api/gateway/:path*', headers: publicCors },
    ]
  },
}

module.exports = nextConfig
