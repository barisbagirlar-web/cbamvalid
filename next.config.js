/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["firebase" + "-admin"],
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
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://paddle.com https://cdn.paddle.com https://sandbox-cdn.paddle.com https://www.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.paddle.com https://sandbox-cdn.paddle.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.paddle.com https://*.cloudfunctions.net http://127.0.0.1:5001 http://localhost:5001; img-src 'self' data: https:; frame-src 'self' https://*.paddle.com https://*.firebaseapp.com https://www.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none';"
          }
        ],
      },
      // Public Content Caching
      {
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      // Legal Content Caching
      {
        source: '/(privacy|terms|refund-policy|cookie-policy|legal-notice|about|methodology)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=86400, stale-while-revalidate=604800',
          },
        ],
      },
      // Protected/Auth routes should not be cached
      {
        source: '/(login|register|cbam|admin|account|dashboard)(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store',
          },
        ],
      }
    ];
  },
  async redirects() {
    // Handling www redirect. (Requires App Hosting / Cloudflare to properly resolve www.cbamvalid.com first)
    return [
      {
        source: '/credits',
        destination: '/credits/buy',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.cbamvalid.com',
          },
        ],
        destination: 'https://cbamvalid.com/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
