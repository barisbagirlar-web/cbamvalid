import Link from "next/link";
import type { AeoAnswerRecord } from "@/lib/seo/aeo/types";
import { listAnswersForRoute } from "@/lib/seo/aeo/answer-bank";
import { getTopicalNode, listRelatedTopics } from "@/lib/seo/aeo/topical-map";
import { getAuthorityChain } from "@/lib/seo/aeo/authority-chains";
import { AuthorityChainSection } from "@/components/seo/AuthorityChain";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { CitationRail, LastReviewed } from "@/components/seo/CitationRail";

function AnswerCard({ answer }: { answer: AeoAnswerRecord }) {
  return (
    <article className="aeo-card" id={`answer-${answer.id}`} itemScope itemType="https://schema.org/Question">
      <p className="aeo-kicker">Direct answer</p>
      <h3 className="aeo-question" itemProp="name">
        {answer.question}
      </h3>
      <div itemScope itemType="https://schema.org/Answer" itemProp="acceptedAnswer">
        <p className="aeo-direct speakable-answer" itemProp="text">
          {answer.directAnswer}
        </p>
      </div>
      <div className="aeo-empathy">
        <p className="aeo-empathy-label">Why this matters</p>
        <p>{answer.empathyContext}</p>
      </div>
      <div className="aeo-evidence">
        <p className="aeo-evidence-label">Evidence</p>
        <ul>
          {answer.evidence.map((item) => (
            <li key={`${answer.id}-${item.label}`}>
              <strong>{item.label}.</strong> {item.detail}
              {item.href ? (
                <>
                  {" "}
                  <Link href={item.href}>Learn more</Link>
                </>
              ) : null}
              <span className="aeo-status" data-status={item.evidenceStatus}>
                {item.evidenceStatus === "verified" ? "verified" : "unverified"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </article>
  );
}

export function AnswerEvidenceSection({
  path,
  heading = "Clear answers for buyers, auditors, and AI systems",
  limit,
}: {
  path: string;
  heading?: string;
  limit?: number;
}) {
  const answers = listAnswersForRoute(path).slice(0, limit ?? 3);
  if (answers.length === 0) return null;

  return (
    <section className="section aeo-section" aria-labelledby={`aeo-heading-${path.replace(/\W/g, "")}`}>
      <div className="wrap">
        <div className="section-head center reveal">
          <span className="eyebrow">Answer + Evidence</span>
          <h2 id={`aeo-heading-${path.replace(/\W/g, "")}`}>{heading}</h2>
          <p>
            Each answer is written so a person — or an answer engine — can cite a single clear statement with supporting evidence and legal/product boundaries.
            {" "}
            <Link href="/answers">Browse the full answer bank</Link>
            {" · "}
            <Link href="/glossary">Entity glossary</Link>
          </p>
        </div>
        <div className="aeo-grid">
          {answers.map((answer) => (
            <AnswerCard key={answer.id} answer={answer} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function TopicalMapSection({ path }: { path: string }) {
  const related = listRelatedTopics(path);
  if (related.length === 0) return null;

  return (
    <section className="section tight aeo-map-section" aria-label="Related topics">
      <div className="wrap">
        <div className="section-head center reveal">
          <span className="eyebrow">Topical map</span>
          <h2>Continue in this topic cluster</h2>
          <p>Related pages that answer follow-up questions without repeating the same claim.</p>
        </div>
        <ul className="aeo-map-list">
          {related.map((item) => (
            <li key={item.path}>
              <Link href={item.path}>
                <span className="aeo-map-label">{item.label}</span>
                <span className="aeo-map-topic">{item.topic}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Visible query fan-out cluster for Google/LLM retrieval expansion. */
export function FanOutQueriesSection({ path }: { path: string }) {
  const chain = getAuthorityChain(path);
  const node = getTopicalNode(path);
  const queries = Array.from(
    new Set([...(chain?.fanOutQueries ?? []), ...(node?.fanOutQueries ?? [])]),
  ).slice(0, 8);
  if (queries.length === 0) return null;

  return (
    <section className="section tight aeo-fanout-section" aria-label="Related questions people ask">
      <div className="wrap">
        <div className="section-head center reveal">
          <span className="eyebrow">Query fan-out</span>
          <h2>Questions this page is built to absorb</h2>
          <p>
            These follow-ups map topic → entity → internal link so answer engines can cite one clear page
            instead of stitching fragmented claims.
          </p>
        </div>
        <ul className="aeo-fanout-chips">
          {queries.map((query) => (
            <li key={query}>{query}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Enterprise AEO chrome: breadcrumbs → authority → answers → fan-out →
 * topical map → citations → last reviewed.
 */
export function AeoPageChrome({
  path,
  answerHeading,
  answerLimit = 2,
  showAuthorityChain = true,
  showBreadcrumbs = true,
  showCitations = true,
}: {
  path: string;
  answerHeading?: string;
  answerLimit?: number;
  showAuthorityChain?: boolean;
  showBreadcrumbs?: boolean;
  showCitations?: boolean;
}) {
  return (
    <>
      {showBreadcrumbs ? <SeoBreadcrumbs path={path} /> : null}
      {showAuthorityChain ? <AuthorityChainSection path={path} /> : null}
      <AnswerEvidenceSection path={path} heading={answerHeading} limit={answerLimit} />
      <FanOutQueriesSection path={path} />
      <TopicalMapSection path={path} />
      {showCitations ? <CitationRail path={path} /> : null}
      <LastReviewed path={path} />
    </>
  );
}
