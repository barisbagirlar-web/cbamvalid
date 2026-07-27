import {
  buildPageGraph,
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateOrganizationSchema,
  generateProductOfferSchema,
  generateWebApplicationSchema,
  generateWebPageSchema,
  generateWebSiteSchema,
} from "@/lib/seo/schema";
import { requireSeoRoute } from "@/lib/seo/registry";
import { listSchemaFaqsForRoute } from "@/lib/seo/aeo/answer-bank";

export function JsonLdForRoute({ path }: { path: string }) {
  const route = requireSeoRoute(path);
  const nodes: Record<string, unknown>[] = [];

  if (route.schemaTypes.includes("Organization") || path === "/") {
    nodes.push(generateOrganizationSchema());
  }
  if (route.schemaTypes.includes("WebSite") || path === "/") {
    nodes.push(generateWebSiteSchema());
  }
  if (route.schemaTypes.includes("WebApplication")) {
    nodes.push(generateWebApplicationSchema(route.description));
  }
  if (route.schemaTypes.includes("Product") || route.schemaTypes.includes("Offer")) {
    const productDoc = generateProductOfferSchema();
    const graph = productDoc["@graph"];
    if (Array.isArray(graph)) {
      for (const node of graph) {
        if (node && typeof node === "object") {
          nodes.push(node as Record<string, unknown>);
        }
      }
    }
  }
  if (
    route.schemaTypes.includes("WebPage") ||
    route.schemaTypes.includes("CollectionPage") ||
    route.schemaTypes.includes("AboutPage") ||
    route.schemaTypes.includes("ContactPage")
  ) {
    const type =
      route.pageType === "cn-hub"
        ? "CollectionPage"
        : route.pageType === "about"
          ? "AboutPage"
          : route.pageType === "contact"
            ? "ContactPage"
            : "WebPage";
    nodes.push(
      generateWebPageSchema({
        path: route.canonicalPath,
        name: route.title,
        description: route.description,
        type,
      }),
    );
  }
  if (route.schemaTypes.includes("BreadcrumbList") && route.canonicalPath !== "/") {
    const crumbs = [{ name: "Home", item: "/" }];
    if (route.pageType === "cn-detail") {
      crumbs.push({ name: "CN Codes", item: "/cn-code" });
    }
    crumbs.push({ name: route.h1, item: route.canonicalPath });
    nodes.push(generateBreadcrumbSchema(crumbs));
  }

  const faqs = listSchemaFaqsForRoute(path);
  if (faqs.length > 0 && (route.schemaTypes.includes("FAQPage") || path === "/" || path === "/pricing")) {
    nodes.push(generateFAQSchema(faqs));
  }

  const seen = new Set<string>();
  const deduped: Record<string, unknown>[] = [];
  for (const node of nodes) {
    const id = typeof node["@id"] === "string" ? node["@id"] : undefined;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    deduped.push(node);
  }

  const payload = deduped.length === 1 ? deduped[0] : buildPageGraph(deduped);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
