import type { Metadata } from "next";
import SoftwareProductHome from "@/components/marketing/SoftwareProductHome";

export const metadata: Metadata = {
  title: "CBAMValid — Self-Service Emissions Data Software",
  description:
    "B2B self-service software for customer-entered emissions data, deterministic calculations, automated quality controls, and automated PDF, JSON and XLSX delivery.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "CBAMValid — Self-Service Emissions Data Software",
    description:
      "Customer-controlled emissions data workspace with automated calculations, quality controls and digital document generation.",
    url: "https://cbamvalid.com/",
    type: "website",
  },
};

export default function Page() {
  return <SoftwareProductHome />;
}
