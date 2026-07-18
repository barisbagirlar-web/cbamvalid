export const dynamic = 'force-static';

const TOOLS_PAGES = [
  '/',
  '/about',
  '/methodology',
  '/contact',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/cookie-policy',
  '/legal-notice',
  '/how-it-works',
  '/pricing',
  '/product',
  '/sample-dossier',
  '/verify',
  '/cn-codes'
];

/** Static-content pages: grouped lastmod by change frequency tier. */
const STATIC_CORE = '2026-07-18T00:00:00Z'; // Home, about, methodology, product, pricing, how-it-works
const STATIC_LEGAL = '2026-07-15T00:00:00Z'; // Privacy, terms, refund, cookie, legal-notice
const STATIC_TOOL = '2026-07-14T00:00:00Z'; // Contact, verify, sample-dossier, cn-codes

function getLastmodForPath(path: string): string {
  if (path === '/' || path === '/about' || path === '/methodology' || path === '/how-it-works' || path === '/pricing' || path === '/product') {
    return STATIC_CORE;
  }
  if (path === '/privacy' || path === '/terms' || path === '/refund-policy' || path === '/cookie-policy' || path === '/legal-notice') {
    return STATIC_LEGAL;
  }
  return STATIC_TOOL;
}

export async function GET() {
  const urlsXml = TOOLS_PAGES.map(path => {
    const url = `https://cbamvalid.com${path === '/' ? '' : path}`;
    const priority = path === '/' ? '1.00' : '0.80';
    const lastmod = getLastmodForPath(path);
    return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
