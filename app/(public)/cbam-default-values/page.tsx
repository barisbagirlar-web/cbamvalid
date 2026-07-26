import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";

export const metadata: Metadata = generateSeoMetadata("/cbam-default-values");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-default-values"
      ctaHref="/methodology"
      ctaLabel="See methodology sources"
      sections={[
    {
      id: "answer",
      title: "Direct answer",
      paragraphs: [
          "CBAM default values cannot safely be published as one emissions factor per CN code. Official defaults vary by dimensions such as year, country, CN/goods class, production route and direct/indirect emission type.",
      ],
      bullets: [
          "Do not invent a single SEO-friendly factor per CN page",
          "Consult the versioned official default-value sources used by the calculation engine",
          "Mark provisional estimates explicitly when official values are not yet published",
        ],
    }
      ]}
    />
  );
}
