import type { SeoRouteContract } from "./types";

export type SeoBreadcrumbItem = {
  name: string;
  item: string;
};

/**
 * Single breadcrumb hierarchy for visible navigation and BreadcrumbList JSON-LD.
 * A route may add one semantic parent, but schema and UI must consume this exact list.
 */
export function buildSeoBreadcrumbItems(route: SeoRouteContract): SeoBreadcrumbItem[] {
  if (route.canonicalPath === "/") return [];

  const crumbs: SeoBreadcrumbItem[] = [{ name: "Home", item: "/" }];
  if (route.pageType === "cn-detail") {
    crumbs.push({ name: "CN code scope", item: "/cn-code" });
  } else if (
    route.path.startsWith("/cbam-") ||
    route.path === "/glossary" ||
    route.path === "/answers"
  ) {
    crumbs.push({ name: "CBAM resources", item: "/methodology" });
  }
  crumbs.push({ name: route.h1, item: route.canonicalPath });
  return crumbs;
}
