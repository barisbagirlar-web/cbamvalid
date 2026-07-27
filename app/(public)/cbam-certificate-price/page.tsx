import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";

export const metadata: Metadata = generateSeoMetadata("/cbam-certificate-price");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-certificate-price"
      ctaHref="/cbam-2026-definitive-period"
      ctaLabel="Open definitive-period timetable"
      sections={[
    {
      id: "answer",
      title: "Direct answer",
      paragraphs: [
          "CBAM certificate prices are calculated and published under Implementing Regulation (EU) 2025/2548. In 2026 the publication cadence is quarterly. That quarterly price mechanism must not be mislabelled as transitional quarterly emissions reporting.",
      ],
      
    },
    {
      id: "example",
      title: "Practical distinction",
      paragraphs: [
          "A 2026 Q1 or Q2 published certificate price informs financial exposure estimates. The declaration and surrender deadline for 2026 imports remains 30 September 2027 under the definitive-period timetable used by this site.",
      ],
      
    }
      ]}
    />
  );
}
