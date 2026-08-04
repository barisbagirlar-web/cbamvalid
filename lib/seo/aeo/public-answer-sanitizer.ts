import type { AeoAnswerRecord, AuthorityChainRecord } from "./types";

/**
 * Paddle-facing public answer surfaces must describe CBAMValid as software,
 * while regulatory education may still discuss independent verification as a
 * downstream legal process. These replacements target obsolete commercial
 * positioning only; they do not rewrite legal-source or methodology facts.
 */
const COMMERCIAL_REPLACEMENTS: readonly [RegExp, string][] = [
  [/Exporter Verification Preparation Pack — Prepared for Independent Accredited Verification/gi,
    "CBAMValid Working File Software Unlock — Automated Digital Delivery"],
  [/Exporter Verification Preparation Pack/gi, "CBAMValid Working File Software Unlock"],
  [/CBAM Exporter Final Evidence Report/gi, "Automated Emissions Data Output"],
  [/Prepared for Independent Accredited Verification/gi, "Generated for Customer-Controlled Downstream Use"],
  [/independent verifier-preparation platform/gi, "privately operated self-service emissions data software"],
  [/verification preparation software/gi, "self-service emissions data software"],
  [/verification preparation product/gi, "emissions data software product"],
  [/verification preparation pack/gi, "automated digital output package"],
  [/independent software service for exporter-to-importer evidence packaging/gi,
    "privately operated self-service B2B software for customer-entered emissions data and automated digital delivery"],
  [/operator-prepared dossier for independent accredited verification/gi,
    "customer-controlled digital file set for supply-chain workflows"],
  [/prepares an evidence-linked operator dossier for independent accredited verification — it does not verify emissions itself/gi,
    "generates evidence-linked PDF, JSON and XLSX files from customer-controlled data"],
  [/prepares the package; it does not issue the verification opinion/gi,
    "generates the digital files; customers manage any third-party review independently"],
  [/CBAMValid prepares the package/gi, "CBAMValid generates the digital files"],
  [/prepared for independent review/gi, "generated for customer-controlled downstream use"],
  [/verifier-preparation dossier/gi, "customer-controlled digital file set"],
  [/verifier-preparation package/gi, "automated digital output package"],
  [/preparation dossier/gi, "digital working-file output"],
];

export const FORBIDDEN_PUBLIC_COMMERCIAL_PHRASES = [
  "Carbon Border Compliance Validation",
  "Exporter Verification Preparation Pack",
  "Prepared for Independent Accredited Verification",
  "CBAM Exporter Final Evidence Report",
  "independent verifier-preparation platform",
] as const;

export function sanitizePublicCommercialText(value: string): string {
  return COMMERCIAL_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    value,
  );
}

function sanitizeValue<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizePublicCommercialText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item)) as T;
  }
  if (value && typeof value === "object") {
    const sanitized = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sanitizeValue(item)]),
    );
    return sanitized as T;
  }
  return value;
}

export function toPublicAnswerRecord(answer: AeoAnswerRecord): AeoAnswerRecord {
  return sanitizeValue(answer);
}

export function toPublicAuthorityChain(chain: AuthorityChainRecord): AuthorityChainRecord {
  return sanitizeValue(chain);
}

export function assertPublicCommercialClassification(value: unknown, label: string): void {
  const serialized = JSON.stringify(value);
  for (const phrase of FORBIDDEN_PUBLIC_COMMERCIAL_PHRASES) {
    if (serialized.toLowerCase().includes(phrase.toLowerCase())) {
      throw new Error(`${label}: obsolete public commercial phrase ${JSON.stringify(phrase)}`);
    }
  }
}
