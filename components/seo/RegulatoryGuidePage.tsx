import Link from "next/link";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AuthorityChainSection, AuthorityLead } from "@/components/seo/AuthorityChain";
import { AnswerEvidenceSection, TopicalMapSection } from "@/components/seo/AnswerEvidenceSection";
import { requireSeoRoute } from "@/lib/seo/registry";
import { getAuthorityChain } from "@/lib/seo/aeo/authority-chains";
import {
  getRegulatoryFact,
  SEO_LEGAL_SOURCE_INDEX,
} from "@/lib/seo/regulatory-sources";

export interface GuideSection {
  readonly id: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly string[];
}

export function RegulatoryGuidePage({
  path,
  sections = [],
  ctaHref,
  ctaLabel,
}: {
  path: string;
  sections?: readonly GuideSection[];
  ctaHref: string;
  ctaLabel: string;
}) {
  const route = requireSeoRoute(path);
  const declaration = getRegulatoryFact("FIRST_DECLARATION_DEADLINE");
  const independence = getRegulatoryFact("INDEPENDENCE_BOUNDARY");
  const chain = getAuthorityChain(path);

  return (
    <main className="max-w-3xl mx-auto px-6 py-16 font-sans text-foreground">
      <JsonLdForRoute path={path} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted mb-6">
        <ol className="flex gap-2">
          <li>
            <Link href="/" className="hover:text-accent">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>{route.h1}</li>
        </ol>
      </nav>

      <h1 className="font-serif text-4xl tracking-tight mb-4">{route.h1}</h1>
      <p className="text-lg text-muted leading-relaxed mb-4">{route.description}</p>

      {chain ? (
        <AuthorityLead path={path} />
      ) : (
        <p className="text-sm leading-relaxed mb-10 rounded-md border border-border bg-surface p-4">
          <strong>Why this page exists:</strong> CBAM deadlines and evidence requests create real commercial pressure.
          This guide states what is known with sources, what CBAMValid prepares, and what only an accredited verifier can decide.
        </p>
      )}

      {chain ? <AuthorityChainSection path={path} /> : null}

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="mb-10 space-y-3">
          <h2 className="text-2xl font-serif">{section.title}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 24)} className="text-sm text-muted leading-relaxed">
              {paragraph}
            </p>
          ))}
          {section.bullets ? (
            <ul className="list-disc pl-5 space-y-2 text-sm text-muted">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}

      <AnswerEvidenceSection path={path} heading="Cited answers for this topic" limit={2} />
      <TopicalMapSection path={path} />

      <section className="mb-10 rounded-md border border-border bg-surface p-6">
        <h2 className="text-xl font-serif mb-3">Next step</h2>
        <Link
          href={ctaHref}
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
                <a className="text-accent underline" href={source.eliUri} rel="noreferrer" target="_blank">
                  {source.title}
                </a>
              </li>
            );
          })}
        </ul>
        <p>Last content review: {route.factualLastModified ?? "not stated"}</p>
      </section>

      <section className="mt-8 text-sm">
        <h2 className="font-semibold mb-2">Related</h2>
        <ul className="space-y-1">
          {route.internalLinkTargets.map((target) => (
            <li key={target}>
              <Link className="text-accent underline" href={target}>
                {target === "/" ? "Home" : target}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
