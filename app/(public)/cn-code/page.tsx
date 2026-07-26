import type { Metadata } from "next";
import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateBreadcrumbSchema, generateFAQSchema } from "@/lib/seo/schema";
import {
  CN_INDEXABILITY_STAGE,
  FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS,
  listIndexablePublicCnEntries,
} from "@/lib/seo/cn-public-registry";
import { evaluateCnIndexability } from "@/lib/seo/indexability";
import { isCbamCovered } from "@/lib/seo/cbam-scope-rules";

interface HubProps {
  searchParams: Promise<{ code?: string | string[] }>;
}

function normalizeQueryCode(raw: string | string[] | undefined): string | null {
  if (!raw) return null;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const cleaned = value.replace(/\s+/g, "");
  if (!/^\d{2,8}$/.test(cleaned)) return null;
  return cleaned.padStart(8, "0").slice(-8);
}

export async function generateMetadata({ searchParams }: HubProps): Promise<Metadata> {
  const params = await searchParams;
  const queried = normalizeQueryCode(params.code);
  const base = generateSeoMetadata("/cn-code");

  // Arbitrary CN lookup is a utility result — never a distinct indexable entity URL.
  if (queried) {
    return {
      ...base,
      robots: { index: false, follow: false, noarchive: true, nosnippet: true },
      alternates: {
        canonical: "https://cbamvalid.com/cn-code",
      },
    };
  }
  return base;
}

export default async function CnCodeHubPage({ searchParams }: HubProps) {
  const params = await searchParams;
  const queried = normalizeQueryCode(params.code);
  const entries = listIndexablePublicCnEntries();
  const lookup = queried
    ? {
        code: queried,
        indexability: evaluateCnIndexability(queried),
        coverage: isCbamCovered(queried),
      }
    : null;

  const jsonLd = [
    generateBreadcrumbSchema([
      { name: "Home", item: "/" },
      { name: "CN-Code Hub", item: "/cn-code" },
    ]),
    generateFAQSchema([
      {
        question: "What is a CN code?",
        answer:
          "A Combined Nomenclature (CN) code is the European Union's eight-digit coding system used to classify goods for customs and statistical purposes.",
      },
      {
        question: "Why does the CN code determine CBAM scope?",
        answer:
          "Under the CBAM regulation, only specific CN codes listed in Annex I fall within the scope of the carbon border adjustment mechanism. Correct classification is essential for compliance.",
      },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: entries.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `https://cbamvalid.com/cn-code/${entry.cnCode}`,
        name: `CN ${entry.cnCode}`,
      })),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 font-sans text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <h1 className="text-3xl font-serif font-black mb-8">CBAM CN-Code Verification Hub</h1>

      <section className="mb-10 rounded-md border border-border bg-surface p-6 space-y-4">
        <h2 className="text-xl font-bold">Look up a CN code</h2>
        <p className="text-sm text-muted leading-relaxed">
          Use this utility to check Stage-1 public decision pages. Detail URLs exist only for
          verified allowlisted codes. This lookup is not a complete CBAM CN directory.
        </p>
        <form method="get" action="/cn-code" className="flex flex-col sm:flex-row gap-3">
          <label className="sr-only" htmlFor="cn-lookup">
            CN code
          </label>
          <input
            id="cn-lookup"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{2,8}"
            placeholder="e.g. 72011011"
            defaultValue={queried ?? ""}
            className="min-h-11 flex-1 rounded-md border border-border bg-background px-3 font-mono text-sm"
          />
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-surface"
          >
            Look up
          </button>
        </form>
        {lookup ? (
          <div className="text-sm space-y-2 border-t border-border pt-4">
            <p className="font-mono">
              Query: <strong>{lookup.code}</strong>
            </p>
            {lookup.indexability.indexable ? (
              <p>
                Verified Stage-1 public page:{" "}
                <Link className="text-accent underline font-mono" href={`/cn-code/${lookup.code}`}>
                  /cn-code/{lookup.code}
                </Link>
              </p>
            ) : lookup.coverage.covered ? (
              <p className="text-muted">
                Annex hierarchical rules may cover this prefix, but CBAMValid does not yet publish a
                public decision page for it ({CN_INDEXABILITY_STAGE};{" "}
                {FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS}). No indexable detail URL is available.
              </p>
            ) : (
              <p className="text-muted">
                Not in the current Stage-1 public allowlist and not presented as a published CN
                detail entity. Use the hub list below or start a dossier for case-specific
                classification support.
              </p>
            )}
            <p className="text-xs text-muted">
              Lookup results are noindex utility responses. They are not a full Annex I inventory.
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-12">
        <div>
          <h2 className="text-2xl font-bold mb-3">What is a CN code?</h2>
          <p className="text-sm text-muted leading-relaxed">
            A Combined Nomenclature (CN) code is the European Union&apos;s eight-digit coding system
            used to classify goods for customs and statistical purposes. It is fundamental for
            determining the precise category of your imported products.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">Why does the CN code determine CBAM scope?</h2>
          <p className="text-sm text-muted leading-relaxed">
            Under the CBAM regulation, only specific CN codes listed in Annex I fall within the scope
            of the carbon border adjustment mechanism. Identifying your correct CN code is the
            mandatory first step to determine whether your imported goods are subject to CBAM
            reporting and certificate surrender obligations.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">Stage-1 verified allowlist (public pages)</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Only {entries.length} CN codes currently pass official Stage-1 membership and
            content-quality gates for public indexing. Chapter membership alone is not enough. Full
            2026 Combined Nomenclature universe resolution remains{" "}
            {FULL_OFFICIAL_SCOPE_RESOLUTION_STATUS}.
          </p>
          <ul className="space-y-2 text-sm">
            {entries.map((entry) => (
              <li key={entry.cnCode}>
                <Link className="text-accent underline font-mono" href={`/cn-code/${entry.cnCode}`}>
                  {entry.cnCode}
                </Link>
                <span className="text-muted"> — {entry.description}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">Supported Sectors</h2>
          <ul className="list-disc list-inside text-sm text-muted space-y-2">
            <li>Iron and Steel</li>
            <li>Aluminium</li>
            <li>Cement</li>
            <li>Fertilisers</li>
            <li>Hydrogen</li>
            <li>Electricity</li>
          </ul>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">Official Source Reference</h2>
          <p className="text-sm text-muted leading-relaxed">
            Stage-1 pages rely on Annex I of Regulation (EU) 2023/956 hierarchical scope rules. This
            hub is not a complete CBAM CN directory and does not provide customs classification
            advice. Related guide:{" "}
            <Link className="text-accent underline" href="/cbam-cn-code-scope">
              CBAM CN Code Scope
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
