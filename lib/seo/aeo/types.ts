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
};
