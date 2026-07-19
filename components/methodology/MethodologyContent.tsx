import React from "react";

type MethodologyContentProps = {
  showTitle?: boolean;
};

export function MethodologyContent({ showTitle = true }: MethodologyContentProps) {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 font-sans text-foreground">
      {showTitle && (
        <h1 className="text-3xl font-serif font-black mb-8">CBAM Calculation Methodology</h1>
      )}

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
            The actual-value pathway relies on primary data collected directly from the installation site, while the default-value pathway uses values published or accepted under the applicable CBAM ruleset. Declarants should prioritize actual values where required and use default values only when the governing rules permit them.
          </p>
          <p className="text-sm text-muted leading-relaxed">
            CBAMValid evaluates the completeness of the user&apos;s primary data inputs. If gaps are detected, the system records the applicable fallback method and flags the affected entries in the evidence package.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">3. Direct and Indirect Emissions</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Direct emissions occur directly from the production processes at the installation, whereas indirect emissions account for greenhouse gases associated with electricity consumed by those processes. The applicable sector rules determine which components must be quantified for the reported good.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">4. Precursor Handling and System Boundaries</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Precursor handling tracks emissions embedded in relevant input materials consumed during the manufacture of a downstream good. System boundaries define which processes and precursor materials are included, helping prevent double counting and preserve data lineage.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">5. Production Volume and Embedded Emissions</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Specific embedded emissions are determined from the emissions attributed to the production process and the corresponding production quantity. Units, allocation rules and rounding stages are retained in the calculation trace.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">6. Carbon Price Paid Treatment</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            A carbon price paid in the country of origin may be relevant where the applicable CBAM rules permit recognition and the required documentary evidence is available. CBAMValid records the claimed amount, supporting evidence, adjustments and unresolved limitations without guaranteeing regulatory acceptance.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">7. Calculation Trace, Rounding, and Sealing</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            The calculation trace records how source inputs, normalized units, formulas, allocation steps and rounding rules produce the reported emissions values. After required quality checks pass, sealing creates an immutable report version and integrity hashes for the generated preparation package.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">8. Source Versioning and Corrections</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Source versioning records which legal and technical ruleset was active for a calculation. When source data, regulatory inputs or user entries change, a new report version is generated without overwriting the historical audit trail.
          </p>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-3">9. Independence and Limitations</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            CBAMValid is an independent software service and is not an official European Commission or CBAM Registry service. Outputs support CBAM evidence and verification preparation; user-supplied data remains the user&apos;s responsibility. The service does not constitute legal or tax advice, does not issue an accredited verification opinion, and does not guarantee regulatory acceptance.
          </p>
        </div>

        <div className="border-t border-border pt-8 mt-8">
          <div className="bg-accent-soft/20 border border-accent/20 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start">
            <div className="w-12 h-12 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-lg shrink-0">
              IIT
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-bold font-serif text-foreground">Academic Oversight & Expert Review</h3>
              <p className="text-sm text-muted leading-relaxed">
                To guarantee mathematical rigour and absolute compliance with EU CBAM allocation formulas, our computational engines undergo continuous expert peer-review.
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
