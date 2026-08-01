import React from "react";
import Link from "next/link";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

/** Comparison ledger row: one feature across the Free and Pack columns. */
type LedgerRow = {
  label: string;
  detail?: string;
  free: string;
  pack: string;
  /** Styling of the pack cell value. */
  packKind?: "yes" | "na" | "text" | "plain";
  /** Mark the free cell value as a "not available" dash. */
  freeIsNa?: boolean;
};

const LEDGER_SECTIONS: { title: string; rows: LedgerRow[] }[] = [
  {
    title: "Preparation",
    rows: [
      {
        label: "Cases & drafts",
        detail: "Create, complete and re-run without charge",
        free: "UNLIMITED",
        pack: "UNLIMITED",
        packKind: "yes",
      },
      {
        label: "Real-time QC engine",
        detail: "Field-level checks as you enter data",
        free: "INCLUDED",
        pack: "INCLUDED",
        packKind: "yes",
      },
      {
        label: "Data gap analysis",
        detail: "See what is missing before you commit",
        free: "INCLUDED",
        pack: "INCLUDED",
        packKind: "yes",
      },
    ],
  },
  {
    title: "Sealing & evidence",
    rows: [
      {
        label: "Emissions calculations & validation",
        detail: "Against published rulesets",
        free: "—",
        freeIsNa: true,
        pack: "INCLUDED",
        packKind: "yes",
      },
      {
        label: "Sealed releases",
        detail: "Consumed only on a successful seal",
        free: "—",
        freeIsNa: true,
        pack: CANONICAL_PRICING.correctionPolicy,
        packKind: "text",
      },
      {
        label: "SHA-256 evidence chain",
        detail: "Every sealed dossier checkable at /verify",
        free: "—",
        freeIsNa: true,
        pack: "INCLUDED",
        packKind: "yes",
      },
      {
        label: "O3CI structured export",
        detail: "Field-mapped data for downstream systems",
        free: "—",
        freeIsNa: true,
        pack: "INCLUDED",
        packKind: "yes",
      },
    ],
  },
  {
    title: "Scope",
    rows: [
      {
        label: "Installations",
        free: "—",
        freeIsNa: true,
        pack: String(CANONICAL_PRICING.includedInstallations),
        packKind: "plain",
      },
      {
        label: "Reporting years",
        free: "—",
        freeIsNa: true,
        pack: String(CANONICAL_PRICING.includedReportingYears),
        packKind: "plain",
      },
    ],
  },
];

const ASSURANCES: { label: string; text: string }[] = [
  {
    label: "Billing",
    text: "One-time purchase. No subscription, no auto-renewal.",
  },
  {
    label: "Risk",
    text: "Releases consumed only on a successful seal.",
  },
  {
    label: "Hosting",
    text: "EU hosted, GDPR aligned, TLS in transit.",
  },
  {
    label: "Verification",
    text: "Every sealed dossier is checkable at /verify.",
  },
];

const FAQS: { question: string; answer: string }[] = [
  {
    question: "When am I charged?",
    answer:
      "Once, when you lock a working file. A sealed release is consumed only after a dossier seals successfully. Failed seals cost nothing.",
  },
  {
    question: "Is this a subscription?",
    answer:
      "No. The Preparation Pack is a one-time purchase covering one installation and one reporting year. There is no renewal.",
  },
  {
    question: "Can I evaluate before paying?",
    answer:
      "Yes. Drafts are free without limit: create cases, run the real-time QC engine and review data gaps before buying anything.",
  },
  {
    question: "Does a sealed dossier replace accredited verification?",
    answer:
      "No. CBAMValid prepares evidence-linked dossiers for verification. Where verification is legally required, emissions data must still be independently verified.",
  },
];

