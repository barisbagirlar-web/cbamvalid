import Link from "next/link";
import { AEO_ANSWER_BANK } from "@/lib/seo/aeo/answer-bank";
import { toPublicAnswerRecord } from "@/lib/seo/aeo/public-answer-sanitizer";
import { JsonLdForRoute } from "@/components/seo/JsonLdForRoute";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { CitationRail, LastReviewed } from "@/components/seo/CitationRail";
import { generateSeoMetadata } from "@/lib/seo/build-metadata";
import { requireSeoRoute } from "@/lib/seo/registry";

export const metadata = generateSeoMetadata("/answers");

const PUBLIC_ANSWERS = AEO_ANSWER_BANK.map(toPublicAnswerRecord);

function routeLabel(path: string): string {
  return path === "/" ? "Home" : requireSeoRoute(path).h1;
}

/**
 * HTML answer hub — crawlable public product and regulatory answers.
 * Commercial product names are normalized to the software-only classification
 * before rendering; regulatory education remains unchanged.
 */
export default function AnswersHubPage() {
  return (
    <main id="main" className="answers-hub">
      <JsonLdForRoute path="/answers" />
      <SeoBreadcrumbs path="/answers" />
      <section className="section">
        <div className="wrap">
          <div className="section-head reveal">
            <span className="eyebrow">Answer engine hub</span>
            <h1>CBAMValid software answer bank</h1>
            <p className="lede">
              Direct answers about the self-service software, customer-controlled workflow, automated
              calculations, digital delivery and related CBAM methodology. Each answer links to the page
              that owns the supporting detail.
            </p>
            <p className="aeo-lead">
              <strong>Direct answer:</strong>{" "}
              <span className="speakable-answer">
                CBAMValid is privately operated self-service B2B software. Customers enter and control
                their own data; the application performs automated calculations, quality controls and
                PDF, JSON and XLSX generation.
              </span>
            </p>
          </div>
          <LastReviewed path="/answers" />
          <div className="aeo-grid answers-hub-grid">
            {PUBLIC_ANSWERS.map((answer, index) => (
              <article
                key={answer.id}
                id={answer.id}
                className="aeo-card"
                itemScope
                itemType="https://schema.org/Question"
              >
                <p className="aeo-kicker">Answer {String(index + 1).padStart(2, "0")}</p>
                <h2 className="aeo-question" itemProp="name">
                  {answer.question}
                </h2>
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
                            <Link href={item.href}>Source page</Link>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="answers-hub-routes">
                  Full chain:{" "}
                  {answer.routes.map((route, i) => (
                    <span key={route}>
                      {i > 0 ? " · " : null}
                      <Link href={route}>{routeLabel(route)}</Link>
                    </span>
                  ))}
                </p>
              </article>
            ))}
          </div>
          <p className="answers-hub-feeds">
            Machine feeds: <Link href="/answers.json">answers.json</Link>
            {" · "}
            <Link href="/answers.rss">answers.rss</Link>
            {" · "}
            <Link href="/answers.feed.json">JSON Feed</Link>
            {" · "}
            <Link href="/glossary">Entity glossary</Link>
          </p>
        </div>
      </section>
      <CitationRail path="/answers" />
    </main>
  );
}
