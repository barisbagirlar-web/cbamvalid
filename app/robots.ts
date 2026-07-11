import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/cbam', '/admin', '/account', '/api/'],
    },
    sitemap: 'https://cbamvalid.com/sitemap.xml',
  };
}
