import Link from "next/link";
import { buildSeoBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { requireSeoRoute } from "@/lib/seo/registry";

/**
 * Visible breadcrumb trail and BreadcrumbList JSON-LD consume the same SSOT.
 */
export function SeoBreadcrumbs({ path }: { path: string }) {
  const route = requireSeoRoute(path);
  const crumbs = buildSeoBreadcrumbItems(route);
  if (crumbs.length === 0) return null;

  return (
    <nav className="seo-breadcrumbs" aria-label="Breadcrumb">
      <div className="wrap">
        <ol className="seo-breadcrumb-list" itemScope itemType="https://schema.org/BreadcrumbList">
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            return (
              <li
                key={crumb.item + crumb.name}
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
                  <Link href={crumb.item} itemProp="item">
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
      </div>
    </nav>
  );
}
