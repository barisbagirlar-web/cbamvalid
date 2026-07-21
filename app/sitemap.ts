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

  // Add CN code pages for representative CBAM sector codes across all 6 sectors
  const validCnCodes = [
    "72011011", // Pig iron (Iron & Steel)
    "72085120", // Flat-rolled products (Iron & Steel)
    "76011000", // Unwrought aluminum (Aluminum)
    "25231000", // Cement clinkers (Cement)
    "25232900", // Portland cement (Cement)
    "31021010", // Urea (Fertilizers)
    "28080000", // Nitric acid (Fertilizers)
    "28041000", // Hydrogen (Hydrogen)
    "27160000", // Electrical energy (Electricity)
  ];
  const cnCodeEntries = validCnCodes.map((code) => ({
    url: `${baseUrl}/cn-code/${code}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as any,
    priority: 0.7,
  }));

  return [...sitemapEntries, ...cnCodeEntries];
}
