import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AuthorityChainSection } from "@/components/seo/AuthorityChain";
import { TopicalMapSection } from "@/components/seo/AnswerEvidenceSection";

export const metadata: Metadata = generateSeoMetadata("/verify");

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLdForRoute path="/verify" />
      <AuthorityChainSection path="/verify" />
      {children}
      <TopicalMapSection path="/verify" />
    </>
  );
}
