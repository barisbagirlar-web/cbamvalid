import Link from "next/link";
import styles from "./SoftwareProductHome.module.css";

const SOFTWARE_FEATURES = [
  {
    title: "Customer-controlled data workspace",
    text: "Business users enter and maintain their own installation, production, emissions and evidence data.",
  },
  {
    title: "Deterministic calculation engine",
    text: "The application runs replayable embedded-emissions calculations from the same case snapshot, engine version and pinned ruleset.",
  },
  {
    title: "Fail-closed quality controls",
    text: "Missing inputs, reconciliation differences, unit issues and unsupported material data are surfaced before sealing.",
  },
  {
    title: "Evidence-linked audit trail",
    text: "Supporting evidence is linked to the relevant data and calculation records so reviewers can trace the basis of the dossier.",
  },
  {
    title: "Versioned EU rulesets",
    text: "Each sealed release records the ruleset version used so the methodology basis does not silently change after sealing.",
  },
  {
    title: "Sealed digital delivery",
    text: "Locked outputs preserve a timestamped integrity record with SHA-256 hashes for controlled handover, re-download and review.",
  },
] as const;

const SEALED_OUTPUTS = [
  {
    title: "Verification readiness dossier",
    text: "CBAMValid Verification Readiness & Evidence Assurance Dossier PDF — the primary human-review document for the sealed working file.",
  },
  {
    title: "Calculation and emissions reports",
    text: "Embedded Emissions Calculation Annex and Operator Emissions Report PDFs expose the calculation result and supporting calculation structure.",
  },
  {
    title: "Evidence and field mapping",
    text: "Evidence Register, Field-to-Evidence Matrix and O3CI Field Mapping provide structured links between source evidence, dossier fields and handover data.",
  },
  {
    title: "Verifier workspace",
    text: "Verifier Workspace XLSX, methodology decisions and monitoring-plan outputs organize the working file for buyer or independent verifier review.",
  },
  {
    title: "Calculation reproducibility",
    text: "Calculation Trace JSON and Calculation Graph JSON preserve machine-readable calculation lineage for replay and technical review.",
  },
  {
    title: "Integrity and supporting evidence",
    text: "Data Integrity Manifest, manifest signature and Supporting_Evidence references preserve file identity, hashes and the sealed handover structure.",
  },
] as const;

type HeroMetric = {
  label: string;
  value: string;
  unit?: string;
  good?: boolean;
  warn?: boolean;
};

const METRICS: readonly HeroMetric[] = [
  { label: "Embedded Emissions", value: "412.60", unit: "tCO₂e" },
  { label: "Evidence Coverage", value: "16 / 16" },
  { label: "QC Blockers", value: "0", good: true },
  { label: "Warnings", value: "2", warn: true },
];

const CHECKS = [
  "Calculation trace",
  "Supporting evidence",
  "CN code mapping",
  "Integrity manifest",
] as const;

