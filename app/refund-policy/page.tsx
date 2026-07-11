import { legalConfig } from "@/lib/legal-config";

export const metadata = {
  title: "Refund Policy | CBAMValid",
  description: "Refund policy for CBAMValid digital credits and reports.",
  robots: { index: true, follow: true }
};

export default function RefundPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 font-sans text-foreground">
      <h1 className="text-3xl font-serif font-black mb-6">Refund Policy</h1>
      <p className="text-sm text-muted mb-8">Last Updated: {legalConfig.lastUpdatedDate}</p>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-2">1. Digital Goods Exemption</h2>
          <p className="text-sm text-muted">
            By purchasing a CBAMValid entitlement (digital credit), you agree to the immediate delivery of the digital service. Under applicable consumer protection laws, the right of withdrawal is excluded for digital content once the service has been fully performed (i.e. the report has been generated). 
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">2. Unused Credits</h2>
          <p className="text-sm text-muted">
            If you have purchased an entitlement but have not yet generated a sealed report (the credit is unused), you may request a refund within 14 days of purchase. Please contact us at {legalConfig.supportEmail} with your order reference.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">3. Failed Deliveries and Duplicates</h2>
          <p className="text-sm text-muted">
            If a technical error prevents the generation or delivery of your report, or if you were charged twice for the same transaction, you are eligible for a full refund. 
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">4. Payment Processing (Merchant of Record)</h2>
          <p className="text-sm text-muted">
            Our order process is conducted by our online reseller Paddle.com. Paddle.com is the Merchant of Record for all our orders. Refunds are processed through Paddle and typically take 3-5 business days to appear on your statement.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">5. Statutory Rights</h2>
          <p className="text-sm text-muted">
            This policy does not restrict your statutory consumer rights under the laws of {legalConfig.governingLaw} or your local jurisdiction.
          </p>
        </div>
      </section>
    </div>
  );
}
