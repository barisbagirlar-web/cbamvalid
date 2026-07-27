import Link from "next/link";
import { getAuthorityChain } from "@/lib/seo/aeo/authority-chains";
import type { AuthorityChainRecord } from "@/lib/seo/aeo/types";
import { EntityGlossaryLinks } from "@/components/seo/EntityGlossaryLinks";

const CHAIN_STEPS: {
  key: keyof Pick<
    AuthorityChainRecord,
    "directAnswer" | "calculation" | "explanation" | "methodology" | "evidence" | "expert"
  >;
  label: string;
  id: string;
}[] = [
  { key: "directAnswer", label: "Direct answer", id: "direct-answer" },
  { key: "calculation", label: "Calculation", id: "calculation" },
  { key: "explanation", label: "Explanation", id: "explanation" },
  { key: "methodology", label: "Methodology", id: "methodology" },
  { key: "evidence", label: "Evidence", id: "evidence" },
  { key: "expert", label: "Expert", id: "expert" },
];

/**
 * Visible authority chain: Direct Answer first (retrieval + user), then empathy,
 * then Calculation → Explanation → Methodology → Evidence → Expert → Related.
 * Additive marketing/SEO surface only.
 */
export function AuthorityChainSection({ path }: { path: string }) {
  const chain = getAuthorityChain(path);
  if (!chain) return null;

  const followOnSteps = CHAIN_STEPS.filter((step) => step.key !== "directAnswer");

  return (
    <section
      className="section authority-chain"
      aria-labelledby={`authority-h-${path.replace(/\W/g, "")}`}
      data-speakable="authority-chain"
    >
      <div className="wrap">
        <div className="section-head center reveal">
          <span className="eyebrow">Answer engine authority chain</span>
          <h2 id={`authority-h-${path.replace(/\W/g, "")}`}>{chain.primaryQuestion}</h2>
        </div>

        <div className="authority-step authority-answer-first reveal" id="direct-answer">
          <div className="authority-step-meta">
            <span className="authority-step-num">01</span>
            <span className="authority-step-label">Direct answer</span>
          </div>
          <p className="authority-direct speakable-answer">{chain.directAnswer}</p>
        </div>

        <div className="authority-empathy reveal" role="note">
          <p className="authority-empathy-label">The pressure you are under</p>
          <p>{chain.empathyLead}</p>
        </div>

        <ol className="authority-steps" start={2}>
          {followOnSteps.map((step, index) => (
            <li key={step.id} id={step.id} className="authority-step reveal">
              <div className="authority-step-meta">
                <span className="authority-step-num">{String(index + 2).padStart(2, "0")}</span>
                <span className="authority-step-label">{step.label}</span>
              </div>
              <p>{chain[step.key]}</p>
            </li>
          ))}
        </ol>

        <div className="authority-related reveal" id="related-problems">
          <p className="authority-step-label">Related problems</p>
          <ul className="authority-related-list">
            {chain.relatedProblems.map((item) => (
              <li key={item.href + item.question}>
                <Link href={item.href}>
                  <span className="authority-related-q">{item.question}</span>
                  <span className="authority-related-why">{item.why}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {chain.fanOutQueries.length > 0 ? (
          <div className="authority-fanout reveal" aria-label="Related search intents">
            <p className="authority-step-label">Also asked / query fan-out</p>
            <ul className="authority-fanout-list">
              {chain.fanOutQueries.map((query) => (
                <li key={query}>{query}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <EntityGlossaryLinks entities={chain.entities} />
      </div>
    </section>
  );
}

/** Compact lead block for hero / page top — strongest answer first. */
export function AuthorityLead({ path }: { path: string }) {
  const chain = getAuthorityChain(path);
  if (!chain) return null;
  return (
    <div className="aeo-lead authority-lead">
      <p>
        <strong>Direct answer:</strong>{" "}
        <span className="speakable-answer">{chain.directAnswer}</span>
      </p>
      <p className="authority-lead-empathy">
        <strong>The pressure you are under:</strong> {chain.empathyLead}
      </p>
    </div>
  );
}
