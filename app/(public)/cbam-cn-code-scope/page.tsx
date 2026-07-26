import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";

export const metadata: Metadata = generateSeoMetadata("/cbam-cn-code-scope");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-cn-code-scope"
      ctaHref="/cn-code"
      ctaLabel="Open CN scope hub"
      sections={[
    {
      id: "answer",
      title: "Direct answer",
      paragraphs: [
          "CBAM goods scope is defined through Combined Nomenclature classifications in Annex I of Regulation (EU) 2023/956 and related acts. Only codes that pass official registry membership and content quality gates are indexable on CBAMValid.",
      ],
      
    }
      ]}
    />
  );
}
