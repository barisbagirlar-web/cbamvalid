import { legalConfig } from "@/lib/legal-config";

export const metadata = {
  title: "Legal Notice | CBAMValid",
  description: "Legal Notice and Company Information.",
  robots: { index: true, follow: true }
};

export default function LegalNoticePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 font-sans text-foreground">
      <h1 className="text-3xl font-serif font-black mb-6">Legal Notice</h1>
      
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-2">Company Information</h2>
          <p className="text-sm text-muted font-mono leading-relaxed">
            {legalConfig.legalEntityName} <br />
            {legalConfig.tradingName && `Trading as ${legalConfig.tradingName}`} <br />
            {legalConfig.registeredAddress} <br />
            {legalConfig.country} <br />
            {legalConfig.registrationNumber && `Registration Number: ${legalConfig.registrationNumber}`} <br />
            {legalConfig.vatIdentifier && `VAT Identifier: ${legalConfig.vatIdentifier}`}
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">Contact</h2>
          <p className="text-sm text-muted">
            For support and general inquiries: <a href={`mailto:${legalConfig.supportEmail}`} className="text-accent hover:underline">{legalConfig.supportEmail}</a> <br />
            For legal inquiries: <a href={`mailto:${legalConfig.legalContactEmail}`} className="text-accent hover:underline">{legalConfig.legalContactEmail}</a>
          </p>
        </div>

        <div className="p-4 bg-accent-soft text-accent text-sm rounded-md border border-accent/20">
          <strong>Independence Notice:</strong> CBAMValid is an independent software service and is not an official European Commission or CBAM Registry service.
        </div>
      </section>
    </div>
  );
}
