import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";
import { CN_CODE_SCOPE_SECTIONS } from "@/lib/seo/hub-content";

export const metadata: Metadata = generateSeoMetadata("/cbam-cn-code-scope");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-cn-code-scope"
      ctaHref="/cn-code"
      ctaLabel="Open CN scope hub"
      sections={CN_CODE_SCOPE_SECTIONS}
    />
  );
}
