import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";
import { VERIFICATION_PREPARATION_SECTIONS } from "@/lib/seo/hub-content";

export const metadata: Metadata = generateSeoMetadata("/cbam-verification-preparation");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-verification-preparation"
      ctaHref="/product"
      ctaLabel="Prepare verification evidence"
      sections={VERIFICATION_PREPARATION_SECTIONS}
    />
  );
}
