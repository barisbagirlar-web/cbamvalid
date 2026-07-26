import { siteConfig } from "@/lib/site-config";
import { normalizePath } from "./site";

const STRIP_QUERY_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "msclkid",
  "ref",
]);

/**
 * Absolute self-canonical for a public path.
 * Query/UTM parameters never form a new canonical identity.
 */
export function buildCanonicalUrl(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") {
    return siteConfig.canonicalOrigin;
  }
  return `${siteConfig.canonicalOrigin}${normalized}`;
}

/**
 * Resolve canonical path from a request-like path+search string.
 * Example: `/pricing?utm_source=x` → `/pricing`
 */
export function resolveCanonicalPath(pathnameWithOptionalQuery: string): string {
  const [rawPath, rawQuery = ""] = pathnameWithOptionalQuery.split("?");
  const path = normalizePath(rawPath || "/");
  // Query is intentionally discarded for canonical identity.
  void rawQuery;
  void STRIP_QUERY_KEYS;
  return path;
}

export function assertAbsoluteHttpsCanonical(url: string): void {
  if (!url.startsWith(`${siteConfig.canonicalOrigin}`)) {
    throw new Error(`Canonical must use ${siteConfig.canonicalOrigin}: ${url}`);
  }
  if (url.includes("?")) {
    throw new Error(`Canonical must not include query parameters: ${url}`);
  }
}
