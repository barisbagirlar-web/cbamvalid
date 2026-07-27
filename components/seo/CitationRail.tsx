import { requireSeoRoute } from "@/lib/seo/registry";
import {
  SEO_LEGAL_SOURCE_INDEX,
  getRegulatoryFact,
} from "@/lib/seo/regulatory-sources";

/**
 * EUR-Lex citation rail — visible E-E-A-T evidence, not schema-only.
 */
export function CitationRail({ path }: { path: string }) {
  const route = requireSeoRoute(path);
  const sources = route.regulatorySourceIds
    .map((id) => SEO_LEGAL_SOURCE_INDEX[id as keyof typeof SEO_LEGAL_SOURCE_INDEX])
    .filter(Boolean);
  if (sources.length === 0) return null;

  const independence = getRegulatoryFact("INDEPENDENCE_BOUNDARY");

  return (
    <aside className="section tight citation-rail" aria-labelledby={`citation-h-${path.replace(/\W/g, "")}`}>
      <div className="wrap">
        <div className="section-head reveal">
          <span className="eyebrow">Primary sources</span>
          <h2 id={`citation-h-${path.replace(/\W/g, "")}`}>Regulatory citations for this page</h2>
          <p>
            Claims on this page are bounded by published EU legal instruments. CBAMValid does not rewrite
            regulations; sealed packages pin the ruleset version used at seal time.
          </p>
        </div>
        <ul className="citation-list">
          {sources.map((source) => (
            <li key={source.id} className="citation-item">
              <a href={source.eliUri} rel="noopener noreferrer" target="_blank" className="citation-link">
                <span className="citation-id">{source.id}</span>
                <span className="citation-title">{source.title}</span>
                <span className="citation-eli">ELI · {source.celexId}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="citation-boundary">{independence.statement}</p>
      </div>
    </aside>
  );
}

export function LastReviewed({ path }: { path: string }) {
  const route = requireSeoRoute(path);
  if (!route.factualLastModified) return null;
  return (
    <p className="last-reviewed wrap">
      <span className="last-reviewed-label">Last content review</span>{" "}
      <time dateTime={route.factualLastModified}>{route.factualLastModified}</time>
      {" · "}
      <span>Ruleset claims use pinned EU instruments — not inventing deadlines.</span>
    </p>
  );
}
