import React from "react";
import Link from "next/link";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { AuthorityRail } from "@/components/marketing/AuthorityRail";
import { PUBLIC_SAMPLE_DOSSIER } from "@/lib/sample/public-sample-dossier";
import SampleDossierViewer from "./SampleDossierViewer";

export default function SampleDossierPage() {
  const pdfHash = PUBLIC_SAMPLE_DOSSIER.primaryDocumentSha256;
  const verifyHref = `/verify?hash=${pdfHash}&try=sample`;

  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "40px" }}>
        <div className="wrap" style={{ textAlign: "center" }}>
          <AuthorityRail mode="compact" eyebrow="Authority · Sample is gate-free" />
          <span className="eyebrow">Public sample · Gate-free</span>
          <h1 style={{ maxWidth: "820px", marginLeft: "auto", marginRight: "auto" }}>
            Full sample dossier
            <br />
            <span className="serif-i">PDF · JSON · XLSX</span>
          </h1>
          <p className="lede" style={{ margin: "0 auto 22px" }}>
            A {PUBLIC_SAMPLE_DOSSIER.pageCount}-page Exporter Verification Preparation Pack built from
            fictional demonstration data. No email gate. No account required. Download every format
            directly.
          </p>
          <div className="hero-ctas" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <a className="btn btn-primary" href={PUBLIC_SAMPLE_DOSSIER.downloads.pdf} download>
              Download PDF ({PUBLIC_SAMPLE_DOSSIER.pageCount} pages)
            </a>
          </div>
          <p className="hero-secondary-link">
            Other formats: <a href={PUBLIC_SAMPLE_DOSSIER.downloads.json} download>JSON</a>
            {" · "}
            <a href={PUBLIC_SAMPLE_DOSSIER.downloads.xlsx} download>XLSX</a>
            {" · "}
            <Link href={verifyHref}>check the sample seal</Link>
          </p>
        </div>
      </section>

      <section className="section tight" style={{ paddingTop: "8px" }}>
        <div className="wrap">
          <div className="notice">
            <b>Important notice:</b> {PUBLIC_SAMPLE_DOSSIER.notice}
          </div>

          <div
            className="deliv-grid"
            style={{ marginBottom: "32px" }}
            aria-label="Direct sample downloads"
          >
            <div className="deliv-card">
              <span className="fmt">PDF · {PUBLIC_SAMPLE_DOSSIER.pageCount} pages</span>
              <h3>Sample dossier PDF</h3>
              <p className="mono" style={{ fontSize: "0.75rem", wordBreak: "break-all" }}>
                SHA-256 {pdfHash}
              </p>
              <a className="btn btn-primary" href={PUBLIC_SAMPLE_DOSSIER.downloads.pdf} download>
                Download PDF
              </a>
            </div>
            <div className="deliv-card">
              <span className="fmt">JSON · Canonical</span>
              <h3>Calculation trace JSON</h3>
              <p>Machine-readable sample calculation and verifier-model payload.</p>
              <a className="btn btn-ghost" href={PUBLIC_SAMPLE_DOSSIER.downloads.json} download>
                Download JSON
              </a>
            </div>
            <div className="deliv-card">
              <span className="fmt">XLSX · O3CI-mapped</span>
              <h3>Verifier workspace Excel</h3>
              <p>Field-mapped workbook for buyer and verifier navigation practice.</p>
              <a className="btn btn-ghost" href={PUBLIC_SAMPLE_DOSSIER.downloads.xlsx} download>
                Download XLSX
              </a>
            </div>
          </div>

          <SampleDossierViewer />
        </div>
      </section>

      <AeoPageChrome
        path="/sample-dossier"
        answerHeading="Sample dossier answers with evidence"
        answerLimit={2}
      />

      <section className="cta-band">
        <div className="wrap">
          <h2>
            Ready to build <span className="serif-i">yours?</span>
          </h2>
          <p>
            Draft free. Pay once to lock your own working file — same-file corrections included, no
            subscription.
          </p>
          <Link className="btn btn-primary btn-lg" href="/register?next=/cases/new">
            Start a Dossier <span className="arr">→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
