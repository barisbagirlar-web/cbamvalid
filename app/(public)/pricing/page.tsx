"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import {
  CASE_COMMERCIAL,
  COMMERCIAL_PUBLIC_FAQ,
  COMMERCIAL_TOPIC_CARDS,
} from "@/lib/billing/case-commercial-contract";
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
          <span className="eyebrow">Pay at lock · No subscription</span>
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
          <p className="authority-lead-empathy" style={{ margin: "0 auto 18px", maxWidth: "62ch", color: "var(--ink-2)" }}>
            <strong>Why this pricing helps you:</strong> {CASE_COMMERCIAL.valuePitch}
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
                ? " one-time · per working file at lock"
                : " approximate · billing settles in USD at checkout"}
            </span>
          </p>
          <div className="hero-ctas" style={{ justifyContent: "center", gap: "12px", display: "flex", flexWrap: "wrap" }}>
            <Link className="btn btn-primary" href="/register?next=/cases/new">
              Start a free working file <span className="arr">→</span>
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

      <section className="section tight" style={{ paddingTop: "8px" }} id="how-payment-works">
        <div className="wrap">
          <div className="section-head center reveal" style={{ marginBottom: "28px" }}>
            <span className="eyebrow">Commercial rules — plain language</span>
            <h2>Six rules every buyer should see before paying</h2>
            <p className="lede" style={{ margin: "12px auto 0", maxWidth: "62ch" }}>
              These rules are the same ones in our Terms. We state them here so pricing is never a surprise at seal time.
            </p>
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
        </div>
      </section>

      <section className="section tight" style={{ paddingTop: "24px" }}>
        <div className="wrap">
          <div className="pricing-grid">
            <div className="price-card featured">
              <span className="badge-pop">Pay at lock · One-time</span>
              <h3>{CANONICAL_PRICING.packName}</h3>
              <p className="sub">{CANONICAL_PRICING.description}</p>
              <p className="price-fig">
                <span>{priceLabel}</span>{" "}
                <small>
                  {currency === "usd"
                    ? "per working file · no subscription"
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
                  <CheckIcon />Pay once to lock — corrections on same file included
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
              <Link className="btn btn-primary" href="/register?next=/cases/new">
                Start free — pay when you lock <span className="arr">→</span>
              </Link>
            </div>
            <div className="price-card free">
              <h3>Free drafts</h3>
              <p className="sub">Prepare before you pay</p>
              <p className="price-fig">
                $0 <small>no card required</small>
              </p>
              <ul className="feat-list">
                <li>
                  <CheckIcon />Create and edit working files
                </li>
                <li>
                  <CheckIcon />Real-time quality controls
                </li>
                <li>
                  <CheckIcon />Evidence and data gap review
                </li>
                <li>
                  <CheckIcon />Lock requires payment for that file
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
              Secure card payment via Paddle
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M12 2 20 5.5v6c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-6L12 2Z" />
              </svg>
              <Link href="/refund-policy">Refund policy published</Link>
            </li>
            <li>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M12 2 20 5.5v6c0 5-3.5 8.5-8 10.5-4.5-2-8-5.5-8-10.5v-6L12 2Z" />
              </svg>
              <Link href="/terms">Same rules in Terms of Service</Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }} id="pricing-faq">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow">Pricing FAQ</span>
            <h2>What you buy — and what you do not</h2>
          </div>
          <div className="faq-list">
            {COMMERCIAL_PUBLIC_FAQ.map((item) => (
              <FaqItem key={item.question} question={item.question} answer={item.answer} />
            ))}
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
