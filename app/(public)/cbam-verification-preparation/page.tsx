import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";

export const metadata: Metadata = generateSeoMetadata("/cbam-verification-preparation");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-verification-preparation"
      ctaHref="/product"
      ctaLabel="Prepare verification evidence"
      sections={[
    {
      id: "answer",
      title: "Direct answer",
      paragraphs: [
          "Verification preparation means assembling complete, evidence-linked emissions data so an independent accredited verifier can perform assurance work. CBAMValid prepares the package; it does not issue the verification opinion.",
      ],
      bullets: [
          "Scope and CN reasoning",
          "Evidence register with hash integrity",
          "Calculation annex and trace",
          "Findings and corrective actions closed for material issues",
        ],
    }
      ]}
    />
  );
}