function Value({
  value,
  kind,
  isNa,
}: {
  value: string;
  kind?: "yes" | "na" | "text" | "plain";
  isNa?: boolean;
}) {
  if (isNa) {
    return <span className="pricing-val na">{value}</span>;
  }
  if (kind === "text") {
    return <span className="pricing-val text">{value}</span>;
  }
  const cls = kind === "yes" ? "pricing-val yes" : "pricing-val";
  return <span className={cls}>{value}</span>;
}

export default function PricingPage() {
  return (
    <main>
      <section className="pricing-wrap" aria-label="Pricing">
        <header className="pricing-hero">
          <p className="eyebrow">Pricing — one pack, no subscription</p>
          <h1 className="pricing-title">Prepare your CBAM case before you pay</h1>
          <p className="pricing-lede">
            Create, complete and review your case without charge.{" "}
            <strong>Pay once when you lock your file</strong> — releases are
            consumed only after a dossier is successfully sealed.
          </p>
        </header>

        {/* Comparison ledger: Free Drafts vs Preparation Pack */}
        <section className="pricing-compare" aria-label="Plan comparison">
          {/* Column heads */}
          <div className="pricing-col label pricing-head">
            <span className="pricing-kicker">Compare plans</span>
          </div>
          <div className="pricing-col free pricing-head">
            <p className="pricing-tag">Evaluate first</p>
            <h2 className="pricing-name">Free Drafts</h2>
            <p className="pricing-price">$0</p>
            <p className="pricing-meta">no card required</p>
          </div>
          <div className="pricing-col pack pricing-head pricing-pack-head">
            <p className="pricing-tag">Prepared for accredited verification</p>
            <h2 className="pricing-name">{CANONICAL_PRICING.packName}</h2>
            <p className="pricing-price">{CANONICAL_PRICING.priceFormatted}</p>
            <p className="pricing-meta">
              one-time · {CANONICAL_PRICING.includedInstallations} installation ·{" "}
              {CANONICAL_PRICING.includedReportingYears} reporting year
            </p>
          </div>

          {LEDGER_SECTIONS.map((section) => (
            <React.Fragment key={section.title}>
              <div className="pricing-section-row">{section.title}</div>
              {section.rows.map((row) => (
                <React.Fragment key={row.label}>
                  <div className="pricing-col label">
                    <span className="pricing-fname">{row.label}</span>
                    {row.detail ? (
                      <span className="pricing-fdetail">{row.detail}</span>
                    ) : null}
                  </div>
                  <div className="pricing-col free">
                    <Value value={row.free} isNa={row.freeIsNa} />
                  </div>
                  <div className="pricing-col pack">
                    <Value value={row.pack} kind={row.packKind} />
                  </div>
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}

          {/* CTA row */}
          <div className="pricing-col label pricing-cta">
            <p className="pricing-seal">
              <span className="pricing-seal-mark" aria-hidden="true"></span>
              <Link href="/verify">Sealed · verifiable at /verify</Link>
            </p>
          </div>
          <div className="pricing-col free pricing-cta">
            <Link className="pricing-btn pricing-btn-ghost" href="/register?next=/cases/new" prefetch={false}>
              Start for free
            </Link>
          </div>
          <div className="pricing-col pack pricing-cta">
            <Link className="pricing-btn pricing-btn-primary" href="/register?next=/cases/new" prefetch={false}>
              Start free — pay when you lock
            </Link>
            <p className="pricing-btn-note">
              VAT may apply at checkout ·{" "}
              <Link href="/refund-policy">Refund policy</Link>
            </p>
          </div>
        </section>

        {/* Assurance strip */}
        <section className="pricing-assurance" aria-label="Assurances">
          {ASSURANCES.map((item) => (
            <div className="pricing-assurance-item" key={item.label}>
              <p className="pricing-assurance-label">{item.label}</p>
              <p className="pricing-assurance-text">{item.text}</p>
            </div>
          ))}
        </section>

        {/* FAQ */}
        <section className="pricing-faq" aria-label="Pricing questions">
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
