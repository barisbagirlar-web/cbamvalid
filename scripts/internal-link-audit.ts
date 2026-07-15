import { seoRegistry } from "../lib/seo/registry";

let hasError = false;
function error(msg: string) {
  console.error(`[INTERNAL LINK ERROR] ${msg}`);
  hasError = true;
}

const allPaths = new Set(Object.keys(seoRegistry));
const dynamicPattern = /^\/cn-code\/[a-zA-Z0-9]+$/;

for (const [path, meta] of Object.entries(seoRegistry)) {
  for (const target of meta.internalLinkTargets) {
    if (!allPaths.has(target) && !dynamicPattern.test(target)) {
      error(`${path} links to invalid or missing registry path: ${target}`);
    }
  }
}

if (hasError) {
  process.exit(1);
} else {
  console.log("Internal Link Audit Passed.");
}
