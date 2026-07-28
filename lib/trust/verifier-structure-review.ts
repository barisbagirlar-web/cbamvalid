/**
 * Public structure-review trust surface (T3.1).
 * H1/N1: preparation ≠ verification opinion.
 * Published SAMPLE documents must keep SAMPLE watermark / not-a-certificate language.
 */
export const STRUCTURE_REVIEW_BOUNDARY =
  "Reviewed for structure — not a verification opinion" as const;

export const STRUCTURE_REVIEW_TARGET_LETTER = [
  "We reviewed the CBAMValid Preparation Pack structure.",
  "It contains the data fields and evidence lineage required under IR 2025/2621 for our verification workflow.",
  "This is a structural review, not a verification opinion.",
].join(" ");

export const STRUCTURE_REVIEW_PACKAGE_FIELDS = [
  {
    id: "scope",
    title: "Operator / installation / year scope",
    detail: "One legal operator, one installation, one reporting year — explicit boundary statement.",
  },
  {
    id: "cn",
    title: "CN classification & goods",
    detail: "CN codes, production quantities, sector mapping, and allocation shares.",
  },
  {
    id: "emissions",
    title: "Embedded-emissions calculation",
    detail: "Direct, electricity-indirect, and precursor treatment with deterministic trace nodes.",
  },
  {
    id: "evidence",
    title: "Evidence lineage",
    detail: "Evidence register with SHA-256, support status, and field-to-evidence links.",
  },
  {
    id: "qc",
    title: "Fail-closed quality controls",
    detail: "Blockers must clear before sealing; open material findings remain visible.",
  },
  {
    id: "integrity",
    title: "Integrity manifest",
    detail: "File hashes, ruleset pin, engine version, and seal timestamp for re-verification.",
  },
] as const;

/** Outreach targets — not claimed product endorsers. */
export const STRUCTURE_REVIEW_OUTREACH_BODIES = [
  { name: "Verifikon A.Ş.", role: "Sample document issuer · structure-review illustration" },
  { name: "TÜV SÜD", role: "Independent verification body — outreach target" },
  { name: "DNV", role: "Independent verification body — outreach target" },
  { name: "SGS", role: "Independent verification body — outreach target" },
  { name: "Bureau Veritas", role: "Independent verification body — outreach target" },
] as const;

/** Watermarked SAMPLE document published on the structure-review surface. */
export const STRUCTURE_REVIEW_SAMPLE_DOCUMENT = {
  id: "verifikon-vk-2026-cbam-0001",
  issuerLabel: "Verifikon A.S.",
  title: "CBAM Verification Report — SAMPLE",
  reportNo: "VK-2026-CBAM-0001",
  issuedOn: "2026-07-28",
  status: "SAMPLE",
  notice: "This document is a sample — not a valid certificate.",
  boundary: STRUCTURE_REVIEW_BOUNDARY,
  previewHref: "/verifier-review/verifikon-cbam-verification-report-sample.webp",
  downloadHref: "/verifier-review/verifikon-cbam-verification-report-sample.pdf",
  pngHref: "/verifier-review/verifikon-cbam-verification-report-sample.png",
} as const;

export const STRUCTURE_REVIEW_PUBLIC = {
  path: "/verifier-review",
  title: "Verifier Structure Review",
  eyebrow: "Independent structure review",
  headline: "Built for how verifiers actually work",
  lede:
    "Buyers fear rejection more than math. CBAMValid publishes a structure-review surface — including a watermarked SAMPLE report format — so package fitness can be discussed without confusing preparation with a verification opinion.",
  boundary: STRUCTURE_REVIEW_BOUNDARY,
  targetLetter: STRUCTURE_REVIEW_TARGET_LETTER,
  briefHref: "/verifier-review/structure-review-brief.pdf",
  specimenLetterHref: "/verifier-review/structure-review-letter-specimen.pdf",
  sampleDocument: STRUCTURE_REVIEW_SAMPLE_DOCUMENT,
  sampleHref: "/sample-dossier",
  verifyHref: "/verify",
} as const;
