import { SECTOR_DETAILS } from '@/lib/cbam/sectors/sector-content';

export const dynamic = 'force-static';

export async function GET() {
  const hubLastmod = '2026-07-18T00:00:00Z'; // Sector hub index page
  
  const sectors = [
    { path: '/sectors', lastmod: hubLastmod },
    ...Object.keys(SECTOR_DETAILS).map(slug => ({
      path: `/sectors/${slug}`,
      lastmod: SECTOR_DETAILS[slug].contentLastModified,
    })),
  ];

  const urlsXml = sectors.map(({ path, lastmod }) => {
    const url = `https://cbamvalid.com${path}`;
    const priority = path === '/sectors' ? '0.80' : '0.70';
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
