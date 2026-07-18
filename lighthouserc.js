// ─── §21 / Ek Kod-8: Lighthouse CI Configuration ───
// 
// Usage: 
//   npm install -D @lhci/cli
//   npx lhci autorun --config=lighthouserc.json
// 
// [SITE-SPECIFIC] Adjust budgets per page role.

module.exports = {
  ci: {
    collect: {
      staticDistDir: '.next',
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        onlyCategories: [
          'performance',
          'accessibility',
          'best-practices',
          'seo',
        ],
        skipAudits: [
          'canonical',       // Checked separately
          'structured-data', // Checked separately via validate-schema.ts
        ],
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Core Web Vitals (p75 field data targets)
        'largest-contentful-paint': ['warn', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
        'interactive': ['warn', { maxNumericValue: 3500 }],

        // Accessibility minimums
        'categories:accessibility': ['error', { minScore: 0.90 }],

        // SEO essentials
        'categories:seo': ['warn', { minScore: 0.95 }],
        'meta-description': 'error',
        'http-status-code': 'error',
        'link-text': 'warn',
        'is-crawlable': 'error',
        'robots-txt': 'error',
        'viewport': 'error',
        'font-size': 'warn',
        'image-alt': 'warn',
        'hreflang': 'warn',
        'plugins': 'warn',
        'tap-targets': 'warn',

        // Performance budgets (PageRole-specific)
        'total-byte-weight': ['warn', { maxNumericValue: 1500000 }],     // 1.5 MB max
        'dom-size': ['warn', { maxNumericValue: 1500 }],                  // DOM nodes
        'resource-summary:script:size': ['warn', { maxNumericValue: 500000 }],
        'resource-summary:stylesheet:size': ['warn', { maxNumericValue: 100000 }],
        'resource-summary:font:size': ['warn', { maxNumericValue: 100000 }],
        'resource-summary:image:size': ['warn', { maxNumericValue: 500000 }],

        // Regression detection
        'performance-budget': 'error',
        
        // Security
        'is-on-https': 'error',
        'redirects-http': 'error',
        'geolocation-on-start': 'warn',
        'no-vulnerable-libraries': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
