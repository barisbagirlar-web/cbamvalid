import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AuthorityChainSection, AuthorityLead } from "@/components/seo/AuthorityChain";
import { TopicalMapSection } from "@/components/seo/AnswerEvidenceSection";
import { listIndexablePublicCnEntries } from "@/lib/seo/cn-public-registry";
import Link from "next/link";

export const metadata = generateSeoMetadata("/cn-code");

export default function CnCodeHubPage() {
  const entries = listIndexablePublicCnEntries();
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: entries.map((entry, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `https://cbamvalid.com/cn-code/${entry.cnCode}`,
      name: `CN ${entry.cnCode}`,
    })),
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 font-sans text-foreground">
      <JsonLdForRoute path="/cn-code" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />

      <h1 className="text-3xl font-serif font-black mb-6">CBAM CN-Code Verification Hub</h1>
      <AuthorityLead path="/cn-code" />
      <AuthorityChainSection path="/cn-code" />

      <section className="space-y-12 mt-10">
        <div>
          <h2 className="text-2xl font-bold mb-3">What is a CN code?</h2>
          <p className="text-sm text-muted leading-relaxed">
            A Combined Nomenclature (CN) code is the European Union&apos;s eight-digit coding system used to
            classify goods for customs and statistical purposes. It is fundamental for determining the
            precise category of your imported products.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">Why does the CN code determine CBAM scope?</h2>
          <p className="text-sm text-muted leading-relaxed">
            Under the CBAM regulation, only specific CN codes listed in Annex I fall within the scope of
            the carbon border adjustment mechanism. Identifying your correct CN code is the mandatory
            first step to determine whether your imported goods are subject to CBAM reporting and
            certificate surrender obligations.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">Stage-1 indexable CN decision pages</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Only CN codes that pass official scope membership and content-quality gates are indexable.
            Chapter membership alone is not enough.
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
            Our CN code index relies directly on <strong>Annex I of Regulation (EU) 2023/956</strong>. We
            do not provide customs classification advice. Related guide:{" "}
            <Link className="text-accent underline" href="/cbam-cn-code-scope">
              CBAM CN Code Scope
            </Link>
            .
          </p>
        </div>
      </section>

      <TopicalMapSection path="/cn-code" />
    </div>
  );
}
