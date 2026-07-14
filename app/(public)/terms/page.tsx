import { legalConfig } from "@/lib/legal-config";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/schema";

export const metadata = generateSeoMetadata("/terms");

export default function TermsPage() {
  const jsonLd = [
    generateBreadcrumbSchema([
      { name: "Home", item: "/" },
      { name: "Terms of Service", item: "/terms" }
    ])
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 font-sans text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="text-3xl font-serif font-black mb-6">Terms of Service</h1>
      <p className="text-sm text-muted mb-8">Last Updated: {legalConfig.lastUpdatedDate}</p>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-2">1. Introduction</h2>
          <p className="text-sm text-muted">
            These Terms of Service govern your use of CBAMValid, operated by {legalConfig.legalEntityName} ({legalConfig.registrationNumber ? `Reg: ${legalConfig.registrationNumber}` : ''}). By using our service, you agree to these terms.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">2. Product Scope & Account Requirements</h2>
          <p className="text-sm text-muted">
            CBAMValid provides software tools for compiling Carbon Border Adjustment Mechanism (CBAM) exporter evidence. You must provide accurate information when creating an account and generating reports. Our services are intended for business use.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">3. Credits and Delivery</h2>
          <p className="text-sm text-muted">
            Generation of sealed CBAM reports requires the purchase of digital credits (entitlements). One credit allows the generation of one sealed report. Delivery of the digital report is instantaneous upon expenditure of the credit.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">4. Disclaimers</h2>
          <p className="text-sm text-muted">
            <strong>No Guarantee of Authority Acceptance:</strong> CBAMValid relies on user input and regulatory-source versioning. We do not guarantee that your report will be accepted by the EU CBAM Registry or any official authority. <br />
            <strong>No Professional Advice:</strong> The information provided does not constitute legal, tax, or official EU advice. Users are responsible for their own inputs.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">5. Payments and Taxes</h2>
          <p className="text-sm text-muted">
            Payments are processed securely via our Merchant of Record, Paddle. Prices displayed are subject to applicable taxes, depending on your jurisdiction. 
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">6. Limitation of Liability & Governing Law</h2>
          <p className="text-sm text-muted">
            To the maximum extent permitted by applicable law, {legalConfig.legalEntityName} shall not be liable for direct, indirect, incidental, or consequential damages arising from the use of our reports. These terms shall be governed by the laws of {legalConfig.governingLaw}.
          </p>
        </div>
      </section>
    </div>
  );
}
