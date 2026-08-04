import type { Metadata } from "next";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";

export const metadata: Metadata = {
  title: "CBAMValid Product | Self-Service Emissions Data Software",
  description:
    "Customer-controlled B2B software for emissions data, deterministic calculations, automated quality controls, and automated PDF, JSON and XLSX delivery.",
  alternates: { canonical: "/product" },
  openGraph: {
    title: "CBAMValid Product | Self-Service Emissions Data Software",
    description:
      "Customer-controlled emissions data workspace with automated calculations, quality controls and digital exports.",
    url: "https://cbamvalid.com/product",
    type: "website",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLdForRoute path="/product" />
      {children}
    </>
  );
}
