import { legalConfig } from "@/lib/legal-config";

export const metadata = {
  title: "Privacy Notice | CBAMValid",
  description: "Privacy Notice explaining data collection and handling by CBAMValid.",
  robots: { index: true, follow: true }
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 font-sans text-foreground">
      <h1 className="text-3xl font-serif font-black mb-6">Privacy Notice</h1>
      <p className="text-sm text-muted mb-8">Last Updated: {legalConfig.lastUpdatedDate}</p>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-2">1. Controller Identity</h2>
          <p className="text-sm text-muted">
            The data controller responsible for processing personal data is: <br />
            <strong>{legalConfig.legalEntityName}</strong> (Trading as {legalConfig.tradingName}) <br />
            {legalConfig.registeredAddress}, {legalConfig.country} <br />
            Contact: {legalConfig.privacyContactEmail}
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">2. Personal Data Collected</h2>
          <p className="text-sm text-muted">
            We collect the following personal data:
          </p>
          <ul className="list-disc list-inside text-sm text-muted mt-2 space-y-1">
            <li>Identity and Contact Data (e.g. name, email address)</li>
            <li>Technical Data (e.g. IP address, browser type, via standard analytics)</li>
            <li>Authentication Data (via Firebase Authentication)</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">3. Firebase & Third Party Subprocessors</h2>
          <p className="text-sm text-muted">
            We utilize Firebase Authentication, Firestore, and Storage for secure user management and data persistence. We also use App Check/reCAPTCHA for security and Paddle for payment processing. Your data may be transferred to and processed by these sub-processors internationally, safeguarded by standard contractual clauses where appropriate.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">4. Purposes and Legal Bases</h2>
          <p className="text-sm text-muted">
            We process your personal data primarily to perform our contract with you (providing the CBAM calculation and documentation service), to comply with legal obligations, and on the basis of our legitimate interests (such as improving the service and ensuring security).
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">5. Data Retention & Security</h2>
          <p className="text-sm text-muted">
            We retain your data as long as your account is active, or as necessary to fulfill legal obligations and resolve disputes. We employ industry-standard security measures including encryption at rest and in transit.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">6. Your Rights</h2>
          <p className="text-sm text-muted">
            Subject to applicable law ({legalConfig.governingLaw}), you have the right to access, correct, delete, restrict, or object to our processing of your data, and the right to data portability. You also have the right to lodge a complaint with your local supervisory authority.
          </p>
          <p className="text-sm text-muted mt-2">
            To exercise these rights, including account closure, please use the Enterprise Account settings page or contact us at {legalConfig.privacyContactEmail}. Note that certain commercial transaction records are retained under legal accounting exceptions.
          </p>
        </div>
      </section>
    </div>
  );
}
