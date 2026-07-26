import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";

export const metadata: Metadata = generateSeoMetadata("/cbam-exporter-evidence-requirements");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-exporter-evidence-requirements"
      ctaHref="/sample-dossier"
      ctaLabel="Review sample dossier"
      sections={[
    {
      id: "answer",
      title: "Direct answer",
      paragraphs: [
          "Material data must carry evidence lineage: document identity, period coverage, SHA-256 integrity, review status and field linkage. Pending, unsupported or mismatched evidence must block sealing.",
      ],
      
    }
      ]}
    />
  );
}
