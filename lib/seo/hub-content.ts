export interface GuideSection {
  readonly id: string;
  readonly title: string;
  readonly paragraphs?: readonly string[];
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

export const DEFAULT_VALUES_SECTIONS: readonly GuideSection[] = [
  {
    id: "answer",
    title: "Direct answer",
    paragraphs: [
      "CBAM default values are official fallback factors. They cannot safely be published as one emissions number per CN code.",
      "Official defaults vary by dimensions such as year, country or region, CN/goods class, production route, and direct versus indirect emission type.",
    ],
  },
  {
    id: "who",
    title: "Who is affected",
    paragraphs: [
      "Exporters and operators estimating emissions before full monitoring evidence exists, importers modelling financial exposure, and consultants who must avoid inventing SEO-friendly single-factor tables.",
    ],
  },
  {
    id: "rule",
    title: "Regulatory rule",
    paragraphs: [
      "Default values are permitted only under the conditions set by the applicable CBAM implementing rules. Using a default does not remove the need to document the pathway choice and evidence limitations.",
      "Dimensional dependence means two goods with the same CN digit string can still require different default lookups when route, country, or emission type differs.",
    ],
  },
  {
    id: "impact-2026",
    title: "2026 definitive-period impact",
    paragraphs: [
      "In the definitive period, default-value misuse becomes a declaration-quality risk, not only a transitional learning issue. Wrong dimensional selection flows into the annual package due by 30 September 2027 for 2026 imports.",
    ],
  },
  {
    id: "required-data",
    title: "Required data before using a default",
    paragraphs: ["At minimum, lock:"],
    bullets: [
      "Goods CN classification and reporting period",
      "Installation country and production route",
      "Whether the claim is direct, electricity-related indirect, or both",
      "The official default dataset version used by the ruleset",
      "Why actual values were not available or not used",
    ],
  },
  {
    id: "decision-tree",
    title: "Decision tree",
    bullets: [
      "1. Prefer actual values when installation evidence can support verification.",
      "2. If using defaults, identify every regulatory dimension required by the published table — do not collapse to CN-only.",
      "3. Record the ruleset/default dataset version in the methodology decision log.",
      "4. Flag mark-ups or conservative adjustments when the rules require them.",
      "5. Do not publish or seal a single invented factor as if it were official.",
    ],
  },
  {
    id: "example",
    title: "Practical example",
    paragraphs: [
      "A fertiliser exporter lacks complete laboratory evidence for one intermediate. The team selects the official default path for that goods class, country group, route and emission type under the pinned ruleset — and records why actual values were incomplete — instead of pasting a blog “average tCO2e/t” into the dossier.",
    ],
  },
  {
    id: "errors",
    title: "Common errors and risks",
    bullets: [
      "Publishing one default per CN on a marketing page",
      "Ignoring country/route/year dimensions",
      "Treating defaults as verified actual emissions",
      "Mixing transitional guidance with definitive-period default tables",
    ],
  },
  {
    id: "sources",
    title: "Official EU sources",
    paragraphs: [
      "Use the versioned official default-value sources referenced by CBAMValid rulesets and EUR-Lex implementing acts — not secondary calculators that flatten dimensions.",
    ],
  },
  {
    id: "related",
    title: "Related methodology",
    paragraphs: [
      "Read actual-vs-default for pathway choice, methodology for ruleset versioning, and the CN hub for goods scope before selecting any factor.",
    ],
  },
  {
    id: "cbamvalid",
    title: "How CBAMValid handles it",
    paragraphs: [
      "CBAMValid binds calculations to versioned rulesets and records method decisions. It refuses to invent a single SEO factor per CN and keeps actual/default pathway explicit in the sealed package.",
    ],
  },
  {
    id: "boundary",
    title: "Product boundary",
    paragraphs: [
      "CBAMValid does not publish unofficial default tables as regulatory truth and does not guarantee that a default pathway will be accepted without independent verification where required.",
    ],
  },
];

export const NON_EU_PRODUCER_SECTIONS: readonly GuideSection[] = [
  {
    id: "answer",
    title: "Direct answer",
    paragraphs: [
      "Non-EU producers typically must supply EU importers with installation-specific embedded emissions evidence aligned to CBAM goods scope, production route, and reporting period.",
      "CBAMValid lets producers prepare a draft dossier before payment; sealing a release consumes entitlement and produces an immutable verifier-facing package.",
    ],
  },
  {
    id: "who",
    title: "Who is affected",
    paragraphs: [
      "Non-EU operators and exporters selling CBAM goods into the EU, their data preparers, and EU buyers who need defensible evidence for definitive-period declarations.",
    ],
  },
  {
    id: "rule",
    title: "Regulatory rule",
    paragraphs: [
      "Importers bear CBAM declaration duties for covered goods, but they depend on producer data quality. Incomplete producer evidence becomes the importer’s declaration risk.",
      "Evidence must be period-aligned, goods-aligned, and traceable — not a marketing emissions claim.",
    ],
  },
  {
    id: "impact-2026",
    title: "2026 definitive-period impact",
    paragraphs: [
      "For 2026 imports, the first declaration and corresponding certificate surrender deadline used on this site is 30 September 2027. Producers who wait until late 2027 to organise evidence create avoidable buyer friction.",
    ],
  },
  {
    id: "required-data",
    title: "Required data producers should prepare",
    bullets: [
      "Legal operator and installation identity",
      "CN classification and production quantities",
      "Production route and system boundary decisions",
      "Direct and electricity-related indirect emissions basis where required",
      "Precursor treatment where applicable",
      "Evidence files with integrity hashes and field linkage",
    ],
  },
  {
    id: "decision-tree",
    title: "Decision tree",
    bullets: [
      "1. Confirm goods are in CBAM scope for the declared CN.",
      "2. Agree with the buyer which reporting period and goods lots are in scope.",
      "3. Choose actual vs default pathway with documented reasons.",
      "4. Assemble evidence and close material findings.",
      "5. Seal only when quality gates pass — then transfer the immutable package.",
    ],
  },
  {
    id: "example",
    title: "Practical example",
    paragraphs: [
      "A Turkish steel mill prepares a 2026 reporting-year package for an EU importer: CN decision pages, meter extracts, production reconciliations, and a sealed CBAMValid dossier the importer can hand to an accredited verifier.",
    ],
  },
  {
    id: "errors",
    title: "Common errors and risks",
    bullets: [
      "Sending unsigned spreadsheets without evidence hashes",
      "Mixing calendar years or shipment lots without reconciliation",
      "Assuming buyer acceptance equals accredited verification",
      "Starting evidence collection after the importer’s internal deadline",
    ],
  },
  {
    id: "sources",
    title: "Official EU sources",
    paragraphs: [
      "Primary basis remains Regulation (EU) 2023/956 and applicable implementing acts, plus Commission CBAM communications for definitive-period timetable context.",
    ],
  },
  {
    id: "related",
    title: "Related CN and methodology",
    paragraphs: [
      "Use the CN scope guide and hub for classification, the 2026 definitive-period page for timetable context, and the product page for package contents.",
    ],
  },
  {
    id: "cbamvalid",
    title: "How CBAMValid handles it",
    paragraphs: [
      "CBAMValid is built for exporter-to-importer evidence transfer: guided case scope, evidence register, deterministic calculation, fail-closed seal, and immutable release download.",
    ],
  },
  {
    id: "boundary",
    title: "Product boundary",
    paragraphs: [
      "CBAMValid is not an EU authority and does not replace independent accredited verification or guarantee customs/Registry acceptance.",
    ],
  },
];

export const VERIFICATION_PREPARATION_SECTIONS: readonly GuideSection[] = [
  {
    id: "answer",
    title: "Direct answer",
    paragraphs: [
      "Verification preparation means assembling complete, evidence-linked emissions data so an independent accredited verifier can perform assurance work.",
      "CBAMValid prepares the operator package; it does not issue an accredited verification opinion, reasonable assurance statement, or official certificate.",
    ],
  },
  {
    id: "who",
    title: "Who is affected",
    paragraphs: [
      "Operators and exporters preparing for verifier engagement, importers requesting ready packages, internal reviewers, and read-only verifier recipients.",
    ],
  },
  {
    id: "rule",
    title: "Regulatory and operational rule",
    paragraphs: [
      "Where verification is legally required, actual emissions data must be independently verified. Operator-prepared dossiers reduce verifier effort only when scope, evidence, calculations, and findings are coherent and immutable.",
    ],
  },
  {
    id: "impact-2026",
    title: "2026 definitive-period impact",
    paragraphs: [
      "Definitive-period timelines leave less room for incomplete packages. Material evidence gaps discovered during verification delay importer readiness for the 2026 declaration cycle.",
    ],
  },
  {
    id: "required-data",
    title: "Preparation checklist",
    bullets: [
      "Product scope assessment and CN reasoning",
      "Installation monitoring and process maps",
      "Evidence register with hash integrity and support status",
      "Methodology decision log",
      "Embedded emissions calculation annex and calculation trace",
      "Findings and corrective actions closed for material issues",
      "Data integrity manifest for the sealed release",
    ],
  },
  {
    id: "decision-tree",
    title: "Decision tree",
    bullets: [
      "1. Freeze case scope (installation, year, goods, boundary).",
      "2. Complete evidence coverage for material inputs.",
      "3. Run readiness assessment and remediate blockers.",
      "4. Seal only on pass — blocked seals consume zero entitlement.",
      "5. Hand the immutable package to the accredited verifier.",
    ],
  },
  {
    id: "example",
    title: "Practical example",
    paragraphs: [
      "An operator closes open findings, approves evidence, seals release v3, and sends the ZIP plus verifier workspace to the accredited firm. Re-download later returns the same bytes and hashes.",
    ],
  },
  {
    id: "errors",
    title: "Common errors and risks",
    bullets: [
      "Calling an operator package a “verified” certificate",
      "Sealing with partially supported evidence",
      "Editing sealed files outside the system",
      "Skipping methodology decisions because “the calculator filled them in”",
    ],
  },
  {
    id: "sources",
    title: "Official EU sources",
    paragraphs: [
      "CBAM verification duties sit in the CBAM regulatory framework; CBAMValid aligns package structure to operator preparation practice without claiming accreditation authority.",
    ],
  },
  {
    id: "related",
    title: "Related CN and methodology",
    paragraphs: [
      "See exporter evidence requirements for lineage rules, sample dossier for package shape, and product page for the USD 449 case-scoped pay-at-lock contract. Same-file correction re-locks are included; a new file requires a new payment.",
    ],
  },
  {
    id: "cbamvalid",
    title: "How CBAMValid handles it",
    paragraphs: [
      "CBAMValid runs fail-closed readiness gates, seals immutable releases, and packages the canonical verifier-facing components without granting verifier powers to the software.",
    ],
  },
  {
    id: "boundary",
    title: "Product boundary",
    paragraphs: [
      "Prepared for Independent Accredited Verification — not an accredited opinion, not EU approval, not Registry acceptance.",
    ],
  },
];

export const ACTUAL_VS_DEFAULT_SECTIONS: readonly GuideSection[] = [
  {
    id: "answer",
    title: "Direct answer",
    paragraphs: [
      "Actual values reflect installation-specific monitored or calculated emissions and generally require independent verification where legally required.",
      "Default values are official fallbacks that depend on multiple regulatory dimensions — not a single universal CN number.",
    ],
  },
  {
    id: "who",
    title: "Who is affected",
    paragraphs: [
      "Producers choosing a reporting pathway, importers assessing evidence strength, and reviewers who must prevent silent default substitution.",
    ],
  },
  {
    id: "rule",
    title: "Regulatory rule",
    paragraphs: [
      "Pathway choice is a methodology decision. Switching from actual to default (or the reverse) changes evidence burden, verification expectations, and often the numeric result.",
    ],
  },
  {
    id: "impact-2026",
    title: "2026 definitive-period impact",
    paragraphs: [
      "Definitive-period declarations amplify the cost of undocumented pathway switches. Record the choice before sealing 2026 reporting packages.",
    ],
  },
  {
    id: "required-data",
    title: "Required data",
    bullets: [
      "Evidence quality assessment for actual pathway",
      "Dimensional keys for any default lookup",
      "Documented reason for the selected pathway",
      "Ruleset version pinning both calculation and defaults",
    ],
  },
  {
    id: "decision-tree",
    title: "Decision tree",
    bullets: [
      "1. Can actual evidence support verification for material sources? If yes, prefer actual.",
      "2. If not, confirm defaults are allowed for that goods/context under the ruleset.",
      "3. Apply full dimensional lookup — never CN-only.",
      "4. Log rejected alternatives and residual uncertainty.",
      "5. Recalculate and reseal if the pathway changes.",
    ],
  },
  {
    id: "example",
    title: "Practical example",
    paragraphs: [
      "An aluminium smelter has strong electricity metering (actual indirect) but incomplete anode evidence. The team keeps actual electricity data and applies an allowed default only to the unsupported process component, with explicit methodology notes — not a blended invented factor.",
    ],
  },
  {
    id: "errors",
    title: "Common errors and risks",
    bullets: [
      "Treating defaults as “good enough actuals”",
      "CN-only default tables on websites",
      "Changing pathway after seal without a new release",
      "Hiding mark-ups that the rules require",
    ],
  },
  {
    id: "sources",
    title: "Official EU sources",
    paragraphs: [
      "Follow Regulation (EU) 2023/956 and the implementing acts governing calculation and default publication; see also the default-values guide on this site.",
    ],
  },
  {
    id: "related",
    title: "Related CN and methodology",
    paragraphs: [
      "Pair this page with `/cbam-default-values` and `/methodology`. Goods scope must be settled before pathway choice matters.",
    ],
  },
  {
    id: "cbamvalid",
    title: "How CBAMValid handles it",
    paragraphs: [
      "CBAMValid records pathway decisions, binds engine versions, and keeps actual vs default explicit in traces and sealed outputs.",
    ],
  },
  {
    id: "boundary",
    title: "Product boundary",
    paragraphs: [
      "CBAMValid does not decide legal acceptability of a pathway for a specific declarant; that remains with the operator, importer, and accredited verifier where required.",
    ],
  },
];

export const CERTIFICATE_PRICE_SECTIONS: readonly GuideSection[] = [
  {
    id: "answer",
    title: "Direct answer",
    paragraphs: [
      "CBAM certificate prices are calculated and published under Implementing Regulation (EU) 2025/2548. In 2026 the publication cadence is quarterly.",
      "That quarterly price mechanism must not be mislabelled as transitional quarterly emissions reporting.",
    ],
  },
  {
    id: "who",
    title: "Who is affected",
    paragraphs: [
      "EU importers estimating certificate costs, finance teams modelling exposure, and producers explaining buyer cost drivers without confusing reporting cadence with price cadence.",
    ],
  },
  {
    id: "rule",
    title: "Regulatory rule",
    paragraphs: [
      "Certificate price publication follows the implementing act’s methodology and calendar. Obligation to surrender certificates for definitive-period imports follows the declaration timetable — not the price-publication frequency.",
    ],
  },
  {
    id: "impact-2026",
    title: "2026 definitive-period impact",
    paragraphs: [
      "For 2026 imports, this site’s verified timetable states first declaration and corresponding certificate surrender by 30 September 2027. Quarterly 2026 prices inform estimates; they do not create transitional-style quarterly emissions reports.",
    ],
  },
  {
    id: "required-data",
    title: "Required data for estimates",
    bullets: [
      "Embedded emissions quantity subject to certificates",
      "Applicable published certificate price for the relevant period",
      "Any recognised carbon price paid adjustments where rules allow",
      "Clear separation between estimate and sealed emissions package",
    ],
  },
  {
    id: "decision-tree",
    title: "Decision tree",
    bullets: [
      "1. Separate emissions calculation from certificate price lookup.",
      "2. Use official published prices for the relevant quarter — do not invent.",
      "3. Do not treat price cadence as a reporting-period obligation.",
      "4. Align financial estimates with the 30 September 2027 first-cycle framing for 2026 imports.",
    ],
  },
  {
    id: "example",
    title: "Practical distinction",
    paragraphs: [
      "A 2026 Q2 published certificate price informs a buyer’s accrual estimate. The operator’s emissions dossier still covers the annual reporting period and supports the declaration due 30 September 2027 — it is not a “Q2 emissions report” merely because prices publish quarterly.",
    ],
  },
  {
    id: "errors",
    title: "Common errors and risks",
    bullets: [
      "Calling quarterly price updates “quarterly CBAM reports”",
      "Using unofficial scraped prices in sealed packages",
      "Ignoring the 2027 first declaration deadline while chasing weekly price noise",
    ],
  },
  {
    id: "sources",
    title: "Official EU sources",
    paragraphs: [
      "Implementing Regulation (EU) 2025/2548 for certificate price rules; Commission CBAM portal for definitive-period communications; EUR-Lex for authoritative text.",
    ],
  },
  {
    id: "related",
    title: "Related methodology",
    paragraphs: [
      "See `/cbam-2026-definitive-period` for timetable context and `/pricing` for CBAMValid product pricing (USD 449 per case-scoped working file at lock) — product price is not a CBAM certificate price.",
    ],
  },
  {
    id: "cbamvalid",
    title: "How CBAMValid handles it",
    paragraphs: [
      "CBAMValid focuses on emissions evidence and calculation packages. It does not sell CBAM certificates and does not replace official price publication.",
    ],
  },
  {
    id: "boundary",
    title: "Product boundary",
    paragraphs: [
      "CBAMValid product pricing and CBAM certificate prices are unrelated markets. This page explains the regulatory price cadence only.",
    ],
  },
];

export const DEFINITIVE_2026_SECTIONS: readonly GuideSection[] = [
  {
    id: "what-changed",
    title: "What changed in 2026?",
    paragraphs: [
      "From 1 January 2026, CBAM operates under definitive-period rules. Obligations centre on annual declarations and certificate surrender for covered imports — not on recreating transitional-period quarterly emissions reporting as if it were the 2026 definitive system.",
    ],
    bullets: [
      "Definitive period starts 1 January 2026",
      "For 2026 imports, the first CBAM declaration and corresponding certificate surrender deadline is 30 September 2027",
      "Certificate price calculation cadence in 2026 is quarterly; that is not the same as transitional quarterly reporting",
    ],
  },
  {
    id: "who",
    title: "Who this affects",
    paragraphs: [
      "EU importers of CBAM goods and non-EU producers who must supply evidence-linked embedded emissions data to those importers.",
    ],
  },
  {
    id: "data",
    title: "What data is required",
    paragraphs: [
      "Goods identification (including CN classification), installation and production-route data, direct and indirect emissions evidence where required, precursor treatment where applicable, and a fail-closed quality review before verifier handover.",
    ],
  },
  {
    id: "cbamvalid",
    title: "How CBAMValid handles the task",
    paragraphs: [
      "CBAMValid structures the operator evidence package, runs deterministic calculations against versioned rulesets, and seals an immutable dossier for independent accredited verification. It does not replace accredited verification.",
    ],
  },
];
