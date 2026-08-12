import Link from "next/link";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";

const SUBPROCESSORS = [
  {
    name: "Google Cloud / Firebase",
    role: "Hosting, authentication, Firestore, Cloud Storage, Cloud Functions / Cloud Run",
    region: "europe-west1 (primary application region)",
  },
  {
    name: "Paddle",
    role: "Payment processing and merchant of record for paid lock checkout",
    region: "Paddle processing regions per Paddle DPA",
  },
] as const;

export default function SecurityPage() {
  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "40px" }}>
        <div className="wrap" style={{ maxWidth: "820px" }}>
          <span className="eyebrow">R8 · Trust &amp; security surface</span>
          <h1>
            Security &amp; data protection
            <br />
            <span className="serif-i">facts only</span>
          </h1>
          <p className="lede">
            Hosting region, encryption, backups, deletion, and subprocessors — published without
            unverified certification claims. ISO 27001 / SOC 2 are not claimed here.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-primary" href="/security/dpa-draft.pdf" download>
              Download DPA draft (PDF)
            </a>
            <Link className="btn btn-ghost" href="/privacy">
              Privacy policy
            </Link>
            <Link className="btn btn-ghost" href="/pricing">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="deliv-grid">
            <div className="deliv-card">
              <span className="fmt">HOSTING</span>
              <h3>Primary region</h3>
              <p>
                Application runtime and Firebase project services are configured for{" "}
                <span className="mono">europe-west1</span> (EU).
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">IN TRANSIT</span>
              <h3>TLS</h3>
              <p>Public endpoints are served over HTTPS/TLS. Session cookies are HttpOnly.</p>
            </div>
            <div className="deliv-card">
              <span className="fmt">AT REST</span>
              <h3>Provider encryption</h3>
              <p>
                Firestore and Cloud Storage data use Google Cloud encryption at rest under the
                Firebase/Google Cloud platform defaults.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">BROWSER</span>
              <h3>Content Security Policy</h3>
              <p>
                Document responses use a per-request CSP nonce with{" "}
                <span className="mono">strict-dynamic</span>. Production{" "}
                <span className="mono">script-src</span> does not allow{" "}
                <span className="mono">unsafe-inline</span> or{" "}
                <span className="mono">unsafe-eval</span>. Local emulator hosts and
                Paddle sandbox CDNs are environment-gated and absent from production.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">AUTH</span>
              <h3>Session model</h3>
              <p>
                Firebase ID token → server <span className="mono">createSessionCookie()</span> →
                HttpOnly <span className="mono">__session</span> → server verification. Tenant and
                case ownership are enforced server-side.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">BACKUP</span>
              <h3>Platform continuity</h3>
              <p>
                Continuity relies on Google Cloud / Firebase managed durability for project data
                services. Sealed releases are treated as immutable objects once published.
              </p>
            </div>
            <div className="deliv-card">
              <span className="fmt">DELETION</span>
              <h3>Account &amp; data requests</h3>
              <p>
                Deletion and access requests: <span className="mono">privacy@cbamvalid.com</span> or{" "}
                <span className="mono">info@cbamvalid.com</span>. Sealed packages already shared with
                buyers may remain with the recipient under their retention duties.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Sub-processors</span>
            <h2>Current processing providers</h2>
            <p>Material infrastructure and payment subprocessors for the production service.</p>
          </div>
          <table className="ruleset-table">
            <thead>
              <tr>
                <th>Provider</th>
                <th>Role</th>
                <th>Region note</th>
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map((row) => (
                <tr key={row.name}>
                  <td>
                    <b>{row.name}</b>
                  </td>
                  <td>{row.role}</td>
                  <td>{row.region}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="notice" style={{ marginTop: "24px" }}>
            <b>Certification honesty:</b> This page does not claim ISO 27001, SOC 2, or equivalent
            certification. If a certificate is obtained later, it will be published with issuer,
            scope, and validity dates — never as “in progress.”
          </div>
        </div>
      </section>

      <AeoPageChrome path="/security" answerHeading="Security answers" answerLimit={2} />
    </main>
  );
}
