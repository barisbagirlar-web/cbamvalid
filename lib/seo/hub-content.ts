export interface GuideSection {
  readonly id: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly string[];
}

/**
 * Substantial hub copy for indexable regulatory guides.
 * Word count is not a KPI — every section must carry operator-useful decisions.
 * Do not invent CELEX numbers, deadlines, or acceptance claims beyond verified sources.
 */

export const CN_CODE_SCOPE_SECTIONS: readonly GuideSection[] = [
  {
    id: "answer",
    title: "Direct answer",
    paragraphs: [
      "CBAM goods scope is decided by Combined Nomenclature (CN) classification against Annex I of Regulation (EU) 2023/956 and related implementing acts — not by informal product nicknames, HS chapter guesses, or marketing categories.",
      "On CBAMValid, only CN codes that pass Stage-1 verified allowlist quality gates are indexable decision pages. Broader Annex coverage may exist in official law without yet being published as a CBAMValid public page.",
    ],
  },
  {
    id: "who",
    title: "Who is affected",
    paragraphs: [
      "Non-EU producers and exporters supplying CBAM goods to EU importers, EU importers preparing declarations, customs/classification teams, and internal reviewers assembling evidence packages.",
    ],
    bullets: [
      "Misclassification can exclude a good that should be in scope or include a good that should not.",
      "Importers typically need installation-level emissions evidence mapped to the declared CN goods.",
      "Producers must align production-route and precursor decisions with the classified good.",
    ],
  },
  {
    id: "rule",
    title: "Regulatory rule",
    paragraphs: [
      "Scope membership is hierarchical: official CN lists, chapter/heading prefixes, and documented exclusions interact. A code that is covered in the official structure is not automatically eligible for a public CBAMValid indexable page.",
      "CBAMValid separates three states: covered-but-not-allowlisted (no public detail page / hard 404 for unknown detail URLs), Stage-1 verified allowlist (indexable decision page), and utility lookup (query-based check that stays noindex).",
    ],
  },
  {
    id: "impact-2026",
    title: "2026 definitive-period impact",
    paragraphs: [
      "From 1 January 2026, definitive-period obligations centre on annual declaration and certificate treatment for covered imports. Classification errors in 2026 flow into the first declaration cycle due by 30 September 2027 for 2026 imports.",
      "Incorrect CN selection does not only create a paperwork issue — it changes which emissions boundaries, precursors, and evidence sets must be prepared.",
    ],
  },
  {
    id: "required-data",
    title: "Required data",
    paragraphs: [
      "Before treating a code as operationally settled, collect enough commercial and technical identity to defend the classification and the emissions package linked to it.",
    ],
    bullets: [
      "Legal product description and trade documents supporting the CN choice",
      "Installation identity, country, and production route for the goods",
      "Reporting period and production quantity for the declared goods",
      "Direct and electricity-related indirect emissions basis where required",
      "Precursor applicability decision and supporting quantities when in scope",
    ],
  },
  {
    id: "decision-tree",
    title: "Decision tree",
    paragraphs: ["Use this operator sequence before publishing or sealing:"],
    bullets: [
      "1. Identify the candidate CN from commercial documents — do not invent an 8-digit code.",
      "2. Check whether the code is covered by the official CBAM Annex hierarchy (including exclusions).",
      "3. If covered but not on CBAMValid Stage-1 allowlist: treat as out-of-public-index scope for now; do not fabricate a landing page.",
      "4. If on Stage-1 allowlist: open the CN decision page and confirm sector, producer data, and evidence considerations.",
      "5. Lock methodology decisions (boundary, actual/default, precursors) to that goods scope before calculation seal.",
    ],
  },
  {
    id: "example",
    title: "Practical example",
    paragraphs: [
      "A steel exporter ships goods that commercially map to a Stage-1 allowlisted iron/steel CN. The team opens the CN decision page, confirms required producer data (route, fuels/reductants, electricity, precursors), and links meter logs and production reconciliations before sealing.",
      "A different code that is merely “nearby” in the tariff tree is not interchangeable. If the exact code is unknown to CBAMValid’s public allowlist, the public detail URL fails closed with HTTP 404 rather than inventing an incomplete page.",
    ],
  },
  {
    id: "errors",
    title: "Common errors and risks",
    paragraphs: ["These failures repeatedly break verification preparation:"],
    bullets: [
      "Using 4- or 6-digit headings as if they were final CBAM goods codes",
      "Treating HS marketing labels as CN decisions",
      "Publishing or indexing incomplete CN pages for codes lacking verified content quality",
      "Changing CN mid-case without re-running boundary, precursor, and evidence linkage checks",
      "Do not treat Stage-1 allowlist pages as covering every official CN code",
    ],
  },
  {
    id: "sources",
    title: "Official EU sources",
    paragraphs: [
      "Primary legal basis is Regulation (EU) 2023/956 (Annex I goods scope) together with the applicable implementing and amending acts referenced on this site’s regulatory footer. Always prefer EUR-Lex / Commission primary pages over secondary summaries.",
    ],
  },
  {
    id: "related",
    title: "Related CN and methodology",
    paragraphs: [
      "Use the CN hub for allowlisted decision pages, the methodology page for calculation and ruleset versioning, and the embedded-emissions guide for direct/indirect/precursor treatment once classification is stable.",
    ],
  },
  {
    id: "cbamvalid",
    title: "How CBAMValid handles it",
    paragraphs: [
      "CBAMValid maintains a Stage-1 verified allowlist for public CN decision pages, a fail-closed unknown-code 404 for non-allowlisted detail URLs, and a noindex utility lookup for exploratory checks. Calculations and sealed dossiers bind to the case’s classified goods and versioned ruleset.",
    ],
  },
  {
    id: "boundary",
    title: "Product boundary",
    paragraphs: [
      "CBAMValid prepares an operator evidence and calculation dossier for independent accredited verification. It does not issue an accredited verification opinion, customs approval, Registry acceptance, or an official complete CN directory claim.",
    ],
  },
];

