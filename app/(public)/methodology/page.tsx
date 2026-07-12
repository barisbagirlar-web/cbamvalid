import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/schema";

export const metadata = generateSeoMetadata("/methodology");

export default function MethodologyPage() {
  const jsonLd = [
    generateBreadcrumbSchema([
      { name: "Home", item: "/" },
      { name: "Methodology", item: "/methodology" }
    ])
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 font-sans text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="text-3xl font-serif font-black mb-8">CBAM Calculation Methodology</h1>
      
      <section className="space-y-12">
        <div>
          <h2 className="text-2xl font-bold mb-3">1. Scope Determination and Sector Classification</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Scope determination identifies whether imported goods fall under CBAM regulations by cross-referencing their Combined Nomenclature (CN) codes against Annex I of the CBAM Regulation. Accurate sector classification ensures that the correct emission boundaries, including relevant precursors, are applied to the specific product category.
          </p>
          <p className="text-sm text-muted leading-relaxed">
            Our system maps input CN codes to the six primary CBAM sectors: iron and steel, aluminium, cement, fertilisers, hydrogen, and electricity. This mapping dictates the mandatory data fields for subsequent calculation steps.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">2. Actual-Value vs. Default-Value Pathways</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            The actual-value pathway relies on verified primary data collected directly from the installation site, while the default-value pathway uses globally established averages published by the European Commission. Declarants must prioritize actual values, using default values only when primary data is demonstrably unavailable or during specific transitional grace periods.
          </p>
          <p className="text-sm text-muted leading-relaxed">
            CBAMValid evaluates the completeness of the user's primary data inputs. If gaps are detected, the system applies the official EU default values and flags these entries in the evidence package as reliant on secondary data.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">3. Direct and Indirect Emissions</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Direct emissions occur directly from the production processes at the installation, whereas indirect emissions account for the greenhouse gases released during the generation of the electricity consumed by those processes. Both components must be quantified to determine the total specific embedded emissions of the product.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">4. Precursor Handling and System Boundaries</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Precursor handling involves tracking the emissions embedded in raw materials that are consumed during the manufacturing of a downstream good. The system boundaries define exactly which processes and precursor materials must be included in the calculation to prevent double counting and ensure full supply chain traceability.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">5. Production Volume and Embedded Emissions</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Specific embedded emissions are calculated by dividing the total attributed emissions of an installation by its total production volume. This standardizes the carbon footprint per unit of output (typically per tonne), allowing for accurate determination of the CBAM certificates required upon importation.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">6. Carbon Price Paid Treatment</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            The carbon price paid refers to any mandatory carbon tax, levy, or emission trading system cost already incurred in the country of origin. This amount can be deducted from the final CBAM obligation, provided strict documentary evidence of payment and non-reimbursement is supplied in the compliance dossier.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">7. Calculation Trace, Rounding, and Sealing</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            The calculation trace is a step-by-step mathematical audit log demonstrating exactly how inputs were transformed into the final emissions figure. Standard EU rounding rules are applied at defined stages. Once verified, the report undergoes report sealing to lock the version and generate a cryptographic-style hash for the final XML.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">8. Source Versioning and Corrections</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Source versioning tracks which specific iteration of EU default values and Implementing Regulations were active at the time of calculation. If underlying regulatory values change, or if user errors are detected, our correction process allows for the transparent versioning of a new report without overwriting the historical audit trail.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">9. Independence and Limitations</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            CBAMValid is an independent software service and is not an official European Commission or CBAM Registry service. Our outputs support CBAM evidence preparation, but user-supplied data remains the user's responsibility. The service does not constitute legal or tax advice, and regulatory acceptance is not guaranteed.
          </p>
        </div>
      </section>
    </div>
  );
}
