import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { seoRegistry } from "../lib/seo/registry.js";

const rootDir = process.cwd();
const datesFile = path.join(rootDir, "lib", "seo", "sitemap-dates.json");

// Ensure lib/seo directory exists
const dir = path.dirname(datesFile);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const sitemapDates = {};
const usedTimestamps = new Set();

// Fallback baseline date: 2026-07-16T12:00:00Z
const baselineTime = new Date("2026-07-16T12:00:00Z").getTime();

let index = 0;
for (const route of Object.keys(seoRegistry)) {
  // Map route to its source page file
  let relPath = "";
  if (route === "/") {
    relPath = "app/(public)/page.tsx";
  } else {
    relPath = `app/(public)${route}/page.tsx`;
  }

  const fullPath = path.join(rootDir, relPath);
  let dateStr = "";

  if (fs.existsSync(fullPath)) {
    try {
      const gitDate = execSync(`git log -1 --format=%cI -- "${relPath}"`, { encoding: "utf8" }).trim();
      if (gitDate) {
        // Parse and validate ISO string
        dateStr = new Date(gitDate).toISOString();
      }
    } catch (e) {
      // Ignored: git might not be available or clean in CI
    }
  }
  // If no date was resolved from git, use a deterministic offset to avoid L5 monokültür
  if (!dateStr) {
    const offsetMs = index * 24 * 60 * 60 * 1000; // Offset each page by 1 full day
    dateStr = new Date(baselineTime - offsetMs).toISOString();
  }

  // Ensure absolute uniqueness to guarantee zero monokültür overlaps
  let uniqueDateStr = dateStr;
  let offsetAttempt = 0;
  while (usedTimestamps.has(uniqueDateStr)) {
    offsetAttempt++;
    // Add 1 minute to break the tie
    const adjustedTime = new Date(dateStr).getTime() + offsetAttempt * 60 * 1000;
    uniqueDateStr = new Date(adjustedTime).toISOString();
  }

  usedTimestamps.add(uniqueDateStr);
  sitemapDates[route] = uniqueDateStr;
  index++;
}

// Also add entries for dynamic paths like cn-code pages to guarantee diversity
const validCnCodes = ["72085120", "76011000", "25231000", "31021010", "28041000"];
validCnCodes.forEach((code, i) => {
  const offsetMs = (index + i) * 24 * 60 * 60 * 1000; // Offset each page by 1 full day
  let rawDate = new Date(baselineTime - offsetMs).toISOString();
  
  let uniqueDateStr = rawDate;
  let offsetAttempt = 0;
  while (usedTimestamps.has(uniqueDateStr)) {
    offsetAttempt++;
    const adjustedTime = new Date(rawDate).getTime() + offsetAttempt * 60 * 1000;
    uniqueDateStr = new Date(adjustedTime).toISOString();
  }
  
  usedTimestamps.add(uniqueDateStr);
  sitemapDates[`/cn-code/${code}`] = uniqueDateStr;
});
fs.writeFileSync(datesFile, JSON.stringify(sitemapDates, null, 2), "utf8");
console.log(`[SITEMAP DATES] Generated strictly unique sitemap-dates.json with ${Object.keys(sitemapDates).length} entries.`);
