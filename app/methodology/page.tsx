export const metadata = {
  title: "Methodology & Regulatory Sources | CBAMValid",
  description: "Methodology and official regulatory sources used by CBAMValid.",
  robots: { index: true, follow: true }
};

export default function MethodologyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 font-sans text-foreground">
      <h1 className="text-3xl font-serif font-black mb-6">Methodology & Regulatory Sources</h1>
      
      <section className="space-y-6">
        <p className="text-sm text-muted leading-relaxed">
          CBAMValid utilizes a deterministic calculation engine based on the official methodologies published by the European Commission. We maintain a strict index of regulatory sources to ensure transparency and traceability for every computed value.
        </p>

        <div>
          <h2 className="text-xl font-bold mb-2">1. Official Sources and Default Values</h2>
          <ul className="list-disc list-inside text-sm text-muted space-y-2">
            <li><strong>Implementing Regulation (EU) 2023/1773:</strong> Rules for the reporting of embedded emissions during the transitional period.</li>
            <li><strong>Default Values for the Transitional Period:</strong> As published by the European Commission (latest update: 2024), used strictly when actual verified data is unavailable or selected by the user.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">2. Calculation Limitations</h2>
          <p className="text-sm text-muted leading-relaxed">
            While our platform accurately compiles the data provided and applies the documented formulas for direct, indirect, and precursor emissions, <strong>we do not independently verify the physical measurements</strong> or the accuracy of the input data submitted by users. The responsibility for the factual correctness of the input data remains with the exporting facility and the declarant.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">3. Update and Correction Policy</h2>
          <p className="text-sm text-muted leading-relaxed">
            Our sector-specific configurations and default emission factors are updated within 14 days of any official publication by the EU Commission. Should an error in the calculation engine be identified, a correction notice will be published and affected users will be notified to regenerate their reports without additional entitlement costs.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">4. Audit Trace</h2>
          <p className="text-sm text-muted leading-relaxed">
            Every generated XML and PDF report includes a complete calculation trace. This trace maps the final embedded emissions figure back to the specific inputs and the exact regulatory formula applied, providing clear evidence for your EU buyer or independent auditor.
          </p>
        </div>
      </section>
    </div>
  );
}
