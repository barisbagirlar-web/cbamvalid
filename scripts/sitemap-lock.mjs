import fs from "fs";
import path from "path";
import { seoRegistry } from "../lib/seo/registry.js";

async function runSitemapLock() {
  console.log("=== RUNNING SITEMAP LOCK & INTEGRITY CONTROLS (L1-L9) ===");

  let hasFailed = false;

  const fail = (msg) => {
    console.error(`[L-GATE FAIL] ${msg}`);
    hasFailed = true;
  };

  const pass = (msg) => {
    console.log(`[L-GATE PASS] ${msg}`);
  };

  try {
    const sitemapModule = await import("../lib/seo/sitemap-helper.ts");
    const sitemapFn = sitemapModule.default;
    
    // 1. Retrieve entries from sitemap function
    const entries = sitemapFn();
    
    // L8: URL count and size constraints
    if (entries.length > 50000) {
      fail(`L8: Sitemap URL count (${entries.length}) exceeds maximum limit of 50000.`);
    } else {
      pass(`L8: URL count (${entries.length}) is within limits.`);
    }

    const urls = entries.map(e => e.url);
    const lastmods = entries.map(e => e.lastModified);

    // L1: Canonical host check
    const nonCanonicalUrls = urls.filter(url => !url.startsWith("https://cbamvalid.com"));
    if (nonCanonicalUrls.length > 0) {
      fail(`L1: Found non-canonical or insecure URLs in sitemap:\n  ${nonCanonicalUrls.join("\n  ")}`);
    } else {
      pass("L1: All URLs are on canonical host (https://cbamvalid.com).");
    }

    // L2: Valid lastmod check (not in future)
    const futureMods = entries.filter(e => {
      const time = new Date(e.lastModified).getTime();
      return time > Date.now() + 60 * 1000; // Allow 1 min threshold
    });
    if (futureMods.length > 0) {
      fail(`L2: Found lastmod timestamps set in the future:\n  ${futureMods.map(e => `${e.url}: ${e.lastModified}`).join("\n  ")}`);
    } else {
      pass("L2: All lastmod timestamps are valid and not set in the future.");
    }

    // L3: Non-HTML files check
    const invalidFileTypes = urls.filter(url => {
      const ext = path.extname(new URL(url).pathname);
      return ext && !['.html', '.htm'].includes(ext.toLowerCase());
    });
    if (invalidFileTypes.length > 0) {
      fail(`L3: Found non-HTML URLs in sitemap:\n  ${invalidFileTypes.join("\n  ")}`);
    } else {
      pass("L3: No non-HTML file paths found in sitemap.");
    }

    // L4: Duplicate URL check
    const uniqueUrls = new Set(urls);
    if (uniqueUrls.size !== urls.length) {
      const duplicates = urls.filter((url, index) => urls.indexOf(url) !== index);
      fail(`L4: Found duplicate URLs in sitemap:\n  ${Array.from(new Set(duplicates)).join("\n  ")}`);
    } else {
      pass("L4: No duplicate URLs found in sitemap.");
    }

    // L5: lastmod monokültür check (<60% shared timestamps)
    const lastmodCounts = {};
    lastmods.forEach(date => {
      const iso = new Date(date).toISOString();
      lastmodCounts[iso] = (lastmodCounts[iso] || 0) + 1;
    });

    const maxSharedCount = Math.max(...Object.values(lastmodCounts));
    const maxSharedRatio = maxSharedCount / entries.length;

    if (maxSharedRatio > 0.6) {
      const mostSharedDate = Object.keys(lastmodCounts).find(k => lastmodCounts[k] === maxSharedCount);
      fail(`L5: Monokültür Alert! The timestamp ${mostSharedDate} is shared by ${(maxSharedRatio * 100).toFixed(1)}% of sitemap URLs (limit: 60%).`);
    } else {
      pass(`L5: Date diversity check passed. Max shared timestamp ratio is ${(maxSharedRatio * 100).toFixed(1)}% (limit: 60%).`);
    }

    // L7: Route parity check
    const indexableRegistryRoutes = Object.keys(seoRegistry).filter(route => seoRegistry[route].indexable);
    const missingRoutes = [];
    indexableRegistryRoutes.forEach(route => {
      const expectedUrl = `https://cbamvalid.com${route === "/" ? "" : route}`;
      if (!urls.includes(expectedUrl)) {
        missingRoutes.push(expectedUrl);
      }
    });

    if (missingRoutes.length > 0) {
      fail(`L7: Route parity broken! Missing registered indexable routes in sitemap:\n  ${missingRoutes.join("\n  ")}`);
    } else {
      pass("L7: Route parity verified against SEO registry.");
    }

    // L9: noindex pages check
    const noindexRegistryRoutes = Object.keys(seoRegistry).filter(route => !seoRegistry[route].indexable);
    const forbiddenUrlsInSitemap = [];
    noindexRegistryRoutes.forEach(route => {
      const forbiddenUrl = `https://cbamvalid.com${route === "/" ? "" : route}`;
      if (urls.includes(forbiddenUrl)) {
        forbiddenUrlsInSitemap.push(forbiddenUrl);
      }
    });

    if (forbiddenUrlsInSitemap.length > 0) {
      fail(`L9: Found noindex/unindexed pages inside sitemap:\n  ${forbiddenUrlsInSitemap.join("\n  ")}`);
    } else {
      pass("L9: Checked that no noindex pages exist in sitemap.");
    }

    // L6: llms.txt & llms-full.txt verification
    const rootDir = process.cwd();
    const llmsFile = path.join(rootDir, "public", "llms.txt");
    const llmsFullFile = path.join(rootDir, "public", "llms-full.txt");

    if (!fs.existsSync(llmsFile) || fs.statSync(llmsFile).size === 0) {
      fail("L6: public/llms.txt is missing or empty.");
    } else {
      // Ensure all links in llms.txt are on canonical domain
      const content = fs.readFileSync(llmsFile, "utf8");
      const nonCanonicalMatches = content.match(/https?:\/\/[^\s\)]+/g) || [];
      const badLinks = nonCanonicalMatches.filter(link => !link.startsWith("https://cbamvalid.com"));
      if (badLinks.length > 0) {
        fail(`L6: Found non-canonical link references inside public/llms.txt:\n  ${badLinks.join("\n  ")}`);
      } else {
        pass("L6: public/llms.txt exists and contains strictly canonical links.");
      }
    }

    if (!fs.existsSync(llmsFullFile) || fs.statSync(llmsFullFile).size === 0) {
      fail("L6: public/llms-full.txt is missing or empty.");
    } else {
      const content = fs.readFileSync(llmsFullFile, "utf8");
      const nonCanonicalMatches = content.match(/https?:\/\/[^\s\)]+/g) || [];
      const badLinks = nonCanonicalMatches.filter(link => !link.startsWith("https://cbamvalid.com"));
      if (badLinks.length > 0) {
        fail(`L6: Found non-canonical link references inside public/llms-full.txt:\n  ${badLinks.join("\n  ")}`);
      } else {
        pass("L6: public/llms-full.txt exists and contains strictly canonical links.");
      }
    }

  } catch (error) {
    fail(`Unexpected error during sitemap verification: ${error.message || error}`);
  }

  if (hasFailed) {
    console.error("=== SITEMAP QUALITY GATE: FAILED ===");
    process.exit(1);
  } else {
    console.log("=== SITEMAP QUALITY GATE: PASSED ===");
    process.exit(0);
  }
}

runSitemapLock();
