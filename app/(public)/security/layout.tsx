import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";

export const metadata: Metadata = generateSeoMetadata("/security");

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLdForRoute path="/security" />
      {children}
    </>
  );
}
