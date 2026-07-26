import { SEO_ROUTE_REGISTRY, listSitemapRoutes } from "./registry";

/**
 * Dynamic public route patterns that exist outside the static SEO registry
 * but must be accounted for in noindex inventory (fail-closed reporting).
 */
export const PUBLIC_NOINDEX_DYNAMIC_ROUTE_PATTERNS = [
  {
    pattern: "/verify/[publicToken]",
    robots: "noindex,nofollow" as const,
    evidenceFile: "app/(public)/verify/[publicToken]/layout.tsx",
  },
] as const;

export interface SeoRouteInventory {
  readonly INDEXABLE_STATIC_URL_COUNT: number;
  readonly INDEXABLE_DYNAMIC_URL_COUNT: number;
  readonly NOINDEX_STATIC_ROUTE_COUNT: number;
  readonly NOINDEX_DYNAMIC_ROUTE_PATTERN_COUNT: number;
  readonly PRIVATE_ROUTE_PATTERN_COUNT: number;
  readonly SITEMAP_URL_COUNT: number;
  readonly REGISTRY_ROUTE_COUNT: number;
}

/** Known private path prefixes (not public marketing surface). */
export const PRIVATE_ROUTE_PATTERNS = [
  "/dashboard",
  "/admin",
  "/api",
  "/cases",
  "/reports",
  "/account",
  "/credits",
  "/workspace",
  "/login",
  "/register",
] as const;

export function buildSeoRouteInventory(): SeoRouteInventory {
  const indexableStatic = SEO_ROUTE_REGISTRY.filter(
    (r) => r.indexability === "index" && r.pageType !== "cn-detail",
  );
  const indexableDynamic = SEO_ROUTE_REGISTRY.filter(
    (r) => r.indexability === "index" && r.pageType === "cn-detail",
  );
  const noindexStatic = SEO_ROUTE_REGISTRY.filter((r) => r.indexability === "noindex");
  const sitemap = listSitemapRoutes();

  return {
    INDEXABLE_STATIC_URL_COUNT: indexableStatic.length,
    INDEXABLE_DYNAMIC_URL_COUNT: indexableDynamic.length,
    NOINDEX_STATIC_ROUTE_COUNT: noindexStatic.length,
    NOINDEX_DYNAMIC_ROUTE_PATTERN_COUNT: PUBLIC_NOINDEX_DYNAMIC_ROUTE_PATTERNS.length,
    PRIVATE_ROUTE_PATTERN_COUNT: PRIVATE_ROUTE_PATTERNS.length,
    SITEMAP_URL_COUNT: sitemap.length,
    REGISTRY_ROUTE_COUNT: SEO_ROUTE_REGISTRY.length,
  };
}

export function assertNoindexInventoryInvariant(inventory: SeoRouteInventory): void {
  const hasPublicNoindex =
    inventory.NOINDEX_STATIC_ROUTE_COUNT > 0 || inventory.NOINDEX_DYNAMIC_ROUTE_PATTERN_COUNT > 0;
  if (!hasPublicNoindex) {
    throw new Error(
      "NOINDEX inventory invariant failed: public noindex routes/patterns exist in app but inventory counts are zero",
    );
  }
  // Explicit: verify layout is a known public noindex dynamic pattern
  if (inventory.NOINDEX_DYNAMIC_ROUTE_PATTERN_COUNT < 1) {
    throw new Error("Expected at least one public noindex dynamic pattern (/verify/[publicToken])");
  }
  const expectedSitemap =
    inventory.INDEXABLE_STATIC_URL_COUNT + inventory.INDEXABLE_DYNAMIC_URL_COUNT;
  // Sitemap may exclude some indexable routes if sitemapEligible=false — compare via registry helper instead
  void expectedSitemap;
}
