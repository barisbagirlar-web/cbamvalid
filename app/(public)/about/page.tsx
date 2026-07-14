import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/schema";

export const metadata = generateSeoMetadata("/about");

export default function AboutPage() {
  const jsonLd = [
    generateBreadcrumbSchema([
      { name: "Home", item: "/" },
      { name: "About Us", item: "/about" }
    ])
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 font-sans text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="text-3xl font-serif font-black mb-6">About CBAMValid</h1>
      
      <section className="space-y-6">
        <p className="text-sm text-muted leading-relaxed">
          CBAMValid is an independent software platform designed to assist exporters and importers worldwide in navigating the complexities of the European Union's Carbon Border Adjustment Mechanism (CBAM).
        </p>
        <p className="text-sm text-muted leading-relaxed">
          Our mission is to simplify the compilation of embedded emissions data, ensuring that technical calculations adhere deterministically to the latest regulatory benchmarks and methodologies. We bridge the gap between industrial production facilities and EU compliance requirements by structuring data into the required XML and PDF formats.
        </p>

        <div className="p-4 bg-accent-soft text-accent text-sm rounded-md border border-accent/20">
          <strong>Independence Notice:</strong> CBAMValid is an independent software service and is not an official European Commission or CBAM Registry service.
        </div>
      </section>
    </div>
  );
}
