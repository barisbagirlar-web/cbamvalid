import { legalConfig } from "@/lib/legal-config";

export const metadata = {
  title: "Cookie Policy | CBAMValid",
  description: "Cookie policy for CBAMValid.",
  robots: { index: true, follow: true }
};

export default function CookiePolicyPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12 font-sans text-foreground">
      <h1 className="text-3xl font-serif font-black mb-6">Cookie Policy</h1>
      <p className="text-sm text-muted mb-8">Last Updated: {legalConfig.lastUpdatedDate}</p>
      
      <section className="space-y-6">
        <p className="text-sm text-muted">
          Our website uses cookies and similar technologies to ensure the proper functioning of the service, to secure your account, and to provide the best possible user experience.
        </p>

        <div>
          <h2 className="text-xl font-bold mb-2">1. Essential Cookies</h2>
          <p className="text-sm text-muted mb-2">
            These cookies are strictly necessary to provide you with services available through our website and to use some of its features, such as access to secure areas.
          </p>
          <ul className="list-disc list-inside text-sm text-muted space-y-1">
            <li><strong>Firebase Authentication:</strong> Used to maintain your session and secure your account.</li>
            <li><strong>App Check / reCAPTCHA:</strong> Used to prevent automated abuse and secure our endpoints.</li>
            <li><strong>Paddle Checkout:</strong> Used by our payment provider to process secure transactions.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">2. Analytics & Tracking</h2>
          <p className="text-sm text-muted">
            We currently do not use non-essential marketing or tracking cookies without your explicit consent. If we introduce such technologies, we will provide a consent banner allowing you to accept or reject them, in accordance with applicable laws.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-2">3. Managing Cookies</h2>
          <p className="text-sm text-muted">
            You can set or amend your web browser controls to accept or refuse cookies. If you choose to reject essential cookies, you may still use our website, but your access to some functionality and areas (such as logging into the dashboard) will be severely restricted.
          </p>
        </div>
      </section>
    </div>
  );
}
