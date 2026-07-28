"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CANONICAL_PRICING, PRICING_TIERS } from "@/lib/billing/pricing-config";
import {
  CASE_COMMERCIAL,
  COMMERCIAL_PUBLIC_FAQ,
  COMMERCIAL_TOPIC_CARDS,
} from "@/lib/billing/case-commercial-contract";
import { FaqItem, useClassReveal } from "@/components/marketing/MarketingUi";
import { RoiCalculatorPanel } from "@/components/marketing/RoiCalculatorPanel";
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
          <span className="eyebrow">Four tiers · Pay at lock · H4 public pricing</span>
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
            <span className="speakable-answer">{CASE_COMMERCIAL.speakableAnswer}</span>
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
                ? " Single Pack · one-time · per working file at lock"
                : " approximate · billing settles in USD at checkout"}
            </span>
          </p>
          <div className="hero-ctas" style={{ justifyContent: "center", gap: "12px", display: "flex", flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/register?next=/cases/new">
              Start a free working file <span className="arr">→</span>
            </Link>
            <Link className="btn btn-ghost" href="/demo">
              Book a demo
            </Link>
            <Link className="btn btn-ghost" href="/sample-dossier">
              View Sample Dossier
            </Link>
          </div>
          <div>
            <div className="currency-toggle" role="group" aria-label="Currency">
              <button type="button" className={currency === "usd" ? "on" : ""} onClick={() => setCurrency("usd")}>
                USD $
              </button>
              <button type="button" className={currency === "eur" ? "on" : ""} onClick={() => setCurrency("eur")}>
                EUR €
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section tight" style={{ paddingTop: "8px" }} id="tiers">
        <div className="wrap">
          <div className="section-head center reveal" style={{ marginBottom: "28px" }}>
            <span className="eyebrow">Public price architecture</span>
            <h2>Draft · Single Pack · Annual · Enterprise</h2>
            <p className="lede" style={{ margin: "12px auto 0", maxWidth: "62ch" }}>
              Only Enterprise is contact-sales. Every other tier is published here (H4).
            </p>
          </div>
          <div className="pricing-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
            {PRICING_TIERS.map((tier) => {
              const shownPrice =
                tier.id === "single-pack"
                  ? priceLabel
                  : tier.priceLabel;
              return (
                <div className={`price-card ${tier.highlight ? "featured" : ""}`} key={tier.id}>
                  {tier.highlight ? <span className="badge-pop">Most used · Pay at lock</span> : null}
                  <h3>{tier.name}</h3>
                  <p className="sub">{tier.scope}</p>
                  <p className="price-fig">
                    <span>{shownPrice}</span> <small>{tier.cadence}</small>
                  </p>
                  <ul className="feat-list">
                    {tier.features.map((f) => (
                      <li key={f}>
                        <CheckIcon />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {tier.contactSales ? (
                    <Link className="btn btn-navy" href={tier.ctaHref}>
                      {tier.ctaLabel} <span className="arr">→</span>
                    </Link>
                  ) : (
                    <Link className={`btn ${tier.highlight ? "btn-primary" : "btn-ghost"}`} href={tier.ctaHref}>
                      {tier.ctaLabel} <span className="arr">→</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
          <p className="notice" style={{ marginTop: "24px" }}>
            <b>Grandfathering:</b> {CANONICAL_PRICING.grandfatherNote}
          </p>
        </div>
      </section>

      <section className="section" id="roi" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head center reveal" style={{ marginBottom: "28px" }}>
            <span className="eyebrow">Why actual data pays for itself</span>
            <h2>ROI exposure calculator</h2>
          </div>
          <RoiCalculatorPanel />
        </div>
      </section>

      <section className="section tight" style={{ paddingTop: "8px" }} id="how-payment-works">
        <div className="wrap">
          <div className="section-head center reveal" style={{ marginBottom: "28px" }}>
            <span className="eyebrow">Commercial rules — plain language</span>
            <h2>Six rules every buyer should see before paying</h2>
          </div>
          <div className="timeline" style={{ marginBottom: "40px" }}>
            {COMMERCIAL_TOPIC_CARDS.map((card, index) => (
              <div className="tl-step reveal" key={card.id}>
                <p className="step-no">{index + 1}</p>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            ))}
          </div>
          <ul className="guarantee-row">
            <li>Secure card payment via Paddle</li>
            <li>
              <Link href="/refund-policy">Refund policy published</Link>
            </li>
            <li>
              <Link href="/terms">Same rules in Terms of Service</Link>
            </li>
            <li>
              <Link href="/security">Security &amp; DPA draft</Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }} id="pricing-faq">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow">FAQ</span>
            <h2>Pricing questions with evidence boundaries</h2>
          </div>
          <div style={{ maxWidth: "820px", margin: "0 auto" }}>
            {COMMERCIAL_PUBLIC_FAQ.map((item) => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
          </div>
        </div>
      </section>

      <AeoPageChrome path="/pricing" answerHeading="Pricing answers" answerLimit={3} />
    </main>
  );
}
