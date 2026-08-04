import type { Metadata } from "next";
import Link from "next/link";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { legalConfig } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Product Classification | Self-Service B2B Software | CBAMValid",
  description:
    "Plain-language product classification for CBAMValid: self-service B2B software and automated digital delivery, not government, filing, consulting, certification or verification services.",
  alternates: { canonical: "/product-classification" },
};

const INCLUDED = [
  "Browser-based customer-controlled data entry and storage",
  "Deterministic server-side calculations",
  "Automated field, reconciliation and evidence-linking checks",
  "Automated PDF, JSON and XLSX generation",
  "Digital lock, integrity hashes and re-download",
  "Technical account, billing, privacy and security support",
] as const;

const EXCLUDED = [
  "Government services or public-authority representation",
  "Access to government officials or preferential authority treatment",
  "Registry filing, customs filing, permit applications or submissions",
  "Consulting, regulatory advisory or managed compliance",
  "Manual data preparation, evidence review or methodology selection",
  "Legal, tax or customs advice",
  "Accredited verification, certification, assurance, approval or registry acceptance",
] as const;

export default function ProductClassificationPage() {
  return (
    <main>
      <section className="pricing-wrap" aria-label="Product classification">
        <header className="pricing-hero">
          <p className="eyebrow">Commercial classification statement</p>
          <h1 className="pricing-title">Self-Service B2B Software</h1>
          <p className="pricing-lede">
            CBAMValid is a privately operated software application owned and operated by{" "}
            {legalConfig.legalEntityName}. It sells software access and automated digital delivery only.
            It does not provide government services, filing services, consulting services,
            certification, or independent verification opinions.
          </p>
        </header>

        <section className="pricing-grid" aria-label="Included and excluded scope">
          <div className="price-card featured">
            <span className="badge-pop">Included in the software product</span>
            <h3>Automated software functions</h3>
            <ul className="feat-list">
              {INCLUDED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="price-card">
            <h3>Not sold or provided</h3>
            <ul className="feat-list">
              {EXCLUDED.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="pricing-assurance" aria-label="Commercial facts">
          <div className="pricing-assurance-item">
            <p className="pricing-assurance-label">Product</p>
            <p className="pricing-assurance-text">Self-Service Emissions Data Software</p>
          </div>
          <div className="pricing-assurance-item">
            <p className="pricing-assurance-label">Price</p>
            <p className="pricing-assurance-text">
              {CANONICAL_PRICING.priceFormatted} one-time per working file at lock
            </p>
          </div>
          <div className="pricing-assurance-item">
            <p className="pricing-assurance-label">Delivery</p>
            <p className="pricing-assurance-text">Automated PDF, JSON and XLSX digital files</p>
          </div>
          <div className="pricing-assurance-item">
            <p className="pricing-assurance-label">Human services</p>
            <p className="pricing-assurance-text">Not included in the purchase</p>
          </div>
        </section>

        <section className="pricing-faq" aria-label="Classification details">
          <h2 className="pricing-faq-title">How the product operates</h2>
          <div className="pricing-faq-grid">
            <div className="pricing-faq-item">
              <h3>Who enters and controls the data?</h3>
              <p>
                The customer. CBAMValid personnel do not prepare, approve or submit customer emissions
                data as part of the paid product.
              </p>
            </div>
            <div className="pricing-faq-item">
              <h3>What happens after payment?</h3>
              <p>
                The software executes a server-side lock and automatically generates downloadable digital
                files from the customer-controlled working file.
              </p>
            </div>
            <div className="pricing-faq-item">
              <h3>Does CBAMValid submit to an authority?</h3>
              <p>
                No. Customers remain responsible for official filings, authority communications and any
                legally required independent verification.
              </p>
            </div>
            <div className="pricing-faq-item">
              <h3>Why are regulations referenced?</h3>
              <p>
                Published rules are used as calculation and documentation inputs inside the software. A
                software product can implement regulatory rules without becoming a government service.
              </p>
            </div>
          </div>
        </section>

        <div className="hero-ctas" style={{ justifyContent: "center", marginTop: "30px" }}>
          <Link className="btn btn-primary" href="/demo">
            View Software Demo
          </Link>
          <Link className="btn btn-navy" href="/pricing">
            Review Pricing
          </Link>
          <Link className="btn btn-ghost" href="/terms">
            Read Terms
          </Link>
        </div>
      </section>
    </main>
  );
}
