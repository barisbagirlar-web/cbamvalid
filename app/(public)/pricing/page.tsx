import React from "react";
import Link from "next/link";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

const INCLUDED = [
  "Unlimited free drafting before lock",
  "Customer-controlled data entry",
  "Deterministic emissions calculations",
  "Automated quality controls",
  "Customer-controlled evidence linking",
  "Automated digital PDF generation",
  "Automated digital JSON generation",
  "Automated digital XLSX generation",
  "Lock and download",
  "Same-file correction re-locks",
];

const PRODUCT_BOUNDARIES = [
  "The customer enters and controls all working-file data",
  "The application performs calculations and quality checks automatically",
  "Digital files are generated automatically after a successful lock",
  "The purchase does not bundle manual data preparation or human review",
  "Customers remain responsible for their data and downstream use of the outputs",
  "Technical support covers account, billing, security and software operation",
];

const ASSURANCES: { label: string; text: string }[] = [
  {
    label: "Product type",
    text: "Self-service B2B software with automated digital delivery.",
  },
  {
    label: "Billing",
    text: "One-time purchase. No subscription, no auto-renewal.",
  },
  {
    label: "Delivery",
    text: "PDF, JSON and XLSX are generated automatically after a successful lock.",
  },
  {
    label: "Hosting",
    text: "EU hosted, GDPR aligned, TLS in transit.",
  },
];

const FAQS: { question: string; answer: string }[] = [
  {
    question: "When am I charged?",
    answer:
      "Once, when you lock a working file. Drafting is free before lock. A paid unlock is used only after the software completes digital delivery — failed locks cost nothing.",
  },
  {
    question: "Is this a subscription?",
    answer: `No. The software purchase is a one-time ${CANONICAL_PRICING.currency} ${CANONICAL_PRICING.displayPrice} payment covering one working file — one operator, one installation and one reporting year. There is no renewal.`,
  },
  {
    question: "Can I evaluate before paying?",
    answer:
      "Yes. Drafts are free without limit: create cases, run the automated quality-control engine and review data gaps before buying anything.",
  },
  {
    question: "What exactly is delivered?",
    answer:
      "After a successful lock, the application generates downloadable PDF, JSON and XLSX files from the customer-controlled working file.",
  },
  {
    question: "Is manual preparation included?",
    answer:
      "No. The paid product is software access and automated digital delivery. Customers enter and control their own data.",
  },
];

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <main id="main">
      <section className="pricing-wrap" aria-label="Pricing">
        <header className="pricing-hero">
          <p className="eyebrow">Pricing — one self-service software product</p>
          <h1 className="pricing-title">Self-Service Emissions Data Software</h1>
          <p className="pricing-lede">
            Enter and control your own data, run deterministic calculations and automated quality
            controls, link your evidence, then <strong>pay once to lock your working file</strong> and
            download automated digital outputs.
          </p>
        </header>

        <section className="pricing-grid" aria-label="Self-Service Software product">
          <div className="price-card featured">
            <span className="badge-pop">One-time · Pay at lock</span>
            <h3>Working File Software Unlock</h3>
            <p className="sub">{CANONICAL_PRICING.priceFormatted} · one-time</p>
            <p className="sub">
              One working file covering one operator, one installation and one reporting year.
            </p>
            <ul className="feat-list">
              {INCLUDED.map((item) => (
                <li key={item}>
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
            <Link className="btn btn-primary" href="/register?next=/cases/new" prefetch={false}>
              Start Free Draft — Pay When You Lock <span className="arr">→</span>
            </Link>
            <p className="pricing-btn-note" style={{ marginTop: "10px" }}>
              VAT may apply at checkout · <Link href="/refund-policy">Refund policy</Link>
            </p>
          </div>

          <div className="price-card">
            <h3>Software purchase boundaries</h3>
            <p className="sub">Clear scope before checkout.</p>
            <ul className="feat-list">
              {PRODUCT_BOUNDARIES.map((item) => (
                <li key={item}>
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
            <Link className="btn btn-ghost" href="/product-classification">
              Review Product Classification
            </Link>
          </div>
        </section>

        <ul className="guarantee-row">
          <li>
            <CheckIcon />
            Draft free — no card until lock
          </li>
          <li>
            <CheckIcon />
            Same-file correction re-locks included
          </li>
          <li>
            <CheckIcon />
            Failed locks charge nothing
          </li>
        </ul>

        <section className="pricing-assurance" aria-label="Assurances">
          {ASSURANCES.map((item) => (
            <div className="pricing-assurance-item" key={item.label}>
              <p className="pricing-assurance-label">{item.label}</p>
              <p className="pricing-assurance-text">{item.text}</p>
            </div>
          ))}
        </section>

        <section className="pricing-faq" aria-label="Pricing questions" id="how-payment-works">
          <h2 className="pricing-faq-title">Pricing questions</h2>
          <div className="pricing-faq-grid">
            {FAQS.map((faq) => (
              <div className="pricing-faq-item" key={faq.question}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
