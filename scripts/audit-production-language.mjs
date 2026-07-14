import https from 'https';

const PRODUCTION_URL = 'https://cbamvalid.com';

const ROUTES_TO_TEST = [
  '/',
  '/privacy',
  '/terms',
  '/refund-policy',
  '/contact',
  '/cookie-policy',
  '/legal-notice',
  '/about',
  '/methodology'
];

const FORBIDDEN_WORDS = [
  'türkiye',
  'türkçe',
  'karbon',
  'beyannamesi',
  'oluşturucu'
];

async function fetchRoute(route) {
  return new Promise((resolve, reject) => {
    https.get(`${PRODUCTION_URL}${route}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    }).on('error', reject);
  });
}

async function audit() {
  console.log(`Starting production language crawl on ${PRODUCTION_URL}...`);
  let hasErrors = false;

  for (const route of ROUTES_TO_TEST) {
    try {
      console.log(`Checking ${route}...`);
      const { status, data } = await fetchRoute(route);
      
      if (status !== 200) {
        console.error(`[FAIL] Route ${route} returned status ${status}`);
        hasErrors = true;
        continue;
      }

      const lowerData = data.toLowerCase();

      if (!lowerData.includes('lang="en"')) {
        console.error(`[FAIL] Route ${route} does not have lang="en"`);
        hasErrors = true;
      }

      if (lowerData.includes('lang="tr"')) {
        console.error(`[FAIL] Route ${route} has lang="tr"`);
        hasErrors = true;
      }

      for (const word of FORBIDDEN_WORDS) {
        if (lowerData.includes(word)) {
          console.error(`[FAIL] Route ${route} contains forbidden Turkish word "${word}"`);
          hasErrors = true;
        }
      }

    } catch (err) {
      console.error(`[FAIL] Failed to fetch ${route}:`, err.message);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('\n[ERROR] Production language audit failed. Please fix the above issues.');
    process.exit(1);
  } else {
    console.log('[SUCCESS] Production language audit passed.');
    process.exit(0);
  }
}

audit();
