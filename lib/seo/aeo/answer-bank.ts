import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import { getQcRuleFamilyCount } from "@/lib/cbam/validation/qc-rule-registry";
import type { AeoAnswerRecord } from "./types";

const PRICE = CANONICAL_PRICING.priceFormatted;
const QC_RULE_FAMILIES = getQcRuleFamilyCount();

/**
 * Canonical Answer + Evidence bank for AEO / FAQPage / visible page blocks.
 * Only verified commercial and product facts — no synthetic social proof.
 */
export const AEO_ANSWER_BANK: readonly AeoAnswerRecord[] = [
  {
    id: "what-does-usd-449-buy",
    question: `What does ${PRICE} buy on CBAMValid?`,
    aliases: [
      "CBAMValid price",
      "Exporter Verification Preparation Pack cost",
      "is CBAMValid a subscription",
      "what is included in the preparation pack",
    ],
    directAnswer: `${PRICE} unlocks lock-and-download for one working file: one legal operator, one production installation, and one reporting year — with unlimited drafts and correction re-locks on that same paid file. It is a one-time pay-at-lock purchase, not a subscription, and not a soft Excel-only export.`,
    empathyContext:
      "EU buyers increasingly ask for actual embedded-emissions evidence. You should finish data quality work without a card, then pay once when the locked package matters — without another checkout every time a buyer asks for a correction on the same file.",
    evidence: [
      {
        label: "Commercial unit",
        detail: "1 operator + 1 installation + 1 reporting year · pay once per working file · same-file corrections included",
        href: "/pricing",
        evidenceStatus: "verified",
      },
      {
        label: "Payment timing",
        detail: "Card is charged when you pay to lock that working file. Drafting is free. Same-file re-locks do not charge again.",
        href: "/pricing#how-payment-works",
        evidenceStatus: "verified",
      },
      {
        label: "Independence boundary",
        detail: "Operator-prepared dossier for independent accredited verification — not an accredited opinion or EU approval.",
        href: "/methodology",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/", "/pricing", "/product"],
    relatedPaths: ["/pricing", "/how-it-works", "/sample-dossier"],
    schemaEligible: true,
  },
  {
    id: "when-is-card-charged",
    question: "When is my card charged?",
    aliases: [
      "do I pay when I seal",
      "is drafting free",
      "CBAMValid payment flow",
    ],
    directAnswer: `Drafting and editing are free. Your card is charged ${PRICE} when you pay to lock a specific working file. After that, correct and re-lock the same file as needed at no extra charge. A new working file needs a new payment. Failed locks charge nothing. Re-download is free.`,
    empathyContext:
      "Nobody wants a surprise charge mid-review. Finish data quality work first, then pay when you lock — and keep correction room on that same file without another checkout.",
    evidence: [
      {
        label: "Draft policy",
        detail: CANONICAL_PRICING.draftPolicy,
        href: "/pricing",
        evidenceStatus: "verified",
      },
      {
        label: "Pay-at-lock rules",
        detail: CANONICAL_PRICING.paymentFlowSummary,
        href: "/pricing#how-payment-works",
        evidenceStatus: "verified",
      },
      {
        label: "Contract mirror",
        detail: "Same commercial rules appear in Terms of Service §3.",
        href: "/terms#commercial-terms",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/", "/pricing", "/how-it-works"],
    relatedPaths: ["/pricing", "/how-it-works"],
    schemaEligible: true,
  },
  {
    id: "what-is-cbamvalid",
    question: "What is CBAMValid?",
    aliases: [
      "CBAM verification preparation software",
      "CBAM exporter evidence dossier tool",
      "is CBAMValid an official EU service",
    ],
    directAnswer:
      "CBAMValid is an independent verifier-preparation platform for non-EU producers, exporters, operators, importers, and CBAM reporting teams. It helps you build an evidence-linked, sealed operator dossier that reduces the work required for independent accredited verification.",
    empathyContext:
      "If your EU customer asks for actual values, you need a serious package — not a spreadsheet you cannot defend. You also need clear language about what is preparation versus what only an accredited verifier can issue.",
    evidence: [
      {
        label: "Product positioning",
        detail: "Exporter Verification Preparation Pack — Prepared for Independent Accredited Verification",
        href: "/product",
        evidenceStatus: "verified",
      },
      {
        label: "Not an official EU service",
        detail: "Not an EU institution, customs authority, accredited verifier, or CBAM Registry submission service.",
        href: "/about",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/", "/product", "/about"],
    relatedPaths: ["/product", "/methodology", "/sample-dossier"],
    schemaEligible: true,
  },
  {
    id: "can-one-pack-cover-another-plant",
    question: "Can one pack be reused for another factory or reporting year?",
    aliases: [
      "pack scope lock",
      "another installation same purchase",
      "CBAMValid multi plant pricing",
    ],
    directAnswer:
      "No. Payment unlocks one working file for one legal operator, one installation, and one reporting year. Another factory, another reporting year, or a new working file requires a new payment. On the same paid file you may draft freely and correct/re-lock as needed.",
    empathyContext:
      "This protects honest customers who need correction versions, and blocks paying once then quietly renaming a case into a different plant or year.",
    evidence: [
      {
        label: "Scope rule",
        detail: "1 operator · 1 installation · 1 reporting year per paid working file",
        href: "/pricing#how-payment-works",
        evidenceStatus: "verified",
      },
      {
        label: "Same-file corrections",
        detail: "Correction re-locks on the paid working file do not require a new payment",
        href: "/terms#commercial-terms",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/pricing", "/product"],
    relatedPaths: ["/pricing", "/how-it-works"],
    schemaEligible: true,
  },
  {
    id: "sealed-vs-verified",
    question: "Does sealing mean my emissions are officially verified?",
    aliases: [
      "is a sealed dossier accredited verification",
      "CBAMValid verification opinion",
      "does CBAMValid replace a verifier",
    ],
    directAnswer:
      "No. Sealing locks an operator-prepared dossier with integrity hashes for handover. Where verification is legally required, actual emissions must still be independently verified by an accredited verifier. CBAMValid prepares the package; it does not issue a verification opinion.",
    empathyContext:
      "Overclaiming “verified” creates commercial and legal risk for exporters. Clear boundaries protect you when a buyer or verifier reviews the file.",
    evidence: [
      {
        label: "Seal meaning",
        detail: "Immutable operator package with SHA-256 manifest — prepared for independent review",
        href: "/how-it-works",
        evidenceStatus: "verified",
      },
      {
        label: "Independence boundary",
        detail: "Not an accredited verification opinion, customs approval, or registry acceptance",
        href: "/methodology",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/", "/how-it-works", "/methodology", "/sample-dossier"],
    relatedPaths: ["/methodology", "/sample-dossier", "/verify"],
    schemaEligible: true,
  },
  {
    id: "how-workflow-works",
    question: "How does the CBAMValid workflow work?",
    aliases: [
      "CBAMValid steps",
      "how to prepare a CBAM dossier",
      "from draft to sealed release",
    ],
    directAnswer:
      "You create one working file for one installation and one reporting year, enter goods and production data, link evidence, clear quality blockers, pay once to lock that file, then download PDF, JSON, and O3CI field-mapped exports. Same file: correct and re-lock as needed. A new file needs a new payment.",
    empathyContext:
      "Most teams lose time in email threads and version chaos. One working file with fail-closed checks is designed so you see gaps before you ask a buyer or verifier to review.",
    evidence: [
      {
        label: "Workflow",
        detail: "Eight guided stages from scope to sealed deliverables",
        href: "/how-it-works",
        evidenceStatus: "verified",
      },
      {
        label: "Sample package",
        detail: "Inspect a public sample dossier structure before buying",
        href: "/sample-dossier",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/", "/how-it-works", "/product"],
    relatedPaths: ["/how-it-works", "/sample-dossier", "/pricing"],
    schemaEligible: true,
  },
  {
    id: "why-methodology-matters",
    question: "Which ruleset does CBAMValid use for calculations?",
    aliases: [
      "CBAM calculation methodology",
      "versioned ruleset",
      "Regulation 2023/956 software",
    ],
    directAnswer:
      "Authoritative calculations pin to a named, versioned ruleset recorded in the sealed dossier. Historical sealed releases keep the ruleset they were built against; methods are not silently rewritten after sealing.",
    empathyContext:
      "When a verifier asks which rules you followed, vague “latest guidance” answers fail. You need a dated method reference inside the package itself.",
    evidence: [
      {
        label: "Primary legal family",
        detail: "Regulation (EU) 2023/956 and related implementing rules, cited where applied",
        href: "/methodology",
        evidenceStatus: "verified",
      },
      {
        label: "Method principle",
        detail: "Deterministic replay, provenance flags, and boundary discipline per installation/year",
        href: "/methodology",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/methodology", "/product"],
    relatedPaths: ["/methodology", "/cbam-methodology", "/sample-dossier"],
    schemaEligible: true,
  },
  {
    id: "definitive-period-2026",
    question: "When does the CBAM definitive period start, and what is the first declaration deadline for 2026 imports?",
    aliases: [
      "CBAM 2026 definitive period",
      "CBAM declaration deadline 2027",
      "CBAM certificate surrender deadline",
    ],
    directAnswer:
      "The CBAM definitive period applies from 1 January 2026. For 2026 imports, the first CBAM declaration and corresponding certificate surrender deadline is 30 September 2027.",
    empathyContext:
      "Mixing transitional quarterly reporting habits with definitive-period annual duties creates false deadlines and wasted work.",
    evidence: [
      {
        label: "Definitive period start",
        detail: "1 January 2026",
        href: "/cbam-2026-definitive-period",
        evidenceStatus: "verified",
      },
      {
        label: "First declaration deadline",
        detail: "30 September 2027 for 2026 imports",
        href: "/cbam-2026-definitive-period",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/", "/cbam-2026-definitive-period", "/cbam-non-eu-producer-guide"],
    relatedPaths: ["/cbam-certificate-price", "/cbam-verification-preparation"],
    schemaEligible: true,
  },
  {
    id: "embedded-emissions-calc",
    question: "How are CBAM embedded emissions calculated?",
    aliases: [
      "calculate CBAM embedded emissions",
      "direct and indirect CBAM emissions",
      "CBAM precursor emissions",
    ],
    directAnswer:
      "Embedded emissions combine direct process/combustion emissions and, where required by sector rules, electricity-related indirect emissions, plus applicable precursor emissions. For Annex II sectors (including iron and steel, aluminium, hydrogen, and electricity), only direct emissions enter the priced specific embedded emissions used for CBAM certificates; indirect emissions are disclosed but excluded from pricing. Installation countries outside CBAM scope (EU Member States and Annex III excluded territories) are hard-blocked before authoritative calculation or sealing. Missing material inputs must block authoritative results rather than becoming silent zeros.",
    empathyContext:
      "A wrong total under buyer pressure is worse than a blocked draft. Fail-closed calculation protects you in verification.",
    evidence: [
      {
        label: "Calculation guide",
        detail: "Direct, indirect, precursor, and allocation reconciliation rules",
        href: "/cbam-embedded-emissions-calculation",
        evidenceStatus: "verified",
      },
      {
        label: "Methodology index",
        detail: "Versioned rulesets and deterministic replay",
        href: "/methodology",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/cbam-embedded-emissions-calculation", "/methodology", "/cbam-methodology"],
    relatedPaths: ["/cbam-actual-vs-default-values", "/product"],
    schemaEligible: true,
  },
  {
    id: "actual-vs-default",
    question: "Should exporters use actual values or CBAM default values?",
    aliases: [
      "CBAM actual vs default",
      "when are actual values required",
      "CBAM default value risks",
    ],
    directAnswer:
      "Actual values reflect installation-specific monitored or calculated emissions and generally require independent verification where legally required. Default values are multi-dimensional official fallbacks — not a single universal CN number.",
    empathyContext:
      "Defaults can look easier until a buyer or verifier rejects them. Document the basis choice with evidence.",
    evidence: [
      {
        label: "Decision guide",
        detail: "Actual vs default decision utility",
        href: "/cbam-actual-vs-default-values",
        evidenceStatus: "verified",
      },
      {
        label: "Default dimensions",
        detail: "Country, route, and year dimensions where defined",
        href: "/cbam-default-values",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/cbam-actual-vs-default-values", "/cbam-default-values"],
    relatedPaths: ["/cbam-verification-preparation", "/methodology"],
    schemaEligible: true,
  },
  {
    id: "verification-preparation",
    question: "How do exporters prepare for independent CBAM verification?",
    aliases: [
      "CBAM verification preparation",
      "verifier readiness package",
      "operator dossier for verification",
    ],
    directAnswer:
      "Assemble complete, evidence-linked emissions data, methodology decisions, and closed material findings so an independent accredited verifier can perform assurance work. CBAMValid prepares the package; it does not issue the verification opinion.",
    empathyContext:
      "Verifiers need consistent, evidence-linked data — not a reconstructed email history.",
    evidence: [
      {
        label: "Preparation guide",
        detail: "Scope, evidence, calculation annex, findings closure",
        href: "/cbam-verification-preparation",
        evidenceStatus: "verified",
      },
      {
        label: "Evidence requirements",
        detail: "Hash, support status, and lineage fields",
        href: "/cbam-exporter-evidence-requirements",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/cbam-verification-preparation", "/cbam-exporter-evidence-requirements", "/sample-dossier"],
    relatedPaths: ["/sample-dossier", "/pricing", "/methodology"],
    schemaEligible: true,
  },
  {
    id: "spreadsheet-vs-preparation-pack",
    question: "Why not just send a spreadsheet when an EU buyer asks for CBAM evidence?",
    aliases: [
      "CBAM spreadsheet vs dossier",
      "Excel CBAM evidence package",
      "buyer rejected spreadsheet emissions",
    ],
    directAnswer:
      "A spreadsheet usually cannot prove evidence lineage, ruleset version, fail-closed quality controls, or an integrity hash. CBAMValid seals an operator-prepared dossier with calculation traces, evidence register, and immutable release hashes so a buyer or verifier can inspect what was locked.",
    empathyContext:
      "Buyer pressure often arrives before your files are audit-ready. The risk is not formatting — it is defending numbers without evidence, method pins, or a sealed integrity trail.",
    evidence: [
      {
        label: "Integrity manifest",
        detail: "Sealed packages include SHA-256 hashes, ruleset version, and seal timestamp",
        href: "/sample-dossier",
        evidenceStatus: "verified",
      },
      {
        label: "Fail-closed QC",
        detail: "Material blockers must clear before sealing; missing inputs are not silently zeroed",
        href: "/product",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/", "/product", "/how-it-works", "/sample-dossier"],
    relatedPaths: ["/sample-dossier", "/pricing", "/cbam-exporter-evidence-requirements"],
    schemaEligible: true,
  },
  {
    id: "one-pack-scope-lock",
    question: "Can one USD 449 payment cover a second plant or another reporting year?",
    aliases: [
      "CBAMValid multi plant pricing",
      "one pack two installations",
      "CBAMValid scope lock",
      "one payment many CBAM files",
    ],
    directAnswer: `No. ${PRICE} unlocks one working file: one legal operator, one production installation, and one reporting year, with same-file correction re-locks included. Another plant, year, or working file requires another payment.`,
    empathyContext:
      "Procurement teams often hope one purchase covers the group. Scope lock prevents silent widening that would break evidence and entitlement integrity.",
    evidence: [
      {
        label: "Commercial unit",
        detail: "1 operator + 1 installation + 1 reporting year per paid working file",
        href: "/pricing",
        evidenceStatus: "verified",
      },
      {
        label: "Correction & re-lock math",
        detail: "Failed locks charge nothing; re-download is free; corrections create new sealed versions on the same paid file",
        href: "/pricing",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/", "/pricing", "/product"],
    relatedPaths: ["/pricing", "/how-it-works"],
    schemaEligible: true,
  },
  {
    id: "buyer-asks-tomorrow",
    question: "What should I do first if my EU buyer asks for actual CBAM emissions evidence this week?",
    aliases: [
      "EU buyer asked for CBAM evidence urgently",
      "CBAM evidence request deadline",
      "start CBAM dossier today",
    ],
    directAnswer:
      "Start a free draft for one installation and one reporting year, confirm CN scope, enter production and emissions inputs you already have, link available evidence, and clear visible blockers. Pay once to lock that working file when you are ready to seal a handover package — drafting does not charge your card. Same-file corrections stay included; a new file needs a new payment.",
    empathyContext:
      "Urgent buyer emails create panic buys. The durable move is to make gaps visible first, then seal a defendable package — without claiming an accredited verification opinion.",
    evidence: [
      {
        label: "Draft policy",
        detail: CANONICAL_PRICING.draftPolicy,
        href: "/how-it-works",
        evidenceStatus: "verified",
      },
      {
        label: "CN scope hub",
        detail: "Confirm Annex I coverage before full evidence collection",
        href: "/cn-code",
        evidenceStatus: "verified",
      },
      {
        label: "2026 definitive period context",
        detail: "Definitive-period obligations raise the cost of delayed evidence readiness",
        href: "/cbam-2026-definitive-period",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/", "/how-it-works", "/cbam-non-eu-producer-guide", "/cbam-2026-definitive-period"],
    relatedPaths: ["/pricing", "/cn-code"],
    schemaEligible: true,
  },
  {
    id: "about-independence",
    question: "Is CBAMValid an official European Commission service?",
    aliases: ["CBAMValid official EU", "is CBAMValid accredited verifier"],
    directAnswer:
      "No. CBAMValid is an independent software service for exporter-to-importer evidence packaging. It is not an EU institution, customs authority, or accredited CBAM verifier.",
    empathyContext:
      "Procurement and legal teams need a clear independence boundary before they trust a vendor with emissions data.",
    evidence: [
      {
        label: "Independence notice",
        detail: "Published on About and product surfaces",
        href: "/about",
        evidenceStatus: "verified",
      },
      {
        label: "Support identity",
        detail: "Canonical support address info@cbamvalid.com",
        href: "/contact",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/about", "/contact", "/"],
    relatedPaths: ["/about", "/methodology", "/legal-notice"],
    schemaEligible: true,
  },
  {
    id: "structure-review-vs-opinion",
    question: "What is a CBAMValid structure review — and is it a verification opinion?",
    aliases: [
      "verifier structure review",
      "reviewed for structure",
      "CBAMValid accredited review",
    ],
    directAnswer:
      "A structure review assesses whether the Preparation Pack contains the data fields and evidence lineage a verification workflow needs. It is not a verification opinion, reasonable assurance, accreditation endorsement, EU approval, or customs decision. Canonical boundary: Reviewed for structure — not a verification opinion.",
    empathyContext:
      "Buyers fear package rejection more than arithmetic. Structure fitness and accredited verification are different trust signals — confusing them creates legal and commercial risk.",
    evidence: [
      {
        label: "Structure review surface",
        detail: "Public page maps package fields, target letter language, and legal boundary",
        href: "/verifier-review",
        evidenceStatus: "verified",
      },
      {
        label: "Structure Review Brief",
        detail: "Downloadable CBAMValid-owned brief for verification-body engagements",
        href: "/verifier-review/structure-review-brief.pdf",
        evidenceStatus: "verified",
      },
      {
        label: "Sample dossier",
        detail: "Gate-free package buyers and verifiers can inspect before outreach",
        href: "/sample-dossier",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/verifier-review", "/", "/about", "/methodology"],
    relatedPaths: ["/sample-dossier", "/verify", "/product"],
    schemaEligible: true,
  },
  {
    id: "structure-review-letter-language",
    question: "What letter language does CBAMValid request from verification bodies?",
    aliases: ["structure review letter", "IR 2025/2621 structure letter"],
    directAnswer:
      "Target language: We reviewed the CBAMValid Preparation Pack structure. It contains the data fields and evidence lineage required under IR 2025/2621 for our verification workflow. This is a structural review, not a verification opinion.",
    empathyContext:
      "Without a hard boundary sentence, a marketing page can be misread as assurance. The letter must stay structural.",
    evidence: [
      {
        label: "Published target letter",
        detail: "Exact wording on the structure review page",
        href: "/verifier-review",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/verifier-review"],
    relatedPaths: ["/sample-dossier", "/methodology"],
    schemaEligible: true,
  },
  {
    id: "published-rulesets-pin",
    question: "Does CBAMValid publish the rulesets used in sealed packages?",
    aliases: ["ruleset registry", "which ruleset version", "source hash pin"],
    directAnswer:
      "Yes. CBAMValid publishes a public ruleset registry with named versions, active dates, source-registry hashes, and linked official sources. Every sealed package pins a named ruleset. Historical seals keep the ruleset they were built against. Publishing the registry is not an accredited verification opinion.",
    empathyContext:
      "Verifiers and buyers ask which rules applied. A dated, named pin beats a vague “latest methodology” claim.",
    evidence: [
      {
        label: "Published rulesets page",
        detail: "Public registry of transitional and definitive rulesets",
        href: "/rulesets",
        evidenceStatus: "verified",
      },
      {
        label: "Methodology page",
        detail: "How calculations pin to a ruleset",
        href: "/methodology",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/rulesets", "/methodology", "/platform"],
    relatedPaths: ["/sample-dossier", "/verify"],
    schemaEligible: true,
  },
  {
    id: "buyer-share-link",
    question: "How does a CBAMValid buyer share link work?",
    aliases: ["/d/token", "buyer token URL", "share sealed dossier link"],
    directAnswer:
      "After lock, a public token URL opens the sealed release summary. Short form /d/<token> aliases the canonical /verify/<token> view. The buyer can inspect integrity and download for authorized tokens without logging in. A successful open is integrity and preparation status only — not an accredited verification opinion.",
    empathyContext:
      "EU buyers need a single link, not email-attachment chaos. The link must stay an integrity surface, not fake assurance.",
    evidence: [
      {
        label: "Buyer share link explainer",
        detail: "How /d/token and /verify/token relate",
        href: "/buyer-link",
        evidenceStatus: "verified",
      },
      {
        label: "Public verify",
        detail: "Hash and token verification entry",
        href: "/verify",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/buyer-link", "/verify"],
    relatedPaths: ["/sample-dossier", "/security"],
    schemaEligible: true,
  },
  {
    id: "security-no-fake-iso",
    question: "Does CBAMValid claim ISO 27001 or SOC 2 certification?",
    aliases: ["ISO 27001", "SOC 2", "security certification", "DPA"],
    directAnswer:
      "No. The security page publishes hosting region (europe-west1), TLS, session model, encryption-at-rest defaults, subprocessors, and a DPA draft. ISO 27001 and SOC 2 are not claimed. Certificates will be published only with issuer, scope, and validity dates.",
    empathyContext:
      "Procurement needs facts. “In progress” certification language is a trust defect.",
    evidence: [
      {
        label: "Security page",
        detail: "Published security facts and certification honesty",
        href: "/security",
        evidenceStatus: "verified",
      },
      {
        label: "DPA draft PDF",
        detail: "Procurement starting-point draft, not a signed agreement",
        href: "/security/dpa-draft.pdf",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/security", "/privacy"],
    relatedPaths: ["/contact", "/legal-notice", "/trust"],
    schemaEligible: true,
  },
  {
    id: "trust-evidence-registry",
    question: "How does CBAMValid prove marketing claims without inventing evidence?",
    aliases: [
      "trust registry",
      "CRO VAT published",
      "fake logos",
      "proof chain",
      "evidence status",
    ],
    directAnswer:
      "CBAMValid publishes a Trust Evidence Registry at /trust. Public claims link to published evidence, source-backed code, a watermarked sample, or an explicit non-claim. Legal identity is published in the legal notice. /case-studies uses anonymized illustrative scenarios — not named logos. Sample documents are specimens, not certificates.",
    empathyContext:
      "Procurement teams reverse-engineer claims. Invented identity destroys enterprise deals permanently.",
    evidence: [
      {
        label: "Trust Evidence Registry",
        detail: "Pinned claim statuses for identity, commercial, structure, and customer layers",
        href: "/trust",
        evidenceStatus: "verified",
      },
      {
        label: "Legal notice",
        detail: "Published identity block — CRO, VAT, address, phone, and DPO contact",
        href: "/legal-notice",
        evidenceStatus: "verified",
      },
      {
        label: "Structure review SAMPLE",
        detail: "Watermarked specimen — SAMPLE status, not a verification opinion",
        href: "/verifier-review",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/trust", "/legal-notice", "/case-studies"],
    relatedPaths: ["/security", "/verifier-review", "/pricing", "/enterprise"],
    schemaEligible: true,
  },
  {
    id: "platform-cbam-first",
    question: "Is CBAMValid only a calculator, or a broader compliance platform?",
    aliases: ["category architecture", "second product", "EUDR CSRD"],
    directAnswer:
      "CBAMValid is a sealed, evidence-linked, version-pinned compliance package architecture. The live ruleset family is EU CBAM. Additional regimes can reuse the package contract later — they are not sold until CBAM leadership and opening conditions justify them. No second regulated product is live today.",
    empathyContext:
      "Architecture honesty beats vaporware roadmaps. Door = CBAM; room is larger only when earned.",
    evidence: [
      {
        label: "Platform architecture page",
        detail: "CBAM-first category statement",
        href: "/platform",
        evidenceStatus: "verified",
      },
      {
        label: "Published rulesets",
        detail: "Live CBAM ruleset registry",
        href: "/rulesets",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/platform", "/"],
    relatedPaths: ["/product", "/methodology", "/enterprise"],
    schemaEligible: true,
  },
  {
    id: "enterprise-exclusive",
    question: "What does CBAMValid Enterprise Exclusive include?",
    aliases: ["Enterprise SSO", "SLA", "holding multi-entity", "from 12000"],
    directAnswer:
      "Enterprise Exclusive starts from USD 12,000 per year (contact sales). It includes contracted SSO/IdP federation (Entra, Google, Okta), SLA draft and signed MSA path, holding/multi-entity entitlement, signed DPA path, API/onboarding, and verifier coordination. Not an accredited verification opinion. Single Pack remains self-serve at USD 449.",
    empathyContext:
      "Multi-site buyers need procurement-grade SSO and SLA — not another self-serve checkbox.",
    evidence: [
      {
        label: "Enterprise Exclusive",
        detail: "SSO · SLA · Holding commercial package",
        href: "/enterprise",
        evidenceStatus: "verified",
      },
      {
        label: "SLA draft PDF",
        detail: "Procurement starting-point draft",
        href: "/enterprise/sla-draft.pdf",
        evidenceStatus: "verified",
      },
      {
        label: "SSO page",
        detail: "OIDC/SAML provisioning path",
        href: "/enterprise/sso",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/enterprise", "/pricing", "/demo"],
    relatedPaths: ["/enterprise/holding", "/partners", "/security"],
    schemaEligible: true,
  },
  {
    id: "enterprise-sso",
    question: "Does CBAMValid Enterprise support SSO with Entra, Google, or Okta?",
    aliases: ["Enterprise SAML", "OIDC", "IdP federation", "Microsoft Entra"],
    directAnswer:
      "Yes under Enterprise contract. CBAMValid federates Microsoft Entra ID, Google Workspace, or Okta via OIDC or SAML. After IdP login, the server still issues an HttpOnly session cookie and enforces tenant/case authorization. SSO is not included on self-serve Single Pack.",
    empathyContext:
      "IT security blocks SaaS tools that cannot join the corporate IdP. Checkbox “SSO coming soon” fails procurement.",
    evidence: [
      {
        label: "Enterprise SSO page",
        detail: "Protocols, IdP examples, and provisioning steps",
        href: "/enterprise/sso",
        evidenceStatus: "verified",
      },
      {
        label: "Security session model",
        detail: "Server-verified HttpOnly __session remains authoritative",
        href: "/security",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/enterprise", "/enterprise/sso", "/demo", "/security"],
    relatedPaths: ["/enterprise/holding", "/pricing"],
    schemaEligible: true,
  },
  {
    id: "enterprise-sla",
    question: "Does CBAMValid publish an Enterprise SLA?",
    aliases: ["service level agreement", "uptime", "support response"],
    directAnswer:
      "Yes. CBAMValid publishes an Enterprise SLA draft with response targets for critical, high, and normal issues, plus an honest uptime posture based on Google Cloud / Firebase europe-west1. Binding credits live only in a signed Enterprise MSA. ISO 27001 and SOC 2 are not claimed.",
    empathyContext:
      "Procurement packs need downloadable SLA language before legal review — not a vague “we take uptime seriously” sentence.",
    evidence: [
      {
        label: "SLA draft PDF",
        detail: "Public procurement starting point",
        href: "/enterprise/sla-draft.pdf",
        evidenceStatus: "verified",
      },
      {
        label: "DPA draft PDF",
        detail: "Companion data-protection draft",
        href: "/security/dpa-draft.pdf",
        evidenceStatus: "verified",
      },
      {
        label: "Security facts",
        detail: "Hosting region and subprocessors without fake certifications",
        href: "/security",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/enterprise", "/security", "/demo"],
    relatedPaths: ["/enterprise/sso", "/privacy"],
    schemaEligible: true,
  },
  {
    id: "enterprise-holding",
    question: "Can a holding company cover multiple operators and installations?",
    aliases: ["multi-entity", "group exporters", "multi-site entitlement"],
    directAnswer:
      "Enterprise entitlement can sit at holding level while each sealed working file still binds one operator, one installation, and one reporting year. Cross-entity clones do not inherit payment unless the SOW says so. Roles include Holding Admin, Operator Preparer, Internal Reviewer, and Read-Only Verifier.",
    empathyContext:
      "Groups fear either paying forever per plant or blurring legal scope so verifiers reject the package.",
    evidence: [
      {
        label: "Holding scope page",
        detail: "Parent/child rules and seal-unit discipline",
        href: "/enterprise/holding",
        evidenceStatus: "verified",
      },
      {
        label: "Pricing tiers",
        detail: "Enterprise vs Single Pack scope contrast",
        href: "/pricing",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/enterprise", "/enterprise/holding", "/pricing", "/demo"],
    relatedPaths: ["/enterprise/sso", "/sample-dossier"],
    schemaEligible: true,
  },
  {
    id: "enterprise-vs-single-pack",
    question: "When should I buy Single Pack instead of Enterprise Exclusive?",
    aliases: ["449 vs 12000", "self-serve vs contact sales", "one plant"],
    directAnswer:
      "Choose Single Pack (USD 449 pay-at-lock) for one working file — one operator, one installation, one reporting year — with same-file corrections included. Choose Enterprise Exclusive (from USD 12,000/year, contact sales) when you need SSO, SLA/DPA path, holding/multi-entity entitlement, API/onboarding, or coordinated multi-site rollout.",
    empathyContext:
      "Buying Enterprise for a single plant wastes budget; buying Single Pack for a group IdP requirement fails IT review.",
    evidence: [
      {
        label: "Public pricing",
        detail: "Four tiers with Enterprise as the only contact-sales tier",
        href: "/pricing",
        evidenceStatus: "verified",
      },
      {
        label: "Enterprise Exclusive",
        detail: "SSO · SLA · Holding module map",
        href: "/enterprise",
        evidenceStatus: "verified",
      },
      {
        label: "Sample dossier",
        detail: "Inspect the self-serve package before you pay",
        href: "/sample-dossier",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/enterprise", "/pricing", "/", "/demo"],
    relatedPaths: ["/how-it-works", "/trust"],
    schemaEligible: true,
  },
  {
    id: "enterprise-platform-modules",
    question: "Which Enterprise platform capabilities can buyers inspect?",
    aliases: ["published rulesets", "buyer link", "security SLA", "platform architecture"],
    directAnswer:
      "Buyers can inspect published rulesets, the buyer share-link integrity flow, security and procurement documents, and the platform architecture before a scoping call. Additional regulatory categories beyond CBAM remain Enterprise statement-of-work only.",
    empathyContext:
      "Enterprise buyers reject vaporware roadmaps. Modules must be inspectable before a scoping call.",
    evidence: [
      {
        label: "Published rulesets",
        detail: "Version-pinned CBAM ruleset registry",
        href: "/rulesets",
        evidenceStatus: "verified",
      },
      {
        label: "Buyer share link",
        detail: "/d/token integrity surface",
        href: "/buyer-link",
        evidenceStatus: "verified",
      },
      {
        label: "Platform architecture",
        detail: "CBAM door live; expansion under Enterprise SOW",
        href: "/platform",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/enterprise", "/platform", "/rulesets", "/buyer-link"],
    relatedPaths: ["/security", "/partners"],
    schemaEligible: true,
  },
  {
    id: "enterprise-partners",
    question: "How do channel partners engage with CBAMValid Enterprise?",
    aliases: ["referral partner", "verifier firm partner", "consultancy partner"],
    directAnswer:
      "Verifier firms, consultancies, and trade associations can request a partner track on /partners. Logos are published only after a signed referral agreement. Partner status does not create an accredited verification endorsement.",
    empathyContext:
      "Channel scale requires contracts — invented partner walls destroy trust.",
    evidence: [
      {
        label: "Partner intake",
        detail: "Live inquiry form — logos only after contract",
        href: "/partners",
        evidenceStatus: "verified",
      },
      {
        label: "Structure review",
        detail: "SAMPLE package-fitness surface for verifier discussion",
        href: "/verifier-review",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/enterprise", "/partners", "/demo"],
    relatedPaths: ["/verifier-review", "/sample-dossier"],
    schemaEligible: true,
  },
  {
    id: "pricing-four-tiers",
    question: "What are CBAMValid’s published pricing tiers?",
    aliases: ["Enterprise contact sales", "Exporter Annual", "Single Pack 449"],
    directAnswer:
      "Draft is $0. Single Pack is USD 449 one-time pay-at-lock for one working file. Exporter Annual is USD 2,400 per year. Enterprise is from USD 12,000 per year and is the only contact-sales tier. Not an accredited verification opinion.",
    empathyContext:
      "Procurement needs published prices. Hiding everything behind “contact sales” fails the public-pricing rule.",
    evidence: [
      {
        label: "Pricing page",
        detail: "Four published tiers + ROI calculator",
        href: "/pricing",
        evidenceStatus: "verified",
      },
      {
        label: "Book a demo",
        detail: "Human path for Annual and Enterprise",
        href: "/demo",
        evidenceStatus: "verified",
      },
      {
        label: "Enterprise Exclusive",
        detail: "Contact-sales package detail",
        href: "/enterprise",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/pricing", "/demo", "/", "/enterprise"],
    relatedPaths: ["/how-it-works", "/security"],
    schemaEligible: true,
  },
  {
    id: "product-deterministic-engine",
    question: "Is the CBAMValid calculation engine deterministic and replayable?",
    aliases: [
      "deterministic CBAM calculation",
      "calculation trace SHA-256",
      "replayable embedded emissions",
    ],
    directAnswer:
      "Yes. Authoritative calculations run server-side and are replayable: same case snapshot, same ruleset, and same engine version produce the same outputs and node hashes. Every authoritative node records formula identity, inputs, units, conversions, and a SHA-256 node hash.",
    empathyContext:
      "Verifier questions collapse spreadsheets that cannot reproduce a figure. Replayability is what lets you defend a number weeks later.",
    evidence: [
      {
        label: "Product capabilities",
        detail: "Deterministic calculation engine with full calculation trace",
        href: "/product",
        evidenceStatus: "verified",
      },
      {
        label: "Methodology & sources",
        detail: "Versioned method citations travel with sealed releases",
        href: "/methodology",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/product", "/methodology", "/"],
    relatedPaths: ["/sample-dossier", "/rulesets"],
    schemaEligible: true,
  },
  {
    id: "product-evidence-register",
    question: "How does the CBAMValid evidence register work?",
    aliases: [
      "CBAM evidence register software",
      "link evidence to calculation nodes",
      "evidence coverage visible",
    ],
    directAnswer:
      "Evidence objects store file identity, SHA-256 hash, size, path ownership, review status, and support status, and link to the calculation nodes they support. Coverage is visible in the working file — not assumed. Missing, rejected, unsupported, or hash-mismatched evidence blocks sealing.",
    empathyContext:
      "Buyers and verifiers ask which document supports which figure. An unlinked folder of PDFs is not an evidence register.",
    evidence: [
      {
        label: "Product evidence register",
        detail: "Node-linked evidence with support and review status",
        href: "/product",
        evidenceStatus: "verified",
      },
      {
        label: "Exporter evidence requirements",
        detail: "Hash, support status, and lineage fields",
        href: "/cbam-exporter-evidence-requirements",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/product", "/cbam-exporter-evidence-requirements", "/sample-dossier"],
    relatedPaths: ["/how-it-works", "/methodology"],
    schemaEligible: true,
  },
  {
    id: "product-fail-closed-qc",
    question: "What quality controls run before a CBAMValid seal?",
    aliases: [
      "CBAM fail-closed QC",
      "seal blockers",
      "automated quality controls CBAM",
    ],
    directAnswer: `${QC_RULE_FAMILIES} automated QC rule families run against EU guidance — including unit consistency, boundary completeness, allocation balance, and default-value flagging. Material blockers must be resolved before sealing. Missing inputs are not silently converted to zero.`,
    empathyContext:
      "A package that seals with open blockers creates verifier friction and buyer rejection risk. Fail-closed is the durable path.",
    evidence: [
      {
        label: "Product QC capabilities",
        detail: `${QC_RULE_FAMILIES} rule families · always on before seal`,
        href: "/product",
        evidenceStatus: "verified",
      },
      {
        label: "Workflow",
        detail: "Clear blockers in the working file before pay-at-lock",
        href: "/how-it-works",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/product", "/how-it-works", "/"],
    relatedPaths: ["/sample-dossier", "/methodology"],
    schemaEligible: true,
  },
  {
    id: "product-o3ci-export",
    question: "Does CBAMValid provide an O3CI field-mapped export?",
    aliases: [
      "O3CI field-mapped structured data export",
      "CBAM installation communication template export",
      "official Registry XML CBAMValid",
    ],
    directAnswer:
      "Yes. CBAMValid produces an O3CI field-mapped structured data export (XLSX) aligned to the installation communication template circulating in EU supply chains. It is not an official CBAM Registry XML submission and does not claim customs or registry acceptance.",
    empathyContext:
      "Buyers often ask for field-mapped data they can reuse without re-typing. Naming the export correctly prevents false “Registry XML” claims.",
    evidence: [
      {
        label: "Product export capability",
        detail: "O3CI field-mapped XLSX — not official Registry XML",
        href: "/product",
        evidenceStatus: "verified",
      },
      {
        label: "Independence boundary",
        detail: "Not a customs authority or Registry submission service",
        href: "/methodology",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/product", "/sample-dossier", "/methodology"],
    relatedPaths: ["/pricing", "/how-it-works"],
    schemaEligible: true,
  },
  {
    id: "product-seal-integrity",
    question: "How does CBAMValid sealing and integrity hashing work?",
    aliases: [
      "SHA-256 sealed dossier",
      "integrity manifest CBAM",
      "verify sealed package hash",
    ],
    directAnswer:
      "On sealing, deliverables are hashed (SHA-256), timestamped, and recorded in a data integrity manifest. Prior sealed releases remain immutable. Anyone holding the dossier can confirm bytes were not altered after the seal via the public verify path.",
    empathyContext:
      "Without a sealed integrity trail, a buyer cannot tell whether a file changed after handover. Hash + timestamp is the operational proof.",
    evidence: [
      {
        label: "Product sealing",
        detail: "SHA-256 · UTC seal · integrity manifest",
        href: "/product",
        evidenceStatus: "verified",
      },
      {
        label: "Verify a dossier",
        detail: "Public hash verification surface",
        href: "/verify",
        evidenceStatus: "verified",
      },
      {
        label: "Sample dossier",
        detail: "Inspect sealed structure before you pay",
        href: "/sample-dossier",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/product", "/verify", "/sample-dossier"],
    relatedPaths: ["/trust", "/how-it-works"],
    schemaEligible: true,
  },
  {
    id: "readiness-kit-time",
    question: "How long does CBAMValid preparation take?",
    aliases: ["readiness checklist", "pre-flight spreadsheet"],
    directAnswer:
      "Honest time: 2–4 hours if your data is ready. 2–3 weeks if starting from zero. Use the readiness checklist and downloadable pre-flight XLSX before opening a working file.",
    empathyContext:
      "False “instant CBAM” claims create failed seals. Time honesty reduces buyer deadline panic.",
    evidence: [
      {
        label: "How it works",
        detail: "Readiness checklist at the top of the workflow page",
        href: "/how-it-works",
        evidenceStatus: "verified",
      },
      {
        label: "Pre-flight XLSX",
        detail: "Plant-fillable checklist workbook",
        href: "/onboarding/cbamvalid-preflight-checklist.xlsx",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/how-it-works", "/product"],
    relatedPaths: ["/pricing", "/sample-dossier"],
    schemaEligible: true,
  },
  {
    id: "case-studies-permissioned",
    question: "Where are CBAMValid customer case studies?",
    aliases: ["customer logos", "testimonials", "named references", "illustrative scenarios"],
    directAnswer:
      "CBAMValid publishes anonymized illustrative sector scenarios on /case-studies (steel, aluminium, holding, cement). Named company logos and quotes publish only with written permission. Invented testimonials remain forbidden.",
    empathyContext:
      "Field realism without fake logos. Buyers recognize anonymized pressure paths; procurement rejects invented praise strips.",
    evidence: [
      {
        label: "Illustrative scenarios",
        detail: "Four anonymized sector working-file paths — no company names",
        href: "/case-studies",
        evidenceStatus: "verified",
      },
      {
        label: "Sample dossier",
        detail: "Inspect sealed deliverables before you pay",
        href: "/sample-dossier",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/case-studies", "/about", "/"],
    relatedPaths: ["/sample-dossier", "/product", "/enterprise"],
    schemaEligible: true,
  },
  {
    id: "what-is-idp-msa",
    question: "What do IdP and MSA mean for CBAMValid Enterprise SSO?",
    aliases: ["identity provider", "master service agreement", "SSO Entra Okta"],
    directAnswer:
      "IdP means Identity Provider — your company login (Microsoft Entra ID, Google Workspace, or Okta). MSA means Master Service Agreement — the signed Enterprise contract covering pricing, SLA, DPA, and which domains are in scope. SSO is enabled after that contract; it is not on Single Pack.",
    empathyContext:
      "Procurement jargon blocks deals. Plain labels unblock Enterprise scoping.",
    evidence: [
      {
        label: "Enterprise SSO page",
        detail: "Plain-English IdP/MSA glossary + cutover simulation",
        href: "/enterprise/sso",
        evidenceStatus: "verified",
      },
      {
        label: "Enterprise Exclusive",
        detail: "SSO · SLA · Holding package overview",
        href: "/enterprise",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/enterprise/sso", "/enterprise", "/demo"],
    relatedPaths: ["/security", "/pricing"],
    schemaEligible: true,
  },
] as const;

export function listAnswersForRoute(path: string): AeoAnswerRecord[] {
  const exact = AEO_ANSWER_BANK.filter((answer) => answer.routes.includes(path));
  if (exact.length >= 3) return exact;

  // Enterprise child surfaces inherit the parent cluster so AEO grids never collapse to one card.
  if (path.startsWith("/enterprise/")) {
    const parent = AEO_ANSWER_BANK.filter((answer) => answer.routes.includes("/enterprise"));
    const seen = new Set(exact.map((answer) => answer.id));
    return [...exact, ...parent.filter((answer) => !seen.has(answer.id))];
  }

  if (path === "/partners") {
    const related = AEO_ANSWER_BANK.filter((answer) =>
      answer.routes.some((route) => route === "/enterprise" || route === "/verifier-review")
    );
    const seen = new Set(exact.map((answer) => answer.id));
    return [...exact, ...related.filter((answer) => !seen.has(answer.id))];
  }

  return exact;
}

export function listSchemaFaqsForRoute(path: string): { question: string; answer: string }[] {
  return listAnswersForRoute(path)
    .filter((answer) => answer.schemaEligible)
    .map((answer) => ({
      question: answer.question,
      answer: `${answer.directAnswer} ${answer.empathyContext}`,
    }));
}

export function getPrimaryAnswerForRoute(path: string): AeoAnswerRecord | undefined {
  return listAnswersForRoute(path)[0];
}
