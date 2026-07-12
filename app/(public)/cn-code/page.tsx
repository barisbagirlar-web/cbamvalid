import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateBreadcrumbSchema, generateFAQSchema } from "@/lib/seo/schema";
import Link from "next/link";

export const metadata = generateSeoMetadata("/cn-code");

export default function CnCodeHubPage() {
  const jsonLd = [
    generateBreadcrumbSchema([
      { name: "Home", item: "/" },
      { name: "CN-Code Hub", item: "/cn-code" }
    ]),
    generateFAQSchema([
      {
        question: "What is a CN code?",
        answer: "A Combined Nomenclature (CN) code is the European Union's eight-digit coding system used to classify goods for customs and statistical purposes."
      },
      {
        question: "Why does the CN code determine CBAM scope?",
        answer: "Under the CBAM regulation, only specific CN codes listed in Annex I fall within the scope of the carbon border adjustment mechanism. Correct classification is essential for compliance."
      }
    ])
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 font-sans text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      <h1 className="text-3xl font-serif font-black mb-8">CBAM CN-Code Verification Hub</h1>
      
      <section className="space-y-12">
        <div>
          <h2 className="text-2xl font-bold mb-3">What is a CN code?</h2>
          <p className="text-sm text-muted leading-relaxed">
            A Combined Nomenclature (CN) code is the European Union's eight-digit coding system used to classify goods for customs and statistical purposes. It is fundamental for determining the precise category of your imported products.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">Why does the CN code determine CBAM scope?</h2>
          <p className="text-sm text-muted leading-relaxed">
            Under the CBAM regulation, only specific CN codes listed in Annex I fall within the scope of the carbon border adjustment mechanism. Identifying your correct CN code is the mandatory first step to determine whether your imported goods are subject to CBAM reporting and certificate surrender obligations.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">Supported Sectors</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Currently, the CBAM regulation targets six primary sectors that are at high risk of carbon leakage. Our verification system covers all Annex I CN codes across these sectors:
          </p>
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
          <h2 className="text-2xl font-bold mb-3">How to verify a code and Limitations</h2>
          <p className="text-sm text-muted leading-relaxed">
            You can verify your code by checking the official Annex I of Regulation (EU) 2023/956. Note that certain codes have specific conditional checks (for example, particular types of polymers or specific downstream goods). While our hub provides detailed guidance, the final classification responsibility rests with the importer and their customs representative.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">Official Source Reference</h2>
          <p className="text-sm text-muted leading-relaxed">
            Our CN code index relies directly on <strong>Annex I of Regulation (EU) 2023/956</strong>. We do not provide customs classification advice.
          </p>
        </div>

        <div className="bg-surface border border-border p-6 rounded-xl mt-8">
          <h2 className="text-xl font-bold mb-4">Frequently Asked Questions</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-md mb-1">What is a CN code?</h3>
              <p className="text-muted text-sm">A Combined Nomenclature (CN) code is the European Union's eight-digit coding system used to classify goods for customs and statistical purposes.</p>
            </div>
            <div>
              <h3 className="font-semibold text-md mb-1">Why does the CN code determine CBAM scope?</h3>
              <p className="text-muted text-sm">Under the CBAM regulation, only specific CN codes listed in Annex I fall within the scope of the carbon border adjustment mechanism. Correct classification is essential for compliance.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
