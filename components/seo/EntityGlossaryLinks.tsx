import Link from "next/link";
import { resolveEntityToGlossary } from "@/lib/seo/aeo/glossary";

/**
 * Turn free-text entity strings into glossary deep-links for topical SEO / AEO.
 */
export function EntityGlossaryLinks({
  entities,
  label = "Defined entities",
}: {
  entities: readonly string[];
  label?: string;
}) {
  if (entities.length === 0) return null;

  const resolved = entities.map((entity) => {
    const hit = resolveEntityToGlossary(entity);
    return { entity, href: hit?.href ?? null, name: hit?.name ?? entity };
  });

  return (
    <div className="entity-glossary-links" aria-label={label}>
      <span className="authority-step-label">{label}</span>
      <ul className="entity-chip-list">
        {resolved.map((item) => (
          <li key={item.entity}>
            {item.href ? (
              <Link href={item.href} className="entity-chip">
                {item.name}
              </Link>
            ) : (
              <span className="entity-chip entity-chip-plain">{item.entity}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
