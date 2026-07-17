import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import VerifyClient from "./VerifyClient";

export const metadata = generateSeoMetadata("/verify");

export default function VerifyPage() {
  return <VerifyClient />;
}
