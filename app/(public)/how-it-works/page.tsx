"use client";

import React from "react";
import Link from "next/link";
import { useClassReveal } from "@/components/marketing/MarketingUi";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { CASE_COMMERCIAL, COMMERCIAL_TOPIC_CARDS } from "@/lib/billing/case-commercial-contract";
import { WORKFLOW_STEPS_PLAIN } from "@/lib/product/customer-language";

export default function Page() {
  useClassReveal();

  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "48px" }}>
        <div className="wrap" style={{ textAlign: "center" }}>
          <span className="eyebrow">The Complete Workflow</span>
          <h1 style={{ maxWidth: "820px", marginLeft: "auto", marginRight: "auto" }}>
            From raw plant data to a sealed package — without email chaos
          </h1>
          <p className="lede" style={{ margin: "0 auto" }}>
            One factory + one year = one working file. Enter production and emissions data, link
            evidence, clear blockers, then pay once to lock and download. Same file: correct and
            re-lock as needed.
          </p>
          <p className="aeo-lead" style={{ margin: "18px auto 0" }}>
            <strong>Direct answer:</strong>{" "}
            <span className="speakable-answer">{CASE_COMMERCIAL.speakableAnswer}</span>
          </p>
        </div>
      </section>

      <section className="section tight" id="payment-rules">
        <div className="wrap">
          <div className="section-head center reveal" style={{ marginBottom: "28px" }}>
            <span className="eyebrow">Payment — before you start</span>
            <h2>How money works in this workflow</h2>
          </div>
          <div className="method-grid">
            {COMMERCIAL_TOPIC_CARDS.map((card) => (
              <div className="method-card reveal" key={card.id}>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            ))}
          </div>
          <p style={{ textAlign: "center", marginTop: "28px" }}>
            <Link href="/pricing#how-payment-works">Full pricing rules</Link>
            {" · "}
            <Link href="/terms">Terms of Service</Link>
            {" · "}
            <Link href="/refund-policy">Refund Policy</Link>
          </p>
        </div>
      </section>

      <section className="section tight">
        <div className="wrap">
          <div className="section-head center reveal" style={{ marginBottom: "28px" }}>
            <span className="eyebrow">Eight plain steps</span>
            <h2>What you do inside the working file</h2>
          </div>
          <div className="vsteps">
            {WORKFLOW_STEPS_PLAIN.map((step) => (
              <div className="vstep reveal" key={step.num}>
                <div className="n">{step.num}</div>
                <div className="body">
                  <h3>{step.title}</h3>
                  <p>
                    {step.desc}
                    {step.num === 8
                      ? ` ${CASE_COMMERCIAL.customerOneLiner}`
                      : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "56px" }}>
            <Link className="btn btn-primary btn-lg" href="/register?next=/cases/new">
              Create your first working file — Free <span className="arr">→</span>
            </Link>
          </div>
        </div>
      </section>

      <AeoPageChrome path="/how-it-works" answerHeading="Workflow answers with evidence" answerLimit={2} />
    </main>
  );
}
