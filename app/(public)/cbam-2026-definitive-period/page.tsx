import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";
import { DEFINITIVE_2026_SECTIONS } from "@/lib/seo/hub-content";

export const metadata: Metadata = generateSeoMetadata("/cbam-2026-definitive-period");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-2026-definitive-period"
      ctaHref="/product"
      ctaLabel="Start verification preparation"
      sections={DEFINITIVE_2026_SECTIONS}
    />
  );
}
