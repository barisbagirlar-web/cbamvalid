import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";

export const metadata: Metadata = generateSeoMetadata("/cbam-methodology");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-methodology"
      ctaHref="/methodology"
      ctaLabel="Open full methodology"
      sections={[
    {
      id: "answer",
      title: "Direct answer",
      paragraphs: [
          "Methodology choices must be versioned: system boundary, route, allocation, actual/default path and electricity treatment. Sealed releases freeze the ruleset and engine versions used.",
      ],
      
    }
      ]}
    />
  );
}
