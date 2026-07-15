import { seoRegistry } from "../lib/seo/registry";

let hasError = false;
function error(msg: string) {
  console.error(`[ORPHAN PAGE ERROR] ${msg}`);
  hasError = true;
}

const incomingLinks = new Map<string, number>();

// Initialize counts
for (const path of Object.keys(seoRegistry)) {
  incomingLinks.set(path, 0);
}

// Count incoming links
for (const [path, meta] of Object.entries(seoRegistry)) {
  for (const target of meta.internalLinkTargets) {
    if (incomingLinks.has(target)) {
      incomingLinks.set(target, incomingLinks.get(target)! + 1);
    }
  }
}

// Check for orphans
for (const [path, meta] of Object.entries(seoRegistry)) {
  if (path === "/") continue; // Homepage is allowed 0 incoming in this strict check if we assume external entry
  if (meta.indexable && incomingLinks.get(path) === 0) {
    error(`${path} is an orphan page (0 incoming internal links).`);
  }
}

if (hasError) {
  process.exit(1);
} else {
  console.log("Orphan Page Check Passed.");
}