export const EXPORTER_EVIDENCE_SECTIONS: readonly GuideSection[] = [
  {
    id: "answer",
    title: "Direct answer",
    paragraphs: [
      "Material CBAM inputs must carry evidence lineage: who issued the document, what period it covers, which field or calculation it supports, and cryptographic integrity of the stored file bytes.",
      "Pending, rejected, unsupported, missing, tampered, unlinked, or hash-mismatched evidence must block sealing. Partially supported is not fully supported.",
    ],
  },
  {
    id: "who",
    title: "Who is affected",
    paragraphs: [
      "Non-EU producers and exporters assembling packages for EU importers, data preparers, internal reviewers, and read-only verifier recipients who must navigate evidence without altering source records.",
    ],
  },
  {
    id: "rule",
    title: "Regulatory and operational rule",
    paragraphs: [
      "Embedded emissions claims used for CBAM reporting must be defensible. Operator-prepared packages are not accredited verification opinions, but they must still present coherent, evidence-linked calculations that an independent verifier can test.",
      "CBAMValid enforces a fail-closed evidence contract before a sealed release: review status approved, support status supported, physical bytes matching registered SHA-256 and size, and tenant/case-bound storage paths.",
    ],
  },
  {
    id: "impact-2026",
    title: "2026 definitive-period impact",
    paragraphs: [
      "In the definitive period, weak evidence does not only create transitional learning friction — it undermines the annual declaration package that importers must defend, with the first 2026-import declaration cycle due by 30 September 2027.",
      "Evidence gaps discovered late force recalculation, new sealed versions, and delayed handover to accredited verification.",
    ],
  },
  {
    id: "required-data",
    title: "Required evidence data",
    paragraphs: ["Every material evidence record should capture at least:"],
    bullets: [
      "Evidence identity, file name, document type, issuer, and issue date",
      "Reporting-period coverage and linked input fields / calculations",
      "MIME type, byte size, storage path, SHA-256 hash, upload time, uploader",
      "Confidentiality marking, review status, support status, and page/sheet/row references where relevant",
      "Reviewer notes and corrective-action linkage when findings exist",
    ],
  },
  {
    id: "decision-tree",
    title: "Decision tree",
    paragraphs: ["Before requesting seal:"],
    bullets: [
      "1. Map each material calculation input to at least one evidence object.",
      "2. Confirm period coverage matches the reporting year/period of the case.",
      "3. Approve review status only after human review of content suitability.",
      "4. Mark support status supported only when the document fully supports the claimed input.",
      "5. Verify stored bytes match registered hash and size.",
      "6. Close or remediate open material findings — do not suppress them.",
      "7. Seal only when the readiness engine reports a sealable state.",
    ],
  },
  {
    id: "example",
    title: "Practical example",
    paragraphs: [
      "Electricity consumption used for indirect emissions is linked to a meter extract PDF. The evidence record stores issuer, period, SHA-256, and the exact input field IDs. After internal approval and support confirmation, the calculation node references that evidence ID in the sealed trace.",
      "If a later upload replaces the PDF with different bytes, hash verification fails and sealing is blocked until the register and physical object are reconciled.",
    ],
  },
  {
    id: "errors",
    title: "Common errors and risks",
    paragraphs: ["Frequent seal blockers:"],
    bullets: [
      "Uploading files without linking them to the fields they supposedly prove",
      "Using documents outside the reporting period",
      "Treating partially supported evidence as sealable",
      "Relying on metadata alone when bytes cannot be verified",
      "Cross-tenant or path-traversal storage mistakes",
      "Assuming client preview calculations are the sealed authoritative result",
    ],
  },
  {
    id: "sources",
    title: "Official EU sources",
    paragraphs: [
      "Evidence expectations follow from the CBAM regulatory framework (Regulation (EU) 2023/956 and applicable implementing acts) and from verification practice: claims must be testable. Use primary EUR-Lex and Commission sources cited in the page footer.",
    ],
  },
  {
    id: "related",
    title: "Related CN and methodology",
    paragraphs: [
      "CN classification determines which producer data and evidence sets are material. Methodology decisions (boundary, actual/default, allocation) determine which calculations must be evidenced. Review the sample dossier to see how evidence register, field matrix, and calculation annex sit together.",
    ],
  },
  {
    id: "cbamvalid",
    title: "How CBAMValid handles it",
    paragraphs: [
      "CBAMValid stores tenant-bound evidence, computes SHA-256, tracks review/support status, blocks seal on material gaps, and packages an evidence register plus field-to-evidence matrix inside the sealed release. Re-download returns the same immutable package.",
    ],
  },
  {
    id: "boundary",
    title: "Product boundary",
    paragraphs: [
      "CBAMValid is an exporter verification-preparation platform. It does not replace independent accredited verification, does not guarantee Registry or customs acceptance, and does not convert missing evidence into assumed zeros.",
    ],
  },
];
