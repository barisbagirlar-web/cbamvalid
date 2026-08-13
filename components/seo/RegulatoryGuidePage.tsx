import Link from "next/link";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { GUIDE_EDITORIAL } from "@/lib/seo/editorial-attribution";
import { requireSeoRoute } from "@/lib/seo/registry";
import {
  getRegulatoryFact,
  SEO_LEGAL_SOURCE_INDEX,
} from "@/lib/seo/regulatory-sources";
import type { GuideSection } from "@/lib/seo/hub-content";

export type { GuideSection };

function directAnswer(description: string, sections: readonly GuideSection[]): string {
  const source = [description, ...(sections[0]?.paragraphs ?? []), ...(sections[1]?.paragraphs ?? [])]
    .join(" ")
    .trim();
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length <= 60) return source;
  return `${words.slice(0, 58).join(" ")}…`;
}

export function RegulatoryGuidePage({
  path,
  sections,
  ctaHref,
  ctaLabel,
}: {
  path: string;
  sections: readonly GuideSection[];
  ctaHref: string;
  ctaLabel: string;
}) {
  const route = requireSeoRoute(path);
  const declaration = getRegulatoryFact("FIRST_DECLARATION_DEADLINE");
  const independence = getRegulatoryFact("INDEPENDENCE_BOUNDARY");
  const verifiedDate = route.factualLastModified ?? "not stated";

  return (
    <main className="max-w-3xl mx-auto px-6 py-10 md:py-14 font-sans text-foreground">
      <JsonLdForRoute path={path} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted mb-4">
        <ol className="flex gap-2">
          <li><Link href="/" className="hover:text-accent">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li>{route.h1}</li>
        </ol>
      </nav>

      <h1 className="font-sans text-3xl md:text-4xl font-bold tracking-tight mb-3">{route.h1}</h1>
      <p className="text-base md:text-lg text-muted leading-relaxed mb-3">{directAnswer(route.description, sections)}</p>

      <aside
        className="mb-8 rounded-md border border-border bg-surface p-4 text-sm text-muted space-y-3"
        aria-label="Guide authorship and review"
      >
        <p>
          <span className="font-semibold text-foreground">Written by:</span>{" "}
          {GUIDE_EDITORIAL.author.name} ({GUIDE_EDITORIAL.author.parentOrganization} ·{" "}
          {GUIDE_EDITORIAL.author.tradingName})
        </p>
        <p>
          <span className="font-semibold text-foreground">Role:</span> {GUIDE_EDITORIAL.author.role}
        </p>
        <p>
          <span className="font-semibold text-foreground">Reviewed by:</span>{" "}
          {GUIDE_EDITORIAL.reviewer.name} — {GUIDE_EDITORIAL.reviewer.role}
        </p>
        <p>
          <span className="font-semibold text-foreground">Last verified against EUR-Lex:</span>{" "}
          {verifiedDate}
        </p>
        <div>
          <p className="font-semibold text-foreground mb-1">Expertise basis</p>
          <ul className="list-disc pl-5 space-y-1">
            {GUIDE_EDITORIAL.expertiseBasis.map((line) => (
              <li key={line.slice(0, 48)}>{line}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-semibold text-foreground mb-1">Boundaries</p>
          <ul className="list-disc pl-5 space-y-1">
            {GUIDE_EDITORIAL.boundaryLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <p>
          Identity and academic-assessment disclosure:{" "}
          <Link href="/about" className="text-accent underline">
            About
          </Link>
          {" · "}
          <Link href="/methodology" className="text-accent underline">
            Methodology
          </Link>
          {" · "}
          <Link href="/trust" className="text-accent underline">
            Trust
          </Link>
        </p>
      </aside>

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="mb-8 space-y-3">
          <h2 className="text-xl md:text-2xl font-sans font-semibold">{section.title}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="text-sm text-muted leading-relaxed">{paragraph}</p>
          ))}
          {section.bullets ? (
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted">
              {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
          ) : null}
        </section>
      ))}

      <section className="mb-10 rounded-md border border-border bg-surface p-6">
        <h2 className="text-xl font-serif mb-3">Next step</h2>
        <Link
          href={ctaHref}
          prefetch={ctaHref.startsWith("/login") || ctaHref.startsWith("/register") ? false : undefined}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-6 py-3 text-sm font-medium text-surface"
        >
          {ctaLabel}
        </Link>
      </section>

      <section className="border-t border-border pt-6 text-xs text-muted space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Regulatory basis / last review</h2>
        <p>{declaration.statement}</p>
        <p>{independence.statement}</p>
        <ul className="list-disc pl-5 space-y-1">
          {route.regulatorySourceIds.map((id) => {
            const source = SEO_LEGAL_SOURCE_INDEX[id as keyof typeof SEO_LEGAL_SOURCE_INDEX];
            if (!source) return null;
            return (
              <li key={id}>
                {source.id}:{" "}
                <a className="text-accent underline" href={source.eliUri} rel="noreferrer" target="_blank">{source.title}</a>
              </li>
            );
          })}
        </ul>
        <p>Last content review: {verifiedDate}</p>
      </section>

      <section className="mt-8 text-sm">
        <h2 className="font-semibold mb-2">Related</h2>
        <ul className="space-y-1">
          {route.internalLinkTargets.map((target) => {
            const targetRoute = requireSeoRoute(target);
            return (
              <li key={target}><Link className="text-accent underline" href={target}>{targetRoute.h1}</Link></li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
