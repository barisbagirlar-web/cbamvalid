import Link from "next/link";
import { requireSeoRoute } from "@/lib/seo/registry";

/**
 * Visible breadcrumb trail — mirrors BreadcrumbList JSON-LD.
 * Enterprise AEO: crawlers + humans share the same hierarchy.
 */
export function SeoBreadcrumbs({ path }: { path: string }) {
  const route = requireSeoRoute(path);
  if (route.canonicalPath === "/") return null;

  const crumbs: { name: string; href: string }[] = [{ name: "Home", href: "/" }];
  if (route.pageType === "cn-detail") {
    crumbs.push({ name: "CN code scope", href: "/cn-code" });
  }
  if (route.path.startsWith("/cbam-") || route.path === "/glossary" || route.path === "/answers") {
    crumbs.push({ name: "CBAM resources", href: "/methodology" });
  }
  crumbs.push({ name: route.h1, href: route.canonicalPath });

  return (
    <nav className="seo-breadcrumbs wrap" aria-label="Breadcrumb">
      <ol className="seo-breadcrumb-list" itemScope itemType="https://schema.org/BreadcrumbList">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li
              key={crumb.href + crumb.name}
              className="seo-breadcrumb-item"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {isLast ? (
                <span itemProp="name" aria-current="page">
                  {crumb.name}
                </span>
              ) : (
                <Link href={crumb.href} itemProp="item">
                  <span itemProp="name">{crumb.name}</span>
                </Link>
              )}
              <meta itemProp="position" content={String(index + 1)} />
              {!isLast ? (
                <span className="seo-breadcrumb-sep" aria-hidden="true">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
