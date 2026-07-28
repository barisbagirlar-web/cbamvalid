import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";
import { ACTUAL_VS_DEFAULT_SECTIONS } from "@/lib/seo/hub-content";

export const metadata: Metadata = generateSeoMetadata("/cbam-actual-vs-default-values");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-actual-vs-default-values"
      ctaHref="/cbam-default-values"
      ctaLabel="Read default-values guide"
      sections={ACTUAL_VS_DEFAULT_SECTIONS}
    />
  );
}
