import { legalConfig } from "@/lib/legal-config";

import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/schema";

export const metadata = generateSeoMetadata("/privacy");

export default function PrivacyPage() {
  const jsonLd = [
    generateBreadcrumbSchema([
      { name: "Home", item: "/" },
      { name: "Privacy Notice", item: "/privacy" }
    ])
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 font-sans text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="text-3xl font-serif font-black mb-6">Privacy Notice</h1>
      <p className="text-sm text-muted mb-8">Last Updated: {legalConfig.lastUpdatedDate}</p>

      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-2">1. Controller Identity</h2>
          <p className="text-sm text-muted">
            The data controller responsible for processing personal data is: <br />
            <strong>{legalConfig.legalEntityName}</strong> (Trading as {legalConfig.tradingName})
            <br />
            {legalConfig.identityPublication.lines.map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
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
          <h2 className="text-xl font-bold mb-2">3. Firebase &amp; Third Party Subprocessors</h2>
          <p className="text-sm text-muted">
            Material subprocessors that may process personal data for the production service are
            listed on the{" "}
            <a className="text-accent" href="/security">
              Security &amp; data protection
            </a>{" "}
            page (GDPR Art. 28 inventory). That list currently covers Google Cloud / Firebase
            (including Cloud Logging and Authentication email delivery), Google App Check /
            reCAPTCHA, Google Analytics 4 when consent is granted, and Paddle (including Paddle
            Retain / ProfitWell where active). We do not currently engage a separate email service
            provider or a separate error-monitoring product such as Sentry. International transfers
            are safeguarded by standard contractual clauses where appropriate.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">4. Purposes and Legal Bases</h2>
          <p className="text-sm text-muted">
            We process your personal data primarily to perform our contract with you by providing access to the self-service software, storing customer-controlled working files, and generating automated digital outputs; to comply with legal obligations; and for legitimate interests such as improving the software and ensuring security.
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
            Subject to applicable law in {legalConfig.governingLaw}, you have the right to access, correct, delete, restrict, or object to our processing of your data, and the right to data portability. You also have the right to lodge a complaint with your local supervisory authority.
          </p>
          <p className="text-sm text-muted mt-2">
            To exercise these rights, including account closure, please use the Account settings page or contact us at {legalConfig.privacyContactEmail}. Note that certain commercial transaction records are retained under legal accounting exceptions.
          </p>
        </div>
      </section>
    </div>
  );
}
