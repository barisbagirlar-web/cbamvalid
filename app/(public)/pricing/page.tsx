"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface FaqItemProps {
  question: string;
  answer: string;
}

function FaqItem({ question, answer }: FaqItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`faq-item ${isOpen ? "open" : ""}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="faq-q"
        aria-expanded={isOpen}
      >
        {question}
        <span className="chev">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </button>
      <div className="faq-a" style={{ maxHeight: isOpen ? "200px" : "0px" }}>
        <p>{answer}</p>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const [currency, setCurrency] = useState<"usd" | "eur">("usd");

  useEffect(() => {
    const revealEls = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window && revealEls.length) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.12 });
      revealEls.forEach((el) => io.observe(el));
    } else {
      revealEls.forEach((el) => el.classList.add('in'));
    }
  }, []);

  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "32px" }}>
        <div className="wrap" style={{ textAlign: "center" }}>
          <span className="eyebrow">Simple, One-Time Pricing</span>
          <h1>Prepare your CBAM case<br /><span className="serif-i">before you pay</span></h1>
          <p className="lede" style={{ margin: "0 auto 22px" }}>
            Create, complete and review your case without charge. Releases are consumed only after a dossier is successfully sealed.
          </p>
          <Link className="btn btn-ghost" href="/sample-dossier">View Sample Dossier Before Buying</Link>
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

      <section className="section tight" style={{ paddingTop: "24px" }}>
        <div className="wrap">
          <div className="pricing-grid">
            <div className="price-card featured reveal">
              <span className="badge-pop">One-time payment</span>
              <h3>Exporter Verification Preparation Pack</h3>
              <p className="sub">Prepared for independent accredited-verification</p>
              <p className="price-fig">
                <span>{currency === "usd" ? "$149" : "≈ €139"}</span>{" "}
                <small>
                  {currency === "usd"
                    ? "per pack · no subscription"
                    : "Approximate EUR figure; billing settles in USD at checkout."}
                </small>
              </p>
              <ul className="feat-list">
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  1 installation included
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  1 reporting year included
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  5 sealed releases included
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  Emissions calculations and validation
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  Unlimited drafts
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  O3CI field-mapped structured data export
                </li>
              </ul>
              <Link className="btn btn-primary" href="/credits/buy">Get the Preparation Pack <span className="arr">→</span></Link>
            </div>
            <div className="price-card free reveal">
              <h3>Free Drafts</h3>
              <p className="sub">Prepare and review without cost</p>
              <p className="price-fig">$0 <small>forever</small></p>
              <ul className="feat-list">
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  Create unlimited cases
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  Real-time QC engine
                </li>
                <li>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                    <path d="m4 12.5 5 5L20 6.5" />
                  </svg>
                  Data gap analysis
                </li>
              </ul>
              <Link className="btn btn-ghost" href="/register?next=/cases/new">Start for Free</Link>
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
            <h2>No surprises at checkout</h2>
          </div>
          <div className="faq-list">
            <FaqItem
              question="When exactly is my card charged?"
              answer="Only when you seal a dossier. Drafting, editing and reviewing your case is always free — releases are consumed only after a successful seal."
            />
            <FaqItem
              question="What does “5 sealed releases” mean?"
              answer="Each pack lets you seal the dossier up to five times — so you can correct data and re-issue the final package without buying again, within the same installation and reporting year."
            />
            <FaqItem
              question="Do you offer refunds?"
              answer="Yes — our refund policy is published in the footer of every page and applies before a dossier is sealed."
            />
            <FaqItem
              question="Can I pay in EUR?"
              answer="Displayed EUR figures are approximate. Billing settles in USD at checkout; your card issuer handles conversion at its own rate."
            />
          </div>
        </div>
      </section>
    </main>
  );
}
