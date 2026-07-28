import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";
import { CERTIFICATE_PRICE_SECTIONS } from "@/lib/seo/hub-content";

export const metadata: Metadata = generateSeoMetadata("/cbam-certificate-price");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-certificate-price"
      ctaHref="/cbam-2026-definitive-period"
      ctaLabel="Open definitive-period timetable"
      sections={CERTIFICATE_PRICE_SECTIONS}
    />
  );
}
