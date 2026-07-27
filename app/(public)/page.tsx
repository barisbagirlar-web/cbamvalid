import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import HomePageClient from "./HomePageClient";

export const metadata: Metadata = generateSeoMetadata("/");

export default function Page() {
  return (
    <>
      <JsonLdForRoute path="/" />
      <HomePageClient />
    </>
  );
}
