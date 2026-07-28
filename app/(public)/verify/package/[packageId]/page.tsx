import type { Metadata } from "next";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import VerifyPackageClientPage from "./VerifyPackageClient";

export const metadata: Metadata = generateSeoMetadata("/verify/package");

export default function Page() {
  return <VerifyPackageClientPage />;
}
