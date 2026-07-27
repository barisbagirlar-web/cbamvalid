import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { RegulatoryGuidePage } from "@/components/seo/RegulatoryGuidePage";

export const metadata: Metadata = generateSeoMetadata("/cbam-non-eu-producer-guide");

export default function Page() {
  return (
    <RegulatoryGuidePage
      path="/cbam-non-eu-producer-guide"
      ctaHref="/register?next=/cases/new"
      ctaLabel="Start a free draft"
      sections={[
    {
      id: "answer",
      title: "Direct answer",
      paragraphs: [
          "Non-EU producers typically need to supply EU buyers with installation-specific embedded emissions evidence aligned to CBAM goods scope. Drafts can be prepared before payment; sealing consumes entitlement.",
      ],
      
    }
      ]}
    />
  );
}
