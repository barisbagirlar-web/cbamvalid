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

        <div className="border-t border-border pt-8 mt-8">
          <div className="bg-surface border border-border rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start shadow-sm">
            <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-lg shrink-0">
              IIT
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-bold font-serif text-foreground">Academic Oversight & Expert Review</h3>
              <p className="text-sm text-muted leading-relaxed">
                To guarantee mathematical integrity and compliance with EU CBAM allocation formulas, our computational engines undergo continuous expert peer-review.
              </p>
              <div className="pt-2 border-t border-border/50">
                <p className="font-semibold text-foreground text-sm">Prof. Dr. Neela Nataraj</p>
                <p className="text-xs text-muted">
                  Department of Mathematics · Indian Institute of Technology Bombay (IIT Bombay)
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
