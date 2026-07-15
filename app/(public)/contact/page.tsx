import { legalConfig } from "@/lib/legal-config";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { generateBreadcrumbSchema } from "@/lib/seo/schema";

export const metadata = generateSeoMetadata("/contact");

export default function ContactPage() {
  const jsonLd = [
    generateBreadcrumbSchema([
      { name: "Home", item: "/" },
      { name: "Contact Us", item: "/contact" }
    ])
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 font-sans text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <h1 className="text-3xl font-serif font-black mb-6">Contact Us</h1>
      
      <section className="space-y-6">
        <p className="text-sm text-muted">
          Our team is available to assist you with technical, billing, and general inquiries. We aim to respond to all support requests within 24-48 business hours.
        </p>

        <div className="bg-surface border border-border p-6 rounded-md shadow-sm">
          <h2 className="text-xl font-bold mb-4">Support & Billing</h2>
          <p className="text-sm text-muted mb-2">For technical assistance, report generation issues, or Paddle payment inquiries:</p>
          <a href={`mailto:${legalConfig.supportEmail}`} className="text-accent hover:underline font-mono">{legalConfig.supportEmail}</a>
        </div>

        <div className="bg-surface border border-border p-6 rounded-md shadow-sm">
          <h2 className="text-xl font-bold mb-4">Legal & Privacy</h2>
          <p className="text-sm text-muted mb-2">For data subject requests, GDPR inquiries, or legal concerns:</p>
          <ul className="space-y-2 text-sm">
            <li><strong>Legal:</strong> <a href={`mailto:${legalConfig.legalEmail}`} className="text-accent hover:underline">{legalConfig.legalEmail}</a></li>
            <li><strong>Privacy:</strong> <a href={`mailto:${legalConfig.privacyEmail}`} className="text-accent hover:underline">{legalConfig.privacyEmail}</a></li>
          </ul>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <h2 className="text-lg font-bold mb-2">Company Information</h2>
          <p className="text-sm text-muted font-mono leading-relaxed">
            {legalConfig.legalEntityName} <br />
            {legalConfig.tradingName && `Trading as ${legalConfig.tradingName}`} <br />
            {legalConfig.registeredAddress} <br />
            {legalConfig.country} <br />
            {legalConfig.registrationNumber && `Registration: ${legalConfig.registrationNumber}`} <br />
            {legalConfig.taxId && `VAT/Tax ID: ${legalConfig.taxId}`}
          </p>
        </div>
      </section>
    </div>
  );
}