export default function SoftwareProductHome() {
  return (
    <main id="main">
      <section className={styles.hero} aria-labelledby="homepage-hero-title">
        <div className={`wrap ${styles.grid}`}>
          <div className={styles.copy}>
            <span className={styles.kicker}>EU Regulatory Method Alignment</span>
            <p className={styles.saasLabel}>B2B SaaS · Automated digital delivery</p>
            <h1 className={styles.title} id="homepage-hero-title">
              CBAM Exporter
              <br />
              Evidence Dossier
            </h1>
            <p className={styles.lede}>
              Customer-entered data drives evidence-linked CBAM operator dossiers: deterministic
              embedded-emissions calculations, fail-closed quality controls, versioned rulesets and sealed
              multi-file outputs for buyer and independent review preparation.
            </p>
            <p className={styles.classification}>
              <strong>Product classification:</strong> privately operated self-service B2B software with
              customer-controlled data and automated digital delivery.
            </p>

            <div className={styles.ctas}>
              <Link className={styles.primary} href="/register?next=/cases/new" prefetch={false}>
                Start Free Draft
              </Link>
              <Link className={styles.secondary} href="/sample-dossier">
                View Sample Dossier
              </Link>
            </div>

            <div className={styles.trustRow} aria-label="Product trust signals">
              <span className={styles.trustItem}><span className={styles.trustIcon}>✓</span>EU Hosted</span>
              <span className={styles.trustItem}><span className={styles.trustIcon}>•</span>Versioned EU Rulesets</span>
              <span className={styles.trustItem}><span className={styles.trustIcon}>↗</span>Evidence-linked</span>
              <span className={styles.trustItem}><span className={styles.trustIcon}>⌁</span>Pay only at lock</span>
            </div>
          </div>

          <div className={styles.visual} aria-label="CBAMValid evidence dossier readiness example">
            <div className={styles.dashboard}>
              <div className={styles.dashboardTop}>
                <span className={styles.dots} aria-hidden="true">
                  {Array.from({ length: 9 }).map((_, index) => <span key={index} />)}
                </span>
                <span className={styles.dashBrand}>CBAMValid</span>
                <span className={styles.readiness}>
                  <span>Case Readiness</span>
                  <strong>86%</strong>
                  <span className={styles.ring} aria-hidden="true" />
                </span>
              </div>

              <div className={styles.dashboardBody}>
                <div className={styles.caseHead}>
                  <div>
                    <h2 className={styles.caseTitle}>Arcelor Example / 2026</h2>
                    <p className={styles.caseSub}>Installation 01</p>
                  </div>
                  <div className={styles.verifyBadge}>
                    <span className={styles.checkDot}>✓</span>
                    Ready for independent verification
                  </div>
                </div>

                <div className={styles.metrics}>
                  {METRICS.map((metric) => (
                    <div className={`${styles.metric} ${metric.good ? styles.metricGood : ""}`} key={metric.label}>
                      <span className={styles.metricLabel}>{metric.label}</span>
                      <span className={`${styles.metricValue} ${metric.warn ? styles.warn : ""}`}>
                        {metric.value}{metric.unit ? <small>{metric.unit}</small> : null}
                      </span>
                    </div>
                  ))}
                </div>

                <div className={styles.evidenceBox}>
                  <div className={styles.evidenceTitleRow}>
                    <span>Evidence Complete</span><strong>100%</strong>
                  </div>
                  <div className={styles.progress}><span /></div>
                  <div className={styles.checks}>
                    {CHECKS.map((item) => (
                      <span className={styles.checkItem} key={item}>
                        <span className={styles.checkDot}>✓</span>{item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={styles.sealBar}>
                  <span className={styles.shield}>✓</span>
                  READY TO SEAL
                </div>
              </div>
            </div>

            <div className={styles.detachedCards} aria-label="Export and integrity outputs">
              <div className={styles.outputCard}>
                <span className={styles.outputIcon}>▧</span>
                <span><strong>Reports · XLSX · JSON · CSV</strong><small>Structured sealed package</small></span>
              </div>
              <div className={styles.outputCard}>
                <span className={styles.outputIcon}>♢</span>
                <span><strong>SHA-256 sealed</strong><small>Tamper-evident integrity record</small></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Software operation</span>
            <h2>Six controls from case data to sealed handover</h2>
            <p>The application turns customer-controlled inputs into a reproducible, evidence-linked preparation package without CBAMValid staff preparing or approving the customer file.</p>
          </div>
          <div className="deliv-grid">
            {SOFTWARE_FEATURES.map((feature) => (
              <div className="deliv-card" key={feature.title}>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Sealed package outputs</span>
            <h2>What you receive when the working file is locked</h2>
            <p>The deliverable is more than a single PDF. The sealed verifier-preparation package combines human-review reports, structured registers, calculation lineage, verifier workspace files, evidence references and integrity controls.</p>
          </div>
          <div className="deliv-grid">
            {SEALED_OUTPUTS.map((output) => (
              <div className="deliv-card" key={output.title}>
                <h3>{output.title}</h3>
                <p>{output.text}</p>
              </div>
            ))}
          </div>
          <p style={{ maxWidth: "980px", margin: "28px auto 0", textAlign: "center" }}>
            Built for buyer and independent review preparation. CBAMValid does not issue an accredited
            verification opinion, customs approval, EU approval or CBAM Registry acceptance.
          </p>
          <div className="hero-ctas" style={{ marginTop: "28px", justifyContent: "center" }}>
            <Link className="btn btn-navy" href="/sample-dossier">Inspect Sample Outputs</Link>
            <Link className="btn btn-ghost" href="/product">Review Full Product Capabilities</Link>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Transparent product scope</span>
            <h2>Software access, automated processing and digital files</h2>
            <p>Product capabilities, pricing, delivery rules and legal boundaries are published before checkout so buyers can assess the software without contacting a sales representative.</p>
          </div>
          <div className="hero-ctas" style={{ marginTop: "28px" }}>
            <Link className="btn btn-navy" href="/product">Product Capabilities</Link>
            <Link className="btn btn-ghost" href="/pricing">Pricing and Delivery</Link>
            <Link className="btn btn-ghost" href="/terms">Terms of Service</Link>
            <Link className="btn btn-ghost" href="/refund-policy">Refund Policy</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
