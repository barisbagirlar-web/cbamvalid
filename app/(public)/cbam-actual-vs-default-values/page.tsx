import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";

export const metadata: Metadata = generateSeoMetadata("/cbam-actual-vs-default-values");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-actual-vs-default-values"
      ctaHref="/cbam-default-values"
      ctaLabel="Read default-values guide"
      sections={[
    {
      id: "answer",
      title: "Direct answer",
      paragraphs: [
          "Actual values reflect installation-specific monitored or calculated emissions and generally require independent verification where legally required. Default values are official fallbacks that depend on multiple regulatory dimensions \u2014 not a single universal CN number.",
      ],
      
    },
    {
      id: "decision",
      title: "Decision utility",
      paragraphs: [
          "Choose actual values when evidence quality supports verification. Use defaults only under the conditions permitted by the applicable implementing rules, understanding mark-ups and dimensional dependencies.",
      ],
      
    }
      ]}
    />
  );
}
