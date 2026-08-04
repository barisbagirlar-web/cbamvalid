import type { Metadata } from "next";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";

export const metadata: Metadata = {
  title: "Sample Automated Digital Output | CBAMValid Software",
  description:
    "Preview an automated CBAMValid software output with PDF, structured data, workbook, integrity manifest and customer-controlled evidence links.",
  alternates: { canonical: "/sample-dossier" },
  openGraph: {
    title: "Sample Automated Digital Output | CBAMValid",
    description:
      "Preview the files generated automatically by the CBAMValid self-service software.",
    url: "https://cbamvalid.com/sample-dossier",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLdForRoute path="/sample-dossier" />
      {children}
    </>
  );
}
