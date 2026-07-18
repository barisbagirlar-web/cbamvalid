import React from "react";

type MethodologyContentProps = {
  showTitle?: boolean;
};

const EU_CITATIONS = [
  {
    name: "Regulation (EU) 2023/956 — Carbon Border Adjustment Mechanism (founding regulation)",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956",
    ref: "OJ L 130, 16.5.2023, p. 52-104"
  },
  {
    name: "Implementing Regulation (EU) 2023/1773 — CBAM transitional period reporting",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773",
    ref: "OJ L 228, 15.9.2023"
  },
  {
    name: "Commission Delegated Regulation (EU) 2024/3215 — CBAM calculation methodology",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202403215",
    ref: "OJ L 2024/3215"
  },
  {
    name: "EU CBAM Guidance — European Commission DG TAXUD",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773",
    ref: "European Commission, DG TAXUD"
  },
  {
    name: "Annex I — CBAM Goods and CN Codes in Scope (Regulation EU 2023/956)",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956#anx_I",
    ref: "Annex I, Regulation (EU) 2023/956"
  }
];

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
            Scope determination identifies whether imported goods fall under CBAM regulations by cross-referencing their CN codes against{" "}
            <a href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956#anx_I" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:no-underline">
              Annex I of Regulation (EU) 2023/956
            </a>
            . Accurate sector classification ensures that the correct emission boundaries, including relevant precursors, are applied.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-3">2. Actual-Value vs. Default-Value Pathways</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            The actual-value pathway relies on primary installation data, while the default-value pathway uses values published under{" "}
            <a href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R1773" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:no-underline">
              Implementing Regulation (EU) 2023/1773
            </a>
            . Declarants should prioritise actual values where required.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-3">3. Direct and Indirect Emissions</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Direct emissions occur from production processes at the installation. Indirect emissions cover greenhouse gases from electricity consumption. Applicable sector rules in{" "}
            <a href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32023R0956" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:no-underline">
              Regulation (EU) 2023/956
            </a>{" "}
            determine which components must be quantified.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-3">4. Precursor Handling and System Boundaries</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Precursor handling tracks emissions embedded in input materials. System boundaries define which processes are included per{" "}
            <a href="https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202403215" target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2 hover:no-underline">
              Commission Delegated Regulation (EU) 2024/3215
            </a>
            , preventing double counting.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-3">5. Production Volume and Embedded Emissions</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Specific embedded emissions are determined from the attributed production process emissions divided by corresponding production quantity.
          </p>
          <div className="bg-surface border border-border rounded-lg p-4 font-mono text-sm text-muted">
            SE_good = (E_direct x AllocationShare + E_indirect x AllocationShare) / ProductionVolume
          </div>
          <p className="text-xs text-muted mt-3">AllocationShare must sum to exactly 1.00 (100%) across all manufactured outputs. Final rounding: ROUND_HALF_UP at the reporting stage.</p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-3">6. Carbon Price Paid Treatment</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            A carbon price paid in the country of origin may be recognised where rules permit. CBAMValid records the claimed amount and supporting evidence without guaranteeing regulatory acceptance.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-3">7. Calculation Trace, Rounding, and Sealing</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            The calculation trace records source inputs, formulas, allocation steps and rounding rules. Sealing creates an immutable report version with SHA-256 integrity hashes.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-3">8. Source Versioning and Corrections</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            Source versioning records which legal ruleset was active for a calculation. When data changes, a new report version is generated without overwriting the historical audit trail.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-bold mb-3">9. Independence and Limitations</h2>
          <p className="text-sm text-muted leading-relaxed mb-4">
            CBAMValid is an independent software service and is not an official European Commission or CBAM Registry service. The service does not issue an accredited verification opinion and does not guarantee regulatory acceptance.
          </p>
        </div>
        <div className="border-t border-border pt-8">
          <h2 className="text-xl font-bold mb-4">Regulatory Sources &amp; Official References</h2>
          <p className="text-sm text-muted leading-relaxed mb-5">
            All calculations and methodologies are based on the following official EU regulatory sources. CBAMValid is not an EU institution.
          </p>
          <ul className="space-y-3">
            {EU_CITATIONS.map((cite) => (
              <li key={cite.url} className="flex flex-col gap-0.5">
                <a href={cite.url} target="_blank" rel="noopener noreferrer" className="text-sm text-accent underline underline-offset-2 hover:no-underline font-medium">
                  {cite.name}
                </a>
                <span className="text-xs text-muted">{cite.ref}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
