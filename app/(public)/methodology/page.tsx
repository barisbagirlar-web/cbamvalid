import { MethodologyContent } from "@/components/methodology/MethodologyContent";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateBreadcrumbSchema, generateArticleSchema, generateEnterpriseGraphSchema } from "@/lib/seo/schema";

import { ExpertAuthoritySection } from "@/components/seo/ExpertAuthoritySection";

export const metadata = generateSeoMetadata("/methodology");

export default function MethodologyPage() {
  const jsonLd = [
    generateEnterpriseGraphSchema("/methodology"),
    generateBreadcrumbSchema([
      { name: "Home", item: "/" },
      { name: "Methodology", item: "/methodology" }
    ]),
    generateArticleSchema({
      headline: "CBAM Calculation Methodology & Regulatory Sources Index",
      description: "Understand the deterministic CBAM calculation methodology used to calculate direct and indirect embedded emissions under EU Regulation 2023/956 and Implementing Regulation 2023/1773.",
      url: "/methodology",
      datePublished: "2024-01-01T00:00:00Z",
      citations: [
        { name: "Regulation (EU) 2023/956 — Carbon Border Adjustment Mechanism", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956" },
        { name: "Implementing Regulation (EU) 2023/1773", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773" },
        { name: "Commission Delegated Regulation (EU) 2024/3215", url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202403215" },
        { name: "ISO 14064-1 GHG Accounting Standard", url: "https://www.iso.org/standard/66453.html" }
      ]
    })
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MethodologyContent />
      
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <div data-testid="academic-oversight" aria-label="Academic Oversight">
          <ExpertAuthoritySection toolName="CBAM Calculation Engine" />
        </div>
      </div>
    </>
  );
}
