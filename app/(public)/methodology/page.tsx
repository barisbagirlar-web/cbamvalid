import { MethodologyContent } from "@/components/methodology/MethodologyContent";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/schema";

import { ExpertAuthoritySection } from "@/components/seo/ExpertAuthoritySection";

export const metadata = generateSeoMetadata("/methodology");

export default function MethodologyPage() {
  const jsonLd = [
    generateBreadcrumbSchema([
      { name: "Home", item: "/" },
      { name: "Methodology", item: "/methodology" }
    ])
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MethodologyContent />
      
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <ExpertAuthoritySection toolName="CBAM Calculation Engine" />
      </div>
    </>
  );
}
