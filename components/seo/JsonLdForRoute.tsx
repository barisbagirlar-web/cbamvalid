import { buildSeoBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { requireSeoRoute } from "@/lib/seo/registry";
import {
  buildPageGraph,
  generateBreadcrumbSchema,
  generateOrganizationSchema,
  generateProductOfferSchema,
  generateWebApplicationSchema,
  generateWebPageSchema,
  generateWebSiteSchema,
  type JsonLdNode,
} from "@/lib/seo/schema";

/**
 * JSON-LD is derived from the runtime SEO registry and shared commercial claims.
 * No route-specific copy overrides are allowed here: visible/metadata/schema copy
 * must converge on the same governed sources instead of drifting independently.
 */
export function JsonLdForRoute({ path }: { path: string }) {
  const route = requireSeoRoute(path);
  const nodes: JsonLdNode[] = [];

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
        if (node && typeof node === "object") nodes.push(node as JsonLdNode);
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
    nodes.push(generateBreadcrumbSchema(buildSeoBreadcrumbItems(route)));
  }

  const payload = nodes.length === 1 ? nodes[0] : buildPageGraph(nodes);
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
