"use client";

import React from "react";
import Link from "next/link";
import { useClassReveal } from "@/components/marketing/MarketingUi";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import {
  STRUCTURE_REVIEW_OUTREACH_BODIES,
  STRUCTURE_REVIEW_PACKAGE_FIELDS,
  STRUCTURE_REVIEW_PUBLIC,
} from "@/lib/trust/verifier-structure-review";

export default function VerifierReviewPage() {
  useClassReveal();
  const sample = STRUCTURE_REVIEW_PUBLIC.sampleDocument;

  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "40px" }}>
        <div className="wrap">
          <div className="structure-hero-grid">
            <div>
              <span className="eyebrow">{STRUCTURE_REVIEW_PUBLIC.eyebrow}</span>
              <h1>
                {STRUCTURE_REVIEW_PUBLIC.headline}
                <br />
                <span className="serif-i">not a verification opinion</span>
              </h1>
              <p className="lede">{STRUCTURE_REVIEW_PUBLIC.lede}</p>
              <p className="structure-boundary-pill" role="note">
                {STRUCTURE_REVIEW_PUBLIC.boundary}
              </p>
              <div className="hero-ctas" style={{ marginTop: "22px" }}>
                <a className="btn btn-primary" href={sample.downloadHref} download>
                  Download SAMPLE report
                </a>
                <a className="btn btn-ghost" href={STRUCTURE_REVIEW_PUBLIC.briefHref} download>
                  Structure Review Brief
                </a>
                <Link className="btn btn-ghost" href={STRUCTURE_REVIEW_PUBLIC.sampleHref}>
                  Open sample dossier
                </Link>
              </div>
            </div>

            <figure className="structure-sample-frame reveal">
              <div className="structure-sample-meta">
                <span className="structure-sample-status">{sample.status}</span>
                <span className="mono">
                  {sample.issuerLabel} · {sample.reportNo}
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sample.previewHref}
                alt={`${sample.title} — ${sample.notice}`}
                width={1024}
                height={571}
              />
              <figcaption>
                {sample.notice} {STRUCTURE_REVIEW_PUBLIC.boundary}
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className="section tight">
        <div className="wrap">
          <div className="notice">
            <b>Legal boundary:</b> CBAMValid prepares operator dossiers. The Verifikon document above is
            published as a watermarked <b>SAMPLE</b> for structure-review illustration. It is not a
            valid certificate, not reasonable assurance, not EU approval, and not a CBAM Registry
            decision.
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow">Published SAMPLE</span>
            <h2>{sample.title}</h2>
            <p>
              Report No {sample.reportNo} · {sample.issuedOn} · Status {sample.status}. Footer on the
              document: “{sample.notice}”
            </p>
          </div>
          <div className="structure-sample-actions reveal">
            <a className="btn btn-navy" href={sample.downloadHref} download>
              Download PDF <span className="arr">→</span>
            </a>
            <a className="btn btn-ghost" href={sample.pngHref} download>
              Download PNG
            </a>
            <a className="btn btn-ghost" href={STRUCTURE_REVIEW_PUBLIC.specimenLetterHref} download>
              Target letter language (specimen)
            </a>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">What structure review covers</span>
            <h2>Package fields a verifier workflow needs</h2>
            <p>
              The brief maps the sealed Preparation Pack to the information set verification teams
              inspect before site work — so the conversation starts from structure, not spreadsheet
              archaeology.
            </p>
          </div>
          <div className="deliv-grid">
            {STRUCTURE_REVIEW_PACKAGE_FIELDS.map((field) => (
              <div key={field.id} className="deliv-card reveal">
                <span className="fmt">{field.id.toUpperCase()}</span>
                <h3>{field.title}</h3>
                <p>{field.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow">Target letter language</span>
            <h2>The one-page letter we ask bodies to sign</h2>
            <p>Exact boundary language. No accreditation claim. No assurance statement.</p>
          </div>
          <article className="structure-letter-frame reveal" aria-label="Target structure-review letter">
            <header className="structure-letter-head">
              <span className="structure-letter-mark">SR</span>
              <div>
                <p className="mono" style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.12em" }}>
                  STRUCTURE REVIEW LETTER · TARGET LANGUAGE
                </p>
                <h3 style={{ margin: "6px 0 0" }}>Independent verification body</h3>
              </div>
            </header>
            <blockquote className="structure-letter-body">
              <p>{STRUCTURE_REVIEW_PUBLIC.targetLetter}</p>
            </blockquote>
            <footer className="structure-letter-foot">
              <span>{STRUCTURE_REVIEW_PUBLIC.boundary}</span>
              <span className="mono">IR 2025/2621 · workflow fitness only</span>
            </footer>
          </article>
        </div>
      </section>

      <section className="section tight">
        <div className="wrap">
          <div className="section-head center reveal">
            <span className="eyebrow">Engagement panel</span>
            <h2>Bodies on the structure-review surface</h2>
            <p>
              Verifikon appears as the SAMPLE document issuer. Other names are outreach targets —
              not product endorsements unless a signed letter is separately published.
            </p>
          </div>
          <div className="structure-outreach-grid reveal">
            {STRUCTURE_REVIEW_OUTREACH_BODIES.map((body) => (
              <div key={body.name} className="structure-outreach-item">
                <strong>{body.name}</strong>
                <span>{body.role}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <AeoPageChrome
        path="/verifier-review"
        answerHeading="Structure review answers"
        answerLimit={2}
      />

      <section className="cta-band">
        <div className="wrap">
          <h2>
            Inspect the pack <span className="serif-i">before anyone reviews it</span>
          </h2>
          <p>
            Gate-free sample dossier · integrity verify · same structure your buyer or verifier will
            see.
          </p>
          <div className="hero-ctas" style={{ justifyContent: "center" }}>
            <Link className="btn btn-primary btn-lg" href="/sample-dossier">
              View sample dossier <span className="arr">→</span>
            </Link>
            <Link className="btn btn-ghost btn-lg" href="/register?next=/cases/new">
              Start a dossier
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
