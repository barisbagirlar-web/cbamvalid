"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { FaqItem, useClassReveal } from "@/components/marketing/MarketingUi";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="m4 12.5 5 5L20 6.5" />
    </svg>
  );
}

export default function PricingPage() {
  const [currency, setCurrency] = useState<"usd" | "eur">("usd");
  useClassReveal();

  const priceLabel =
    currency === "usd" ? CANONICAL_PRICING.priceFormatted : CANONICAL_PRICING.eurApproxFormatted;

  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "32px" }}>
        <div className="wrap" style={{ textAlign: "center" }}>
          <span className="eyebrow">One-time pack · No subscription</span>
          <h1>
            Exporter Verification
            <br />
            <span className="serif-i">Preparation Pack</span>
          </h1>
          <p className="lede" style={{ margin: "0 auto 14px" }}>
            {CANONICAL_PRICING.valueSummary}
          </p>
          <p className="aeo-lead" style={{ margin: "0 auto 18px" }}>
            <strong>Direct answer:</strong>{" "}
            <span className="speakable-answer">
              USD 249 is a one-time Exporter Verification Preparation Pack: unlimited drafts and five
              successful sealed releases for one operator, one installation, and one reporting year.
              Drafting is free. The card is charged at checkout — not while you edit drafts.
            </span>
          </p>
          <p className="authority-lead-empathy" style={{ margin: "0 auto 18px", maxWidth: "62ch", color: "var(--ink-2)" }}>
            <strong>The pressure you are under:</strong> EU buyers ask for defendable actuals. You need
            correction room (five seals), not a disposable export — and not an open-ended subscription
            while you finish evidence work.
          </p>
          <p className="lede" style={{ margin: "0 auto 22px", fontSize: "1rem", opacity: 0.9 }}>
            {CANONICAL_PRICING.paymentFlowSummary}
          </p>
          <p className="price-line" style={{ display: "inline-block", textAlign: "left", margin: "0 auto 18px" }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: "2.4rem", fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.02em" }}>
              {priceLabel}
            </span>
            <span>
              {currency === "usd"
                ? " one-time · Exporter Verification Preparation Pack"
                : " approximate · billing settles in USD at checkout"}
            </span>
          </p>
          <Link className="btn btn-ghost" href="/sample-dossier">
            View Sample Dossier Before Buying
          </Link>
          <div>
            <div className="currency-toggle" role="group" aria-label="Currency">
              <button
                type="button"
                className={currency === "usd" ? "on" : ""}
                onClick={() => setCurrency("usd")}
              >
                USD $
              </button>
              <button
                type="button"
                className={currency === "eur" ? "on" : ""}
                onClick={() => setCurrency("eur")}
              >
                EUR €
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section tight" style={{ paddingTop: "8px" }}>
        <div className="wrap">
          <div className="section-head center reveal" style={{ marginBottom: "28px" }}>
            <span className="eyebrow">How payment works</span>
            <h2>Clear flow from draft to sealed release</h2>
          </div>
          <div className="timeline" style={{ marginBottom: "40px" }}>
            <div className="tl-step reveal">
              <p className="step-no">1</p>
              <h3>Draft free</h3>
              <p>Build and edit your case with unlimited drafts. No card required.</p>
            </div>
            <div className="tl-step reveal">
              <p className="step-no">2</p>
              <h3>Buy the pack</h3>
              <p>
                Pay {CANONICAL_PRICING.priceFormatted} once at checkout. Your card is charged when you buy the pack — not when you click seal.
              </p>
            </div>
            <div className="tl-step reveal">
              <p className="step-no">3</p>
              <h3>Lock the scope</h3>
              <p>
                The pack covers one operator, one installation, and one reporting year. That working file stays scoped to that unit.
              </p>
            </div>
            <div className="tl-step reveal">
              <p className="step-no">4</p>
              <h3>Seal up to five times</h3>
              <p>
                Each successful sealed release uses one of five included releases. Failed seals use none. Prior sealed versions stay immutable.
              </p>
            </div>
            <div className="tl-step reveal">
              <p className="step-no">5</p>
              <h3>Re-download free</h3>
              <p>Download the same sealed package again at any time. Re-download does not use a release.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section tight" style={{ paddingTop: "24px" }}>
        <div className="wrap">
          <div className="pricing-grid">
            <div className="price-card featured">
              <span className="badge-pop">Scoped pack · One-time</span>
              <h3>{CANONICAL_PRICING.packName}</h3>
              <p className="sub">{CANONICAL_PRICING.description}</p>
              <p className="price-fig">
                <span>{priceLabel}</span>{" "}
                <small>
                  {currency === "usd"
                    ? "per pack · no subscription"
                    : "Approximate EUR figure; billing settles in USD at checkout."}
                </small>
              </p>
              <ul className="feat-list">
                <li>
                  <CheckIcon />1 legal operator / exporter
                </li>
                <li>
                  <CheckIcon />1 production installation
                </li>
                <li>
                  <CheckIcon />1 reporting year
                </li>
                <li>
                  <CheckIcon />Unlimited drafts on that working file
                </li>
                <li>
                  <CheckIcon />
                  {CANONICAL_PRICING.includedSealedReleases} successful sealed releases
                </li>
                <li>
                  <CheckIcon />Evidence-linked calculations and QC checks
                </li>
                <li>
                  <CheckIcon />Sealed PDF, JSON, and O3CI field-mapped export
                </li>
                <li>
                  <CheckIcon />Immutable sealed versions + free re-download
                </li>
              </ul>
              <Link className="btn btn-primary" href="/credits/buy">
                Get the Preparation Pack <span className="arr">→</span>
              </Link>
            </div>
            <div className="price-card free">
              <h3>Free drafts</h3>
              <p className="sub">Prepare before you buy</p>
              <p className="price-fig">
                $0 <small>no card required</small>
              </p>
              <ul className="feat-list">
                <li>
                  <CheckIcon />Create and edit draft cases
                </li>
                <li>
                  <CheckIcon />Real-time quality controls
                </li>
                <li>
                  <CheckIcon />Evidence and data gap review
                </li>
                <li>
                  <CheckIcon />Sealing and final download require a pack
                </li>
              </ul>
              <Link className="btn btn-ghost" href="/register?next=/cases/new">
                Start for Free
              </Link>
            </div>
          </div>

          <ul className="guarantee-row">
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M12 2 20 5.5v6c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-6L12 2Z" />
              </svg>
              Secure card payment
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M12 2 20 5.5v6c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-6L12 2Z" />
              </svg>
              Refund policy published
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M12 2 20 5.5v6c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-6L12 2Z" />
              </svg>
              GDPR compliant · EU hosted
            </li>
          </ul>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow">Pricing FAQ</span>
            <h2>What you buy — and what you do not</h2>
          </div>
          <div className="faq-list">
            <FaqItem
              question="When is my card charged?"
              answer={`Your card is charged when you buy the ${CANONICAL_PRICING.packName} at checkout (${CANONICAL_PRICING.priceFormatted}). Drafting and editing are free. Sealing uses a release from the pack you already bought; it does not charge your card again.`}
            />
            <FaqItem
              question="What exactly does USD 249 include?"
              answer="One locked working file for one legal operator, one installation, and one reporting year; unlimited drafts on that file; and five successful sealed releases. It is a verifier-preparation dossier pack — not an Excel-only export and not a subscription."
            />
            <FaqItem
              question="What does “5 sealed releases” mean?"
              answer="You can seal and issue the final package up to five times for the same scoped case — for corrections after review — without buying another pack. Each successful seal uses one release. A blocked or failed seal uses none. Older sealed versions stay immutable."
            />
            <FaqItem
              question="Can I use one pack for another factory or another year?"
              answer="No. One pack is scoped to one operator, one installation, and one reporting year. Another installation or reporting year needs another pack."
            />
            <FaqItem
              question="Is this an official EU verification or customs approval?"
              answer="No. CBAMValid prepares an operator dossier for independent accredited verification. It does not issue an accredited verification opinion, customs approval, registry acceptance, or EU approval."
            />
            <FaqItem
              question="Do you offer refunds?"
              answer="Yes — our refund policy is published in the site footer and applies before a dossier is sealed."
            />
            <FaqItem
              question="Can I pay in EUR?"
              answer="Displayed EUR figures are approximate. Billing settles in USD at checkout; your card issuer handles conversion at its own rate."
            />
          </div>
        </div>
      </section>

      <AeoPageChrome
        path="/pricing"
        answerHeading="Pricing answers with evidence — not marketing fluff"
        answerLimit={3}
      />
    </main>
  );
}
