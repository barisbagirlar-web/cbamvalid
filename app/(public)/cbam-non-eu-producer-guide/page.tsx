import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";
import { NON_EU_PRODUCER_SECTIONS } from "@/lib/seo/hub-content";

export const metadata: Metadata = generateSeoMetadata("/cbam-non-eu-producer-guide");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-non-eu-producer-guide"
      ctaHref="/register?next=/cases/new"
      ctaLabel="Start a free draft"
      sections={NON_EU_PRODUCER_SECTIONS}
    />
  );
}
