import Link from "next/link";
import { AeoPageChrome } from "@/components/seo/AnswerEvidenceSection";
import { AuthorityRail } from "@/components/marketing/AuthorityRail";
import {
  getRulesetSourceRows,
  listPublishedRulesets,
  RULESET_PUBLIC_NOTICE,
} from "@/lib/cbam/registry/public-ruleset-catalog";

export default function RulesetsPage() {
  const rulesets = listPublishedRulesets();

  return (
    <main id="main">
      <section className="hero" style={{ paddingBottom: "40px" }}>
        <div className="wrap" style={{ maxWidth: "820px" }}>
          <AuthorityRail mode="compact" eyebrow="Authority · Version-pinned rules" />
          <span className="eyebrow">R6 · Authority surface</span>
          <h1>
            Published rulesets
            <br />
            <span className="serif-i">named, dated, pinned</span>
          </h1>
          <p className="lede">{RULESET_PUBLIC_NOTICE}</p>
          <div className="hero-ctas">
            <Link className="btn btn-primary" href="/methodology">
              Methodology &amp; sources
            </Link>
            <Link className="btn btn-ghost" href="/sample-dossier">
              Sample dossier
            </Link>
            <Link className="btn btn-ghost" href="/verify">
              Verify a seal
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          {rulesets.map((ruleset) => {
            const sources = getRulesetSourceRows(ruleset);
            return (
              <article
                key={`${ruleset.version}-${ruleset.period}`}
                className="deliv-card"
                style={{ marginBottom: "28px", maxWidth: "920px" }}
              >
                <span className="fmt">
                  {ruleset.supersessionState} · {ruleset.period}
                </span>
                <h2 style={{ marginTop: "10px" }}>{ruleset.name}</h2>
                <p className="mono" style={{ fontSize: "0.82rem", color: "var(--muted)" }}>
                  version {ruleset.version} · activeFrom {ruleset.activeFrom}
                  {ruleset.activeUntil ? ` · activeUntil ${ruleset.activeUntil}` : ""} · registry{" "}
                  {ruleset.sourceRegistryVersion}
                </p>
                <p style={{ marginTop: "12px" }}>
                  Source hash: <span className="mono">{ruleset.sourceHash}</span>
                </p>
                <p>
                  Materiality rate:{" "}
                  {ruleset.verificationMaterialityRate === null
                    ? "not applicable (non-sealable / transitional)"
                    : `${(ruleset.verificationMaterialityRate * 100).toFixed(0)}%`}
                  {" · "}
                  Verification template required: {ruleset.verificationTemplateRequired ? "yes" : "no"}
                </p>
                <table className="ruleset-table" style={{ marginTop: "18px" }}>
                  <thead>
                    <tr>
                      <th>Source ID</th>
                      <th>Status</th>
                      <th>Title</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sources.map((source) => (
                      <tr key={source.id}>
                        <td className="mono">{source.id}</td>
                        <td>{source.legalStatus}</td>
                        <td>
                          {source.eliUri ? (
                            <a href={source.eliUri} target="_blank" rel="noreferrer">
                              {source.title}
                            </a>
                          ) : (
                            source.title
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section tight" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="notice">
            <b>Independence boundary:</b> Publishing rulesets does not make CBAMValid an accredited
            verifier. Sealed packages remain operator-prepared. Where verification is legally
            required, an independent accredited verifier must still perform assurance.
          </div>
        </div>
      </section>

      <AeoPageChrome path="/rulesets" answerHeading="Ruleset answers" answerLimit={2} />
    </main>
  );
}
