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
    relatedPaths: ["/pricing", "/credits/buy"],
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
      "Actual values reflect installation-specific monitored or calculated emissions. Under Regulation (EU) 2025/2083 recital (19), verification of embedded emissions applies to actual values — not to default-value declarations. Default values are multi-dimensional official fallbacks. If a buyer accepts defaults, the commercial pressure to prepare an evidence-linked actual-value dossier can disappear.",
    empathyContext:
      "Defaults can look easier until a buyer still demands actuals — or until they accept defaults and your preparation work suddenly has no buyer. Document the basis choice with evidence.",
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
    id: "sealed-verifier-package-boundary",
    question: "What is in a sealed CBAMValid verifier package versus the operator Master Record?",
    aliases: [
      "CBAMValid 25 file package",
      "Enterprise Compliance Master Record",
      "verifier ZIP vs Master Record",
      "what does a sealed CBAMValid dossier contain",
    ],
    directAnswer:
      "A live seal ships two separate downloads. The Complete Signed Verifier Dossier ZIP contains 25 verifier-facing controlled files. Directory entries are not counted, and Enterprise Compliance Master Record.pdf is a separate Operator Corporate Record — not a ZIP member. Customer-facing scores, state and calendar use the seal generatedAt clock.",
    empathyContext:
      "Mixing the operator corporate record into the verifier ZIP, or counting a folder as a file, produces a false inventory. Buyers and verifiers need a stable 25-file contract.",
    evidence: [
      {
        label: "Sample structure",
        detail: "Public PDF/JSON/XLSX preview; live seals follow the 25-file ZIP plus separate Master Record",
        href: "/sample-dossier",
        evidenceStatus: "verified",
      },
      {
        label: "Product capabilities",
        detail: "Verifier ZIP and operator Master Record are separate downloads after lock-and-seal",
        href: "/product",
        evidenceStatus: "verified",
      },
      {
        label: "Integrity check",
        detail: "SHA-256 / signature verify confirms bytes, not accredited verification",
        href: "/verify",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/", "/product", "/sample-dossier", "/how-it-works", "/verify"],
    relatedPaths: ["/cbam-verification-preparation", "/pricing"],
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
      "No. The security page publishes hosting region (europe-west1), TLS, session model, encryption-at-rest defaults, a GDPR Art. 28 subprocessors inventory, support response targets, service-status dependency facts, and a DPA draft. ISO 27001 and SOC 2 are not claimed. Certificates will be published only with issuer, scope, and validity dates.",
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
    routes: ["/security", "/privacy", "/status"],
    relatedPaths: ["/contact", "/legal-notice", "/trust", "/status"],
    schemaEligible: true,
  },
  {
    id: "subprocessors-art28",
    question: "Which subprocessors does CBAMValid use?",
    aliases: ["subprocessors", "sub-processors", "GDPR Article 28", "Art. 28"],
    directAnswer:
      "The Security page lists Google Cloud / Firebase (including Cloud Logging and Authentication email), Google App Check / reCAPTCHA, Google Analytics 4 when consent is granted, and Paddle (including Paddle Retain / ProfitWell where active). No separate ESP or Sentry-class APM is currently engaged.",
    empathyContext:
      "Article 28 transparency fails when only hosting and payments are named while analytics and mail still process personal data.",
    evidence: [
      {
        label: "Security subprocessors table",
        detail: "Art. 28 inventory with categories and personal-data notes",
        href: "/security",
        evidenceStatus: "verified",
      },
      {
        label: "Privacy notice",
        detail: "Points to the same inventory and states absent ESP/Sentry",
        href: "/privacy",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/security", "/privacy"],
    relatedPaths: ["/status", "/contact", "/trust"],
    schemaEligible: true,
  },
  {
    id: "status-no-fake-uptime",
    question: "Does CBAMValid publish a status page or uptime SLA?",
    aliases: ["status page", "uptime", "SLA", "availability"],
    directAnswer:
      "Yes for dependency facts: /status links Google Cloud and Firebase status boards and explains europe-west1 runtime dependency. No contractual uptime percentage and no third-party status vendor are claimed.",
    empathyContext:
      "Procurement asks for status and SLA. Green badges without monitoring are a trust defect.",
    evidence: [
      {
        label: "Status page",
        detail: "Dependency facts and incident contact",
        href: "/status",
        evidenceStatus: "verified",
      },
      {
        label: "Support targets",
        detail: "P0–P3 response targets on Security — not an uptime warranty",
        href: "/security",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/status", "/security", "/contact"],
    relatedPaths: ["/trust", "/privacy"],
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
      "OWNER ACTION",
    ],
    directAnswer:
      "CBAMValid publishes a Trust Evidence Registry at /trust. Each marketing claim is tagged VERIFIED, CODE PROVEN, SAMPLE, EMPTY BY DESIGN, OWNER ACTION, or EXTERNAL BLOCKER. Legal identity is published: SectorCalc Corporation (CBAMValid), CRO 315881, VAT IE1857162AB, Dublin registered address, support phone, and DPO contact. /case-studies publishes anonymized illustrative scenarios — not named logos. SAMPLE documents are watermarked specimens — not certificates.",
    empathyContext:
      "Procurement teams reverse-engineer claims. Invented identity destroys enterprise deals permanently.",
    evidence: [
      {
        label: "Trust Evidence Registry",
        detail: "Pinned claim statuses for identity, commercial, security, and customer layers",
        href: "/trust",
        evidenceStatus: "verified",
      },
      {
        label: "Legal notice",
        detail: "Full T1.3 identity block — CRO, VAT, address, phone, DPO",
        href: "/legal-notice",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/trust", "/legal-notice", "/case-studies"],
    relatedPaths: ["/security", "/pricing"],
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
    relatedPaths: ["/product", "/methodology"],
    schemaEligible: true,
  },
  {
    id: "omnibus-de-minimis-demand",
    question: "Did the CBAM Omnibus 50-tonne threshold remove most importer demand for exporter dossiers?",
    aliases: [
      "CBAM 50 tonne de minimis",
      "Regulation 2025/2083 importer exemption",
      "who still needs CBAM preparation software",
    ],
    directAnswer:
      "Regulation (EU) 2025/2083 introduces a 50-tonne cumulative mass de minimis threshold for cement, fertilisers, iron and steel, and aluminium. EUR-Lex recital (5) says the vast majority of importers are exempt while at least 99% of embedded emissions remain in scope. Exporter preparation demand is driven mainly by buyers that still need actual-value evidence for above-threshold chains — not by every small exempted importer. CBAMValid does not invent a precise “~90% of importers” figure beyond that recital language.",
    empathyContext:
      "Mass-market “every importer needs a dossier” messaging is false after Omnibus. Honest demand is buyer-driven and concentrated where obligations and actual values still matter.",
    evidence: [
      {
        label: "Trust demand boundary",
        detail: "Published Omnibus / demand facts without invented percentages",
        href: "/trust",
        evidenceStatus: "verified",
      },
      {
        label: "EUR-Lex 2025/2083",
        detail: "Omnibus amending Regulation (EU) 2023/956",
        href: "https://eur-lex.europa.eu/eli/reg/2025/2083/oj/eng",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/trust", "/product", "/cbam-2026-definitive-period"],
    relatedPaths: ["/cbam-actual-vs-default-values", "/pricing"],
    schemaEligible: true,
  },
  {
    id: "ruleset-pin-vs-drift",
    question: "Does a pinned CBAMValid ruleset stay “current law” forever, and are re-locks unlimited free remakes?",
    aliases: [
      "ruleset drift",
      "pinned ruleset outdated",
      "same-file re-lock regulatory change",
    ],
    directAnswer:
      "No. A sealed release pins a named ruleset, engine version, and legal-source registry hash and stays immutable. Later implementing or delegated acts do not rewrite historical seals. CBAMValid does not claim 24/7 automated EUR-Lex surveillance. Same-file correction re-locks cover ordinary data/evidence corrections on the paid working file — not an unlimited free obligation to re-engineer every mid-year methodology change.",
    empathyContext:
      "Pinning without honesty becomes a silent stale-file trap. Buyers and verifiers need to know which ruleset was locked — and that “current” requires continued monitoring.",
    evidence: [
      {
        label: "Published rulesets",
        detail: "Named, dated, pinned registry with drift notice",
        href: "/rulesets",
        evidenceStatus: "verified",
      },
      {
        label: "Commercial correction scope",
        detail: "Ordinary same-file corrections vs regulatory remakes",
        href: "/pricing",
        evidenceStatus: "verified",
      },
    ],
    routes: ["/rulesets", "/pricing", "/trust"],
    relatedPaths: ["/product", "/methodology"],
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
      "Authoritative calculations are deterministic and replayable: same case snapshot, same ruleset, and same engine version produce the same outputs and node hashes. Every authoritative node records formula identity, inputs, units, conversions, and a SHA-256 node hash. Deterministic reproducibility is not a third-party code or calculation audit — no independent engine assurance opinion is published.",
    empathyContext:
      "Verifier questions collapse spreadsheets that cannot reproduce a figure. Replayability helps you defend a number; it does not replace an accredited verifier’s recomputation or an external software audit you do not have.",
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
    relatedPaths: ["/sample-dossier", "/product"],
    schemaEligible: true,
  },
] as const;

export function listAnswersForRoute(path: string): AeoAnswerRecord[] {
  const exact = AEO_ANSWER_BANK.filter((answer) => answer.routes.includes(path));
  if (exact.length >= 3) return exact;

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
