import Link from "next/link";
import styles from "./SoftwareProductHome.module.css";

const SOFTWARE_FEATURES = [
  {
    title: "Customer-controlled data workspace",
    text: "Business users enter and maintain their own installation, production, emissions and evidence data.",
  },
  {
    title: "Automated calculation engine",
    text: "The application runs deterministic calculations and repeatable validation rules from customer-entered data.",
  },
  {
    title: "Automated quality controls",
    text: "Missing fields, reconciliation differences and unsupported material inputs are surfaced before digital delivery.",
  },
  {
    title: "Automated digital delivery",
    text: "A successful lock generates downloadable PDF, JSON and XLSX files without manual document preparation.",
  },
  {
    title: "Evidence-linked audit trail",
    text: "Supporting evidence is linked to the relevant data and calculation records so reviewers can trace the basis of the dossier.",
  },
  {
    title: "Sealed version integrity",
    text: "Locked outputs preserve a versioned integrity record with hashes and seal metadata for consistent re-download and review.",
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
            <h1 className={styles.title} id="homepage-hero-title">
              CBAM Exporter
              <br />
              Evidence Dossier
            </h1>
            <p className={styles.lede}>
              Customer-entered emissions data, automated calculations, quality controls, and export-ready
              dossier files for independent review preparation.
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
                <span><strong>PDF · JSON · O3CI XLSX</strong><small>Export formats</small></span>
              </div>
              <div className={styles.outputCard}>
                <span className={styles.outputIcon}>♢</span>
                <span><strong>SHA-256 sealed</strong><small>Evidence integrity guaranteed</small></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head center">
            <span className="eyebrow">Software operation</span>
            <h2>Six automated functions, one digital product</h2>
            <p>The paid deliverable is generated by the application from customer-controlled inputs.</p>
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
