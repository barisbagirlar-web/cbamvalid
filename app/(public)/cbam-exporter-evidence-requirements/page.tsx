import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";
import { EXPORTER_EVIDENCE_SECTIONS } from "@/lib/seo/hub-content";

export const metadata: Metadata = generateSeoMetadata("/cbam-exporter-evidence-requirements");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-exporter-evidence-requirements"
      ctaHref="/sample-dossier"
      ctaLabel="Review sample dossier"
      sections={EXPORTER_EVIDENCE_SECTIONS}
    />
  );
}
