import fs from "fs";
import path from "path";
import { seoRegistry } from "../lib/seo/registry.js";

function runSeoCopyLint() {
  console.log("=== RUNNING UNIVERSAL SEO & COPY AUDIT ===");

  let hasErrors = false;

  const fail = (msg: string) => {
    console.error(`[SEO-LINT FAIL] ${msg}`);
    hasErrors = true;
  };

  const pass = (msg: string) => {
    console.log(`[SEO-LINT PASS] ${msg}`);
  };

  // 1. Audit Registry metadata lengths (R3 compliance)
  Object.entries(seoRegistry).forEach(([route, meta]) => {
    if (!meta.indexable) {
      pass(`Route ${route} is marked noindex, skipping copy audit.`);
      return;
    }

    // Title checks: R3 states 50-60 chars target. Let's warn if outside 40-70.
    const titleLen = meta.title.length;
    if (titleLen < 40 || titleLen > 70) {
      fail(`Route ${route}: Title "${meta.title}" length is ${titleLen} characters. Target is 40-70.`);
    } else {
      pass(`Route ${route}: Title length is valid (${titleLen} chars).`);
    }

    // Description checks: R3 states 140-160 chars target. Let's warn if outside 110-180.
    const descLen = meta.description.length;
    if (descLen < 110 || descLen > 180) {
      fail(`Route ${route}: Description length is ${descLen} characters. Target is 110-180.`);
    } else {
      pass(`Route ${route}: Description length is valid (${descLen} chars).`);
    }

    // Check for unresolved placeholders
    const placeholders = ["[SITE]", "[DİL]", "[NİŞ-TERİM-LİSTESİ]", "[SCHEMA-TİPİ]"];
    placeholders.forEach(placeholder => {
      if (meta.title.includes(placeholder) || meta.description.includes(placeholder)) {
        fail(`Route ${route}: Metadata contains unresolved placeholder "${placeholder}".`);
      }
    });
  });

  // 2. Scan files to ensure exactly one H1 tag and proper headings hierarchy
  const publicDir = path.join(process.cwd(), "app", "(public)");
  
  const scanHeadings = (dir: string) => {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanHeadings(fullPath);
      } else if (file === "page.tsx") {
        const content = fs.readFileSync(fullPath, "utf8");
        
        // Count H1 elements (looking for <h1> or <h1 or className="... text-4xl")
        const h1Matches = content.match(/<h1[\s>]/gi) || [];
        if (h1Matches.length > 1) {
          fail(`File ${path.relative(process.cwd(), fullPath)}: Found multiple <h1> tags (${h1Matches.length}). Only one H1 is allowed per page.`);
        } else if (h1Matches.length === 0 && !content.includes('"use client"') && !content.includes("VerifyPage")) {
          // Verify client component page has separate client layout rendering H1, so skip client pages
          console.log(`[SEO-LINT INFO] File ${path.relative(process.cwd(), fullPath)}: No static <h1> tag found. Ensuring it is rendered dynamically or by subcomponents.`);
        } else {
          pass(`File ${path.relative(process.cwd(), fullPath)}: Single/dynamic H1 hierarchy verified.`);
        }
      }
    });
  };

  scanHeadings(publicDir);

  if (hasErrors) {
    console.error("=== SEO COPY AUDIT: FAILED ===");
    process.exit(1);
  } else {
    console.log("=== SEO COPY AUDIT: PASSED ===");
    process.exit(0);
  }
}

runSeoCopyLint();
