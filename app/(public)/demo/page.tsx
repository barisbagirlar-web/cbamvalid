import type { Metadata } from "next";
import Link from "next/link";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";

export const metadata: Metadata = generateSeoMetadata("/demo");

const DEMO_STEPS = [
  "Enter installation and production data",
  "Add goods, CN codes and reporting-period information",
  "Run deterministic emissions calculations",
  "Link customer-controlled evidence",
  "Review automated quality-control results",
  "Generate the digital PDF, JSON and XLSX package",
];

export default function DemoPage() {
  return (
    <>
      <JsonLdForRoute path="/demo" />
      <main id="main">
        <section className="hero" style={{ paddingBottom: "40px" }}>
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <span className="eyebrow">Self-Service Product Demo</span>
            <h1>See CBAMValid software in action</h1>
            <p className="lede">
              Explore how the CBAMValid software collects customer-controlled data, runs deterministic
              CBAM calculations, flags any open requirements, links evidence and
              generates downloadable digital outputs.
            </p>
            <div className="hero-ctas">
              <Link className="btn btn-primary" href="/register?next=/cases/new">
                Start Free Draft
              </Link>
              <Link className="btn btn-ghost" href="/sample-dossier">
                View Sample Dossier
              </Link>
              <Link className="btn btn-ghost" href="/pricing">
                See Software Pricing
              </Link>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="wrap" style={{ maxWidth: "820px" }}>
            <h2>What you can do in the demo</h2>
            <ol className="demo-steps">
              {DEMO_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <p>
              Everything above works without speaking to a person. You can register, open a draft case and
              explore the software directly.
            </p>
          </div>
        </section>

        <section className="section" style={{ background: "var(--paper-2)" }}>
          <div className="wrap" style={{ maxWidth: "720px" }}>
            <h2>Boundary</h2>
            <p>
              CBAMValid is self-service software. The {`USD 449`} purchase unlocks automated software
              functionality for one working file. It does not include consulting, advisory services,
              manual dossier preparation, evidence assessment, methodology recommendations or a
              verification opinion.
            </p>
          </div>
        </section>

        <AeoPageChrome path="/demo" answerHeading="Demo answers" answerLimit={2} />
      </main>
    </>
  );
}
