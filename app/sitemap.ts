import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://cbamvalid.com';

  const routes = [
    '',
    '/about',
    '/product',
    '/how-it-works',
    '/pricing',
    '/methodology',
    '/cbam/methodology',
    '/sample-dossier',
    '/verify',
    '/cn-code',
    '/contact',
    '/cookie-policy',
    '/legal-notice',
    '/privacy',
    '/refund-policy',
    '/terms'
  ];

  const sitemapEntries = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as any,
    priority: route === '' ? 1 : route === '/pricing' || route === '/product' ? 0.9 : 0.8,
  }));

  // Add CN code pages for valid CBAM sector sample codes
  const validCnCodes = ["72085120", "76011000", "25231000", "31021010", "28041000"];
  const cnCodeEntries = validCnCodes.map((code) => ({
    url: `${baseUrl}/cn-code/${code}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as any,
    priority: 0.6,
  }));

  return [...sitemapEntries, ...cnCodeEntries];
}
