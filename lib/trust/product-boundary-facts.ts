/**
 * Honest product-boundary facts for demand, actual/default, ruleset drift, and engine audit.
 * Never invent importer %, enterprise-suite market share, or third-party engine certifications.
 * EUR-Lex anchors: Regulation (EU) 2025/2083 (Omnibus) recitals (5) and (19).
 */

export const DE_MINIMIS_DEMAND_BOUNDARY = {
  id: "de-minimis-demand-boundary",
  regulationId: "REG_2025_2083",
  eliUri: "https://eur-lex.europa.eu/eli/reg/2025/2083/oj/eng",
  thresholdFact:
    "Regulation (EU) 2025/2083 introduces a single mass-based de minimis threshold initially set at 50 tonnes cumulative net mass per importer per calendar year for cement, fertilisers, iron and steel, and aluminium (electricity and hydrogen are outside that exemption).",
  importerScopeFact:
    "EUR-Lex recital (5) states the exemption applies to the vast majority of importers while keeping at least 99% of embedded emissions in CBAM scope. CBAMValid does not invent a precise “~90% of importers” statistic beyond that recital language.",
  demandFact:
    "Exporter preparation demand is driven primarily by EU buyers that still need actual-value evidence from installations feeding above-threshold obligation chains — not by every small importer now exempt under the mass threshold.",
  productBoundary:
    "CBAMValid is self-service preparation software for customer-controlled emissions packages. It is not positioned as a mass-market compliance suite for de-minimis-exempt importers, and it does not claim to replace enterprise CBAM suites used by large authorised declarants.",
} as const;

export const ACTUAL_DEFAULT_DEMAND_TRAP = {
  id: "actual-default-demand-trap",
  regulationId: "REG_2025_2083",
  eliUri: "https://eur-lex.europa.eu/eli/reg/2025/2083/oj/eng",
  verificationFact:
    "EUR-Lex recital (19) to Regulation (EU) 2025/2083 states that verification of embedded emissions applies to actual values — not to default-value declarations.",
  demandFact:
    "If an EU buyer accepts Commission default values for the declaration path, the commercial pressure on the exporter to prepare an evidence-linked actual-value dossier can disappear immediately.",
  productBoundary:
    "CBAMValid’s preparation workflow is indexed to buyer/declarant demand for actual-value evidence packages. Default-value-only paths remain possible under the Regulation, but they are not the product’s primary reason to exist.",
} as const;

export const RULESET_DRIFT_BOUNDARY = {
  id: "ruleset-drift-boundary",
  pinFact:
    "A sealed release pins a named ruleset version, engine version, and legal-source registry hash. Historical seals are immutable and are not rewritten when the Commission later amends implementing or delegated acts.",
  monitoringFact:
    "Keeping the live sealable ruleset current requires ongoing EUR-Lex / Official Journal monitoring. CBAMValid does not claim 24/7 automated legal surveillance or that every sealed file remains “current law” forever.",
  reLockFact:
    "Same-file correction re-locks cover ordinary customer data and evidence corrections on the paid working file. They are not an unlimited free professional-services obligation to re-engineer every mid-year regulatory change without acceptable-use limits.",
  productBoundary:
    "Pinned ≠ perpetual legal currency. When a newer published ruleset becomes the sealable path, operators may need to re-calculate under that newer pin; prior seals stay downloadable as historical evidence of what was locked.",
} as const;

export const ENGINE_AUDIT_BOUNDARY = {
  id: "engine-audit-boundary",
  deterministicFact:
    "“Deterministic” means: same case snapshot + same ruleset + same engine version → same outputs and node hashes. It is a reproducibility property of the software, not a third-party correctness certificate.",
  auditGap:
    "No independent third-party code review, calculation audit, or accredited software assurance opinion is published for the CBAMValid calculation engine.",
  productBoundary:
    "Verifiers may still recompute or challenge figures. CBAMValid prepares replayable traces; it does not sell an audited-engine stamp.",
} as const;

export const PRODUCT_BOUNDARY_FACTS = [
  DE_MINIMIS_DEMAND_BOUNDARY,
  ACTUAL_DEFAULT_DEMAND_TRAP,
  RULESET_DRIFT_BOUNDARY,
  ENGINE_AUDIT_BOUNDARY,
] as const;
