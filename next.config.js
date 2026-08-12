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
  // Do not advertise the framework to scanners / clients.
  poweredByHeader: false,
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
          // Content-Security-Policy is request-scoped (nonce) and owned by proxy.ts.
        ],
      },
      // HTML must not be shared-cached: proxy issues a per-request CSP nonce.
      {
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store',
          },
        ],
      },
      {
        source: '/(privacy|terms|refund-policy|cookie-policy|legal-notice|about|methodology)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, no-store',
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
        // Legal alias: buyers and MoR surfaces often expect /refunds.
        source: '/refunds',
        destination: `${canonicalOrigin}/refund-policy`,
        permanent: true,
      },
      {
        source: '/refund',
        destination: `${canonicalOrigin}/refund-policy`,
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
