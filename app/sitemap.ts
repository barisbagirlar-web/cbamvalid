import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://cbamvalid.com';

  const routes = [
    '',
    '/about',
    '/contact',
    '/cookie-policy',
    '/legal-notice',
    '/methodology',
    '/privacy',
    '/refund-policy',
    '/terms'
  ];

  const sitemapEntries = routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as any,
    priority: route === '' ? 1 : 0.8,
  }));

  // Add CN code pages only if they are the valid chapters (Quality gate in sitemap generation)
  const validCnCodes = ["72085120", "76011000", "25231000", "31021010", "28041000"]; // Representing some sample compliant codes
  const cnCodeEntries = validCnCodes.map((code) => ({
    url: `${baseUrl}/cn-code/${code}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as any,
    priority: 0.6,
  }));

  return [...sitemapEntries, ...cnCodeEntries];
}
