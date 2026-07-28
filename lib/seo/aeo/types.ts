import type { EvidenceStatus } from "../types";

export type AeoEvidenceItem = {
  readonly label: string;
  readonly detail: string;
  readonly href?: string;
  readonly evidenceStatus: EvidenceStatus;
};

export type AeoAnswerRecord = {
  readonly id: string;
  /** Primary question an answer engine may match. */
  readonly question: string;
  /** Alternate phrasings / sub-queries this answer covers. */
  readonly aliases: readonly string[];
  /** One clear, quotable direct answer. */
  readonly directAnswer: string;
  /** Empathy / constraint acknowledgment (helpful-content intent). */
  readonly empathyContext: string;
  readonly evidence: readonly AeoEvidenceItem[];
  /** Routes that should surface this answer visibly. */
  readonly routes: readonly string[];
  readonly relatedPaths: readonly string[];
  readonly schemaEligible: boolean;
};

export type TopicalNode = {
  readonly path: string;
  readonly topic: string;
  readonly role: "hub" | "spoke" | "commercial" | "methodology" | "verification";
  readonly parentPath?: string;
  readonly childPaths: readonly string[];
  /** Sub-queries this page is designed to answer. */
  readonly covers: readonly string[];
  /** Named entities for query fan-out and nested schema about/mentions. */
  readonly entities: readonly string[];
  /** Likely follow-up / fan-out queries this spoke should absorb. */
  readonly fanOutQueries: readonly string[];
};

/**
 * Machine-readable authority chain for critical URLs.
 * Order is retrieval-critical: Direct Answer first, then Calculation → … → Related Problems.
 */
export type AuthorityChainRecord = {
  readonly path: string;
  readonly primaryQuestion: string;
  /** Empathy: acknowledge the real commercial / operational pressure. */
  readonly empathyLead: string;
  readonly directAnswer: string;
  readonly calculation: string;
  readonly explanation: string;
  readonly methodology: string;
  readonly evidence: string;
  readonly expert: string;
  readonly relatedProblems: readonly {
    readonly question: string;
    readonly href: string;
    readonly why: string;
  }[];
  readonly entities: readonly string[];
  readonly fanOutQueries: readonly string[];
};
