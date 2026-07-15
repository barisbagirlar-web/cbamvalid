import { siteConfig } from "../site-config";

/**
 * Normalizes a URL path to ensure consistency.
 * Forces lowercase, removes trailing slashes, and ensures a leading slash.
 */
export function normalizePath(path: string): string {
  if (path === "/" || path === "") return "/";
  let normalized = path.toLowerCase();
  // Remove trailing slash
  if (normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }
  // Ensure leading slash
  if (!normalized.startsWith("/")) {
    normalized = `/${normalized}`;
  }
  return normalized;
}

export function getCanonicalUrl(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") {
    return siteConfig.canonicalOrigin;
  }
  return `${siteConfig.canonicalOrigin}${normalized}`;
}
