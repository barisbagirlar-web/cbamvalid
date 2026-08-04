import Link from "next/link";
import { legalConfig } from "@/lib/legal-config";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/schema";
import { COMMERCIAL_LEGAL_CLAUSES } from "@/lib/billing/case-commercial-contract";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

export const metadata = generateSeoMetadata("/terms");

export default function TermsPage() {
  const jsonLd = [
    generateBreadcrumbSchema([
      { name: "Home", item: "/" },
      { name: "Terms of Service", item: "/terms" },
    ]),
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
            These Terms of Service govern your use of CBAMValid, operated by {legalConfig.legalEntityName}
            {legalConfig.registrationNumber ? ` (Reg: ${legalConfig.registrationNumber})` : ""}. By
            using our service, you agree to these terms.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">2. Software Product Scope &amp; Account Requirements</h2>
          <p className="text-sm text-muted">
            CBAMValid is privately operated, self-service B2B software that provides automated digital
            functionality and automatically generated digital outputs. Customers enter and control their
            own data. The application performs deterministic calculations, automated quality controls,
            customer-controlled evidence linking and automated PDF, JSON and XLSX generation.
          </p>
          <p className="text-sm text-muted mt-3">
            The software can be used to organize Carbon Border Adjustment Mechanism (CBAM)-related
            exporter data and generate an operator-prepared digital package. Regulatory references and
            calculation rules embedded in the software are product inputs; they do not make CBAMValid a
            government service, public authority, filing agent, customs representative or accredited
            verifier.
          </p>
          <p className="text-sm text-muted mt-3">
            The purchase price applies exclusively to software access and automated digital delivery. It
            does not purchase or include government services, authority representation, government-official
            access, registry filing, customs filing, permit applications, submissions on a customer’s
            behalf, human consulting, advisory services, managed dossier preparation, manual evidence
            assessment, methodology recommendations, legal advice, tax advice, customs advice, accredited
            verification, certification, custom implementation, custom development or access to experts.
          </p>
          <p className="text-sm text-muted mt-3">
            Customers remain responsible for their data, evidence, methodology decisions, regulatory
            obligations, official submissions and engagement of any independent accredited verifier.
          </p>
        </div>

        <div id="commercial-terms">
          <h2 className="text-xl font-bold mb-2">3. Commercial Model — Pay at Lock</h2>
          <p className="text-sm text-muted mb-4">
            The following commercial rules are binding. A plain-language summary also appears on{" "}
            <Link href="/pricing#how-payment-works" className="underline">
              Pricing
            </Link>
            .
          </p>
          <ol className="list-decimal space-y-4 pl-5 text-sm text-muted">
            {COMMERCIAL_LEGAL_CLAUSES.map((clause) => (
              <li key={clause.title}>
                <strong className="text-foreground">{clause.title}.</strong> {clause.body}
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted mt-4">
            Current list price for one Working File unlock is {CANONICAL_PRICING.priceFormatted} unless
            a different amount is shown at checkout. Taxes may apply by jurisdiction.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">4. No Human or Government Services Included</h2>
          <p className="text-sm text-muted">
            CBAMValid personnel do not review, approve, correct, prepare, certify or validate customer
            emissions data as part of the purchased product. CBAMValid does not act for a customer before
            a government body, customs authority, registry or other public authority and does not file or
            submit customer information to those bodies.
          </p>
          <p className="text-sm text-muted mt-3">
            Customer support is limited to account, billing, security, privacy and technical operation
            of the software. Support does not review customer emissions data, approve evidence, prepare
            dossiers, recommend methodologies, interpret regulations for a customer, complete official
            forms, submit filings or issue verification or certification opinions.
          </p>
          <p className="text-sm text-muted mt-3">
            See the public{" "}
            <Link href="/product-classification" className="underline">
              Product Classification Statement
            </Link>{" "}
            for a plain-language summary of the included software functions and excluded services.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">5. Delivery</h2>
          <p className="text-sm text-muted">
            Digital delivery of a sealed package is completed after a successful server-side seal for a
            paid Working File. Immutable prior sealed versions remain available for re-download without
            an additional charge.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">6. Disclaimers</h2>
          <p className="text-sm text-muted">
            <strong>No Government or Authority Service:</strong> CBAMValid is not a government body,
            government contractor, filing service, customs representative or authority submission service.
            <br />
            <strong>No Guarantee of Authority Acceptance:</strong> CBAMValid relies on user input and
            regulatory-source versioning. We do not guarantee that your package will be accepted by the
            EU CBAM Registry or any official authority.
            <br />
            <strong>No Professional Advice:</strong> The information provided does not constitute legal,
            tax, customs, regulatory or official EU advice. Users are responsible for their own inputs and
            decisions.
            <br />
            <strong>No Accredited Verification:</strong> Purchase does not create an accredited
            verification opinion, reasonable assurance, customs approval, certification or registry
            acceptance.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">7. Payments and Taxes</h2>
          <p className="text-sm text-muted">
            Payments are processed securely via our Merchant of Record, Paddle. Prices displayed are
            subject to applicable taxes, depending on your jurisdiction. Refunds are governed by the{" "}
            <Link href="/refund-policy" className="underline">
              Refund Policy
            </Link>
            .
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">8. Limitation of Liability &amp; Governing Law</h2>
          <p className="text-sm text-muted">
            To the maximum extent permitted by applicable law, {legalConfig.legalEntityName} shall not
            be liable for direct, indirect, incidental, or consequential damages arising from the use of
            our packages. These terms shall be governed by the laws of {legalConfig.governingLaw}.
          </p>
        </div>
      </section>
    </div>
  );
}
