/**
 * Public structure-review trust surface (T3.1).
 * N1: never claim an accredited verification opinion.
 * N2: never invent signed letters, logos, or firm endorsements.
 * Published artifacts here are CBAMValid-owned briefs until a real third-party letter arrives.
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
    detail: "Blockers must clear before seal; open material findings remain visible.",
  },
  {
    id: "integrity",
    title: "Integrity manifest",
    detail: "File hashes, ruleset pin, engine version, and seal timestamp for re-verification.",
  },
] as const;

/** Outreach targets — not claimed endorsers. */
export const STRUCTURE_REVIEW_OUTREACH_BODIES = [
  { name: "TÜV SÜD", role: "Independent verification body — outreach target" },
  { name: "DNV", role: "Independent verification body — outreach target" },
  { name: "SGS", role: "Independent verification body — outreach target" },
  { name: "Bureau Veritas", role: "Independent verification body — outreach target" },
  {
    name: "TÜRKAK-accredited local body",
    role: "National accreditation pathway — outreach target",
  },
] as const;

export const STRUCTURE_REVIEW_PUBLIC = {
  path: "/verifier-review",
  title: "Verifier Structure Review",
  eyebrow: "Independent structure review",
  headline: "Built for how verifiers actually work",
  lede:
    "Buyers fear rejection more than math. CBAMValid publishes a structure-review surface so accredited verification bodies can assess package fitness for their workflow — without confusing that with a verification opinion.",
  boundary: STRUCTURE_REVIEW_BOUNDARY,
  targetLetter: STRUCTURE_REVIEW_TARGET_LETTER,
  briefHref: "/verifier-review/structure-review-brief.pdf",
  specimenLetterHref: "/verifier-review/structure-review-letter-specimen.pdf",
  sampleHref: "/sample-dossier",
  verifyHref: "/verify",
  /**
   * Third-party signed letters only. Never invent firm logos or forged signatures.
   * Add entries here only when a real signed PDF is received and published.
   */
  publishedLetters: [] as ReadonlyArray<{
    id: string;
    bodyName: string;
    issuedOn: string;
    pdfHref: string;
    sha256: string;
  }>,
} as const;
