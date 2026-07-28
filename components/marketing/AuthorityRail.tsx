import Link from "next/link";
import { AUTHORITY_HOMEPAGE_MAP, AUTHORITY_SURFACES } from "@/lib/marketing/authority-surfaces";

type RailMode = "compact" | "map";

const STATUS_LABEL = {
  LIVE: "LIVE",
  SAMPLE: "SAMPLE",
  EMPTY_BY_DESIGN: "EMPTY",
} as const;

/**
 * Enterprise authority map / compact rail.
 * One job: route buyers to published proof surfaces without inventing claims.
 */
export function AuthorityRail({
  mode = "compact",
  title = "Authority surfaces",
  eyebrow = "Proof · Cite · Inspect",
}: {
  mode?: RailMode;
  title?: string;
  eyebrow?: string;
}) {
  const items = mode === "map" ? AUTHORITY_HOMEPAGE_MAP : AUTHORITY_SURFACES.filter((s) => s.status !== "EMPTY_BY_DESIGN").slice(0, 8);

  if (mode === "compact") {
    return (
      <nav className="authority-rail" aria-label="Authority surfaces">
        <span className="authority-rail-label">{eyebrow}</span>
        <ul className="authority-rail-list">
          {items.map((item) => (
            <li key={item.id}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <section className="section tight authority-map-section">
      <div className="wrap">
        <div className="section-head center reveal">
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>
            Every surface below is live and claim-disciplined. SAMPLE means watermarked specimen.
            EMPTY means intentionally blank — never invented logos or testimonials.
          </p>
        </div>
        <div className="authority-map-grid">
          {items.map((item) => (
            <Link key={item.id} href={item.href} className="authority-map-card reveal">
              <span className="fmt">{STATUS_LABEL[item.status]}</span>
              <h3>{item.label}</h3>
              <p>{item.blurb}</p>
              <span className="authority-map-cta">
                Open <span className="arr">→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
