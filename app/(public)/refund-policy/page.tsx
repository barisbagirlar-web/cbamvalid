import Link from "next/link";
import { legalConfig } from "@/lib/legal-config";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/schema";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

export const metadata = generateSeoMetadata("/refund-policy");

export default function RefundPolicyPage() {
  const jsonLd = [
    generateBreadcrumbSchema([
      { name: "Home", item: "/" },
      { name: "Refund Policy", item: "/refund-policy" },
    ]),
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 font-sans text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="text-3xl font-serif font-black mb-6">Refund Policy</h1>
      <p className="text-sm text-muted mb-8">Last Updated: {legalConfig.lastUpdatedDate}</p>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-2">1. What you purchase</h2>
          <p className="text-sm text-muted">
            CBAMValid charges {CANONICAL_PRICING.priceFormatted} to unlock lock-and-download for one
            Working File (one operator, one installation, one reporting year). Drafting is free.
            Corrections and re-locks on the same paid Working File do not require a new payment. See{" "}
            <Link href="/terms#commercial-terms" className="underline">
              Terms §3
            </Link>{" "}
            and{" "}
            <Link href="/pricing#how-payment-works" className="underline">
              Pricing
            </Link>
            .
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">2. Digital goods after successful seal</h2>
          <p className="text-sm text-muted">
            By paying to unlock a Working File, you request immediate access to digital sealing. Under
            applicable consumer protection rules for digital content, withdrawal may be excluded once
            a successful sealed package has been delivered for that Working File.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">3. Unused paid unlock (no successful seal yet)</h2>
          <p className="text-sm text-muted">
            If you paid for a Working File and have not yet completed a successful sealed lock for that
            file, you may request a refund within 14 days of purchase. Contact{" "}
            {legalConfig.supportEmail} with your order reference and Working File ID.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">4. Failed deliveries and duplicate charges</h2>
          <p className="text-sm text-muted">
            If a confirmed technical error prevents delivery of a sealed package after payment, or if
            you were charged twice for the same Working File unlock, you are eligible for a full
            refund of the duplicate or failed charge. A blocked or failed seal attempt that did not
            complete delivery is not treated as a completed purchase of a sealed package. Checkout is
            bound to one Working File identifier; a second tab should reuse the open checkout rather
            than create a second charge.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">5. Chargeback after sealed download</h2>
          <p className="text-sm text-muted">
            Once a sealed package has been successfully delivered and made available for download,
            the digital good cannot be clawed back from recipients. Card disputes (chargebacks) after
            delivery are processed through Paddle as Merchant of Record. CBAMValid may contest
            abusive disputes using order, entitlement, seal-hash, and delivery evidence. A successful
            dispute does not create a right to continued software access or additional free remakes.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">6. Payment processing (Merchant of Record)</h2>
          <p className="text-sm text-muted">
            Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Refunds are processed through Paddle and typically take 3–5 business days to appear on your statement.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">7. Statutory rights</h2>
          <p className="text-sm text-muted">
            This policy does not restrict your statutory consumer rights under the laws of{" "}
            {legalConfig.governingLaw} or your local jurisdiction.
          </p>
        </div>
      </section>
    </div>
  );
}
