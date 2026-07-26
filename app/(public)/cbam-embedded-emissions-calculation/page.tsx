import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";

export const metadata: Metadata = generateSeoMetadata("/cbam-embedded-emissions-calculation");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-embedded-emissions-calculation"
      ctaHref="/methodology"
      ctaLabel="Open calculation methodology"
      sections={[
    {
      id: "answer",
      title: "Direct answer",
      paragraphs: [
          "Embedded emissions combine direct process/combustion emissions and, where required, electricity-related indirect emissions, plus applicable precursor emissions. Missing material inputs must block authoritative results rather than being converted to zero.",
      ],
      
    },
    {
      id: "required",
      title: "What data is required",
      paragraphs: [
          "Activity data with units, emission factors or measured emissions, electricity data where required, precursor quantities and factors, allocation shares that reconcile to installation totals, and evidence links for material values.",
      ],
      
    },
    {
      id: "risks",
      title: "Risks / limitations",
      paragraphs: [
          "Client-side previews are advisory. Authoritative sealed results must come from the server engine with calculation traces and integrity hashes.",
      ],
      
    }
      ]}
    />
  );
}
