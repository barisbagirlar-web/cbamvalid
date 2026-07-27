import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";

export const metadata: Metadata = generateSeoMetadata("/cbam-2026-definitive-period");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-2026-definitive-period"
      ctaHref="/product"
      ctaLabel="Start verification preparation"
      sections={[
    {
      id: "what-changed",
      title: "What changed in 2026?",
      paragraphs: [
          "From 1 January 2026, CBAM operates under definitive-period rules. Obligations centre on annual declarations and certificate surrender for covered imports \u2014 not on recreating transitional-period quarterly emissions reporting as if it were the 2026 definitive system.",
      ],
      bullets: [
          "Definitive period starts 1 January 2026",
          "For 2026 imports, the first CBAM declaration and corresponding certificate surrender deadline is 30 September 2027",
          "Certificate price calculation cadence in 2026 is quarterly; that is not the same as transitional quarterly reporting",
        ],
    },
    {
      id: "who",
      title: "Who this affects",
      paragraphs: [
          "EU importers of CBAM goods and non-EU producers who must supply evidence-linked embedded emissions data to those importers.",
      ],
      
    },
    {
      id: "data",
      title: "What data is required",
      paragraphs: [
          "Goods identification (including CN classification), installation and production-route data, direct and indirect emissions evidence where required, precursor treatment where applicable, and a fail-closed quality review before verifier handover.",
      ],
      
    },
    {
      id: "cbamvalid",
      title: "How CBAMValid handles the task",
      paragraphs: [
          "CBAMValid structures the operator evidence package, runs deterministic calculations against versioned rulesets, and seals an immutable dossier for independent accredited verification. It does not replace accredited verification.",
      ],
      
    }
      ]}
    />
  );
}
