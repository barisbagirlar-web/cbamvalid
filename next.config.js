const seoConfig = require('./sites/cbamvalid/seo.config.json');

const canonicalUrl = new URL(seoConfig.site.rootUrl);
if (
  canonicalUrl.protocol !== 'https:' ||
  canonicalUrl.pathname !== '/' ||
  canonicalUrl.search ||
  canonicalUrl.hash
) {
  throw new Error('SEO canonical rootUrl must be an origin-only HTTPS URL');
}

const canonicalOrigin = canonicalUrl.origin;
const canonicalHost = canonicalUrl.hostname;
const wwwHost = `www.${canonicalHost}`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  compress: true,
  images: {
    unoptimized: false,
  },
  serverExternalPackages: ["firebase-admin"],
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
            // HSTS remains strong, but preload is deliberately excluded until a
            // separate irreversible-action approval is recorded.
            value: 'max-age=63072000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com https://paddle.com https://cdn.paddle.com https://sandbox-cdn.paddle.com https://public.profitwell.com https://www.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.paddle.com https://sandbox-cdn.paddle.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.paddle.com https://*.profitwell.com https://*.cloudfunctions.net http://127.0.0.1:5001 http://localhost:5001; img-src 'self' data: https:; frame-src 'self' https://*.paddle.com https://*.firebaseapp.com https://www.google.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none';"
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
    return [
      {
        // Absolute canonical target prevents a second host-normalization hop.
        source: '/credits',
        destination: `${canonicalOrigin}/credits/buy`,
        permanent: true,
      },
      {
        // Canonical consolidation: thin /cbam-methodology → authority /methodology.
        // Absolute target also collapses legacy-path + www variants in one hop.
        source: '/cbam-methodology',
        destination: `${canonicalOrigin}/methodology`,
        permanent: true,
      },
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: wwwHost,
          },
        ],
        destination: `${canonicalOrigin}/:path*`,
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
