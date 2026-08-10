import { buildSeoBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
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
 * JSON-LD uses the same route metadata resolver that feeds visible search metadata,
 * while commercial Product/Offer claims stay on their verified pricing SSOT.
 * This prevents schema copy from silently drifting behind title/description changes.
 */
export function JsonLdForRoute({ path }: { path: string }) {
  const route = requireSeoRoute(path);
  const metadata = generateSeoMetadata(path);
  const publicTitle = typeof metadata.title === "string" ? metadata.title : route.title;
  const publicDescription =
    typeof metadata.description === "string" ? metadata.description : route.description;
  const nodes: JsonLdNode[] = [];

  if (route.schemaTypes.includes("Organization") || path === "/") {
    nodes.push(generateOrganizationSchema());
  }
  if (route.schemaTypes.includes("WebSite") || path === "/") {
    nodes.push(generateWebSiteSchema());
  }
  if (route.schemaTypes.includes("WebApplication")) {
    nodes.push(generateWebApplicationSchema(publicDescription));
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
        name: publicTitle,
        description: publicDescription,
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
