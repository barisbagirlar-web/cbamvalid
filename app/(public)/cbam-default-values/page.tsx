import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";
import { DEFAULT_VALUES_SECTIONS } from "@/lib/seo/hub-content";

export const metadata: Metadata = generateSeoMetadata("/cbam-default-values");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-default-values"
      ctaHref="/methodology"
      ctaLabel="See methodology sources"
      sections={DEFAULT_VALUES_SECTIONS}
    />
  );
}
