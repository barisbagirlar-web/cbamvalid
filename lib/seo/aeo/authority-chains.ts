import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import type { AuthorityChainRecord } from "./types";

const PRICE = CANONICAL_PRICING.priceFormatted;
const PACK = CANONICAL_PRICING.packName;

const EXPERT_BLOCK =
  "Calculation logic is reviewed against EU CBAM mathematical rules by Prof. Dr. Neela Nataraj (Department of Mathematics, Indian Institute of Technology Bombay). That review supports mathematical integrity of engines and allocation logic — it is not an accredited CBAM verification opinion, EU approval, or customs acceptance.";

/**
 * Authority chains for critical public URLs.
 * Additive SEO content SSOT — does not alter calculation, auth, or commerce engines.
 */
export const AUTHORITY_CHAINS: readonly AuthorityChainRecord[] = [
  {
    path: "/",
    primaryQuestion: "What should a non-EU exporter prepare when an EU buyer asks for actual CBAM emissions evidence?",
    empathyLead:
      "Buyer pressure arrives before your evidence package is ready. You need a defendable dossier for one plant and one year — without pretending the software issued an accredited verification opinion.",
    directAnswer: `${PRICE} unlocks lock-and-download for one working file: one legal operator, one installation, one reporting year — unlimited drafts and same-file correction re-locks. CBAMValid prepares an evidence-linked operator dossier for independent accredited verification — it does not verify emissions itself.`,
    calculation:
      "Authoritative embedded-emissions results run server-side against a named, versioned ruleset. Missing material inputs block sealing; they are never silently converted to zero. Client previews stay advisory until a successful seal.",
    explanation:
      "Define scope, enter goods and production data, link evidence, clear fail-closed quality blockers, pay once to lock that working file, then download immutable PDF/JSON/O3CI field-mapped exports. Same-file corrections stay included; another plant or year needs another payment.",
    methodology:
      "Methods pin to Regulation (EU) 2023/956 and related implementing rules recorded in the sealed package. Historical seals keep the ruleset they were built against.",
    evidence:
      "Material values require evidence lineage (hash, size, support status). Sealing requires approved and fully supported evidence; partially supported is not enough.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "What does the USD 449 pack include?", href: "/pricing", why: "Commercial scope and release math" },
      { question: "How does the draft-to-seal workflow work?", href: "/how-it-works", why: "Operational steps" },
      { question: "Which calculation methodology is used?", href: "/methodology", why: "Ruleset and replay" },
      { question: "What changed for the 2026 definitive period?", href: "/cbam-2026-definitive-period", why: "Deadline fan-out" },
    ],
    entities: [
      "CBAMValid",
      "Exporter Verification Preparation Pack",
      "embedded emissions",
      "independent accredited verification",
      "Regulation (EU) 2023/956",
    ],
    fanOutQueries: [
      "CBAM exporter evidence dossier",
      "CBAM verification preparation software",
      "actual embedded emissions package for EU buyer",
      "CBAM sealed dossier vs verification opinion",
    ],
  },
  {
    path: "/product",
    primaryQuestion: "What capabilities does the Exporter Verification Preparation Pack provide?",
    empathyLead:
      "Spreadsheets break under verifier questions. You need deterministic calculations, an evidence register, and fail-closed QC before you hand anything over.",
    directAnswer:
      "The pack provides a scoped working file with deterministic embedded-emissions calculations, evidence register, quality controls, methodology decisions, findings closure, and sealed releases for one operator, one installation, and one reporting year. Pay once to lock that file; same-file corrections are included.",
    calculation:
      "Server-side engine computes direct and indirect emissions with unit-safe conversions, precursor treatment where applicable, and allocation reconciliation. Every authoritative node carries formula identity, inputs, units, and a SHA-256 node hash.",
    explanation:
      "You compile installation and goods data, link supporting documents, resolve blockers, pay once to lock, then seal releases for buyer or verifier handover without rewriting prior seals.",
    methodology:
      "Versioned rulesets and legal source citations travel with each sealed release so method history stays auditable.",
    evidence:
      "Evidence objects store hash, size, path ownership, review status, and support status. Seal is blocked when evidence is missing, rejected, unsupported, or hash-mismatched.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "How much does the pack cost?", href: "/pricing", why: "Commercial terms" },
      { question: "See a sample sealed structure", href: "/sample-dossier", why: "Package shape" },
      { question: "Exporter evidence requirements", href: "/cbam-exporter-evidence-requirements", why: "Evidence depth" },
      { question: "How does the workflow run?", href: "/how-it-works", why: "Working-file steps" },
      { question: "Which ruleset is pinned?", href: "/rulesets", why: "Method version" },
      { question: "Need SSO or multi-site?", href: "/enterprise", why: "Enterprise Exclusive path" },
      { question: "Verify a sealed hash", href: "/verify", why: "Integrity check" },
      { question: "Public trust evidence", href: "/trust", why: "Proof registry" },
    ],
    entities: [
      "Exporter Verification Preparation Pack",
      "calculation trace",
      "evidence register",
      "fail-closed quality controls",
      "O3CI field-mapped export",
      "versioned EU rulesets",
      "SHA-256 integrity manifest",
      "case readiness",
    ],
    fanOutQueries: [
      "CBAM verification preparation product",
      "CBAM evidence register software",
      "deterministic CBAM calculation engine",
      "CBAM O3CI field-mapped export",
      "CBAM sealed dossier integrity hash",
      "CBAM fail-closed quality controls",
    ],
  },
  {
    path: "/pricing",
    primaryQuestion: `What does ${PRICE} buy, and when is the card charged?`,
    empathyLead:
      "Nobody wants a surprise charge mid-review or a vague “credits” story. You should finish data quality first, then buy when you are ready to seal.",
    directAnswer: `${PRICE} unlocks lock-and-download for one working file (${PACK}): unlimited drafts and same-file correction re-locks for one operator, one installation, and one reporting year. Drafting is free. The card is charged when you pay to lock that file — not while you edit drafts. A new file needs a new payment.`,
    calculation: `Commercial math: 1 payment → 1 working file unlock. Same-file correction reseals included. Failed or blocked locks charge nothing. Re-download consumes zero. Another installation, reporting year, or working file requires another payment.`,
    explanation:
      "Pay at lock after your working file is ready. Correct and re-lock the same paid file as needed. Prior sealed versions remain immutable and re-downloadable.",
    methodology:
      "Pricing is a commercial entitlement contract, not a regulatory calculation. Emissions methodology is separate and versioned inside the dossier.",
    evidence:
      "Checkout and entitlement ledgers are server-authoritative. Client-provided credit or price claims are never trusted.",
    expert:
      "Commercial unit and independence boundary are product policy facts. Mathematical engine review does not change pricing or create an accredited verification claim.",
    relatedProblems: [
      { question: "What is included in the product?", href: "/product", why: "Capability detail" },
      { question: "When do I seal?", href: "/how-it-works", why: "Payment vs seal timing" },
      { question: "Book a demo", href: "/demo", why: "Annual / Enterprise path" },
      { question: "Can one payment cover another plant?", href: "/pricing", why: "Scope lock clarification" },
      { question: "Refund rules", href: "/refund-policy", why: "Unused unlock / duplicates" },
    ],
    entities: ["USD 449", "pay at lock", "Exporter Annual", "Enterprise contact sales", "ROI calculator", "same-file corrections"],
    fanOutQueries: [
      "CBAMValid price",
      "CBAMValid USD 449",
      "CBAM preparation pack cost",
      "is CBAMValid a subscription",
      "when is CBAMValid card charged",
    ],
  },
  {
    path: "/demo",
    primaryQuestion: "How do I book a CBAMValid demo for Annual or Enterprise?",
    empathyLead:
      "Self-serve Single Pack is not enough for multi-site buyers who need DPA, SSO, and coordination.",
    directAnswer:
      "Email info@cbamvalid.com or open the Book a demo page. Single Pack remains self-serve at USD 449 pay-at-lock. Annual and Enterprise require a human scoping conversation. No accredited verification claims are made in demos.",
    calculation: "Demos do not produce sealed emissions results.",
    explanation:
      "Come with installation count, reporting year, and CN family. We walk working-file flow, QC, seal integrity, and buyer share links.",
    methodology: "Independence boundary remains preparation ≠ verification.",
    evidence: "Published /demo page and pricing tiers.",
    expert: "Enterprise is a commitment regime, not a feature checkbox.",
    relatedProblems: [
      { question: "Public pricing", href: "/pricing", why: "Tier amounts" },
      { question: "Sample dossier", href: "/sample-dossier", why: "Inspect output" },
      { question: "Security", href: "/security", why: "DPA draft" },
    ],
    entities: ["book a demo", "Exporter Annual", "Enterprise"],
    fanOutQueries: ["CBAMValid demo", "CBAMValid enterprise demo", "CBAMValid annual plan"],
  },
  {
    path: "/case-studies",
    primaryQuestion: "Does CBAMValid publish customer logos and case studies?",
    empathyLead:
      "Procurement trusts empty honesty more than invented praise strips.",
    directAnswer:
      "Named case studies are published only with written permission for company name, logo, and a measurable outcome. Until then the case-studies page stays empty by design.",
    calculation: "Case studies do not alter sealed emissions arithmetic.",
    explanation: "Use the public sample dossier and structure-review surface while the permissioned slot is empty.",
    methodology: "H2: no claim without evidence. Fake social proof is banned.",
    evidence: "Published /case-studies empty-slot policy page.",
    expert: "Permissioned proof beats fabricated logos.",
    relatedProblems: [
      { question: "Sample dossier", href: "/sample-dossier", why: "Inspect output" },
      { question: "Structure review", href: "/verifier-review", why: "Package fitness" },
      { question: "Book a demo", href: "/demo", why: "Talk to a human" },
    ],
    entities: ["case studies", "permissioned reference", "no invented logos"],
    fanOutQueries: ["CBAMValid case studies", "CBAMValid customer logos", "CBAMValid testimonials"],
  },
  {
    path: "/how-it-works",
    primaryQuestion: "How do I go from raw plant data to a sealed CBAM preparation dossier?",
    empathyLead:
      "Most teams lose weeks in email threads and version chaos. You need a guided path that shows gaps before a buyer or verifier sees the file.",
    directAnswer:
      "Start with the readiness checklist and pre-flight XLSX. Honest time: 2–4 hours if data is ready, 2–3 weeks if starting from zero. Then define one installation and reporting year, enter goods and production data, link evidence, clear quality blockers, pay once to lock that working file, and download PDF, JSON, and O3CI field-mapped exports.",
    calculation:
      "After material inputs are complete, the server engine computes embedded emissions and writes a calculation trace. Incomplete material data blocks sealing.",
    explanation:
      "One Where-you-are strip guides eight plain stages from scope setup through evidence linking, QC, pay-at-lock, seal, and download — without a second duplicate step bar. Drafts stay free until you pay to lock that file.",
    methodology:
      "Each sealed release records the ruleset and engine version used so replay stays deterministic.",
    evidence:
      "Every material field should point to approved, fully supported evidence before seal.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "Inspect a sample dossier", href: "/sample-dossier", why: "See deliverables" },
      { question: "Pricing and release math", href: "/pricing", why: "When you pay" },
      { question: "Verification preparation guide", href: "/cbam-verification-preparation", why: "Verifier handoff" },
    ],
    entities: ["draft-to-seal workflow", "quality blockers", "sealed release", "O3CI export"],
    fanOutQueries: [
      "how to prepare CBAM dossier",
      "CBAMValid workflow steps",
      "seal CBAM evidence package",
    ],
  },
  {
    path: "/methodology",
    primaryQuestion: "Which ruleset and methods does CBAMValid use for authoritative calculations?",
    empathyLead:
      "When a verifier asks which rules you followed, “latest guidance” is not an answer. You need a dated method reference inside the package.",
    directAnswer:
      "Authoritative calculations pin to a named, versioned ruleset recorded in the sealed dossier. Historical sealed releases keep the ruleset they were built against; methods are not silently rewritten after sealing.",
    calculation:
      "Direct and indirect emissions, precursor treatment, and allocation shares are computed with unit discipline, null/zero separation, and reconciliation guards. Intermediate precision is preserved; reporting-stage rounding is explicit.",
    explanation:
      "Methodology pages and sealed traces cite Regulation (EU) 2023/956 and implementing rules for calculation and verification principles where applied.",
    methodology:
      "Ruleset identity, engine version, legal source IDs, and calculation-node hashes form the reproducibility contract.",
    evidence:
      "Method decisions and material inputs must be evidence-linked where required before a seal can pass.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "How are embedded emissions calculated?", href: "/cbam-embedded-emissions-calculation", why: "Formula depth" },
      { question: "Actual vs default values", href: "/cbam-actual-vs-default-values", why: "Value basis choice" },
      { question: "CBAM methodology overview", href: "/cbam-methodology", why: "Topic cluster hub" },
    ],
    entities: [
      "versioned ruleset",
      "Regulation (EU) 2023/956",
      "Implementing Regulation (EU) 2025/2547",
      "calculation trace",
      "deterministic replay",
    ],
    fanOutQueries: [
      "CBAM calculation methodology",
      "CBAM ruleset versioning",
      "deterministic embedded emissions calculation",
    ],
  },
  {
    path: "/sample-dossier",
    primaryQuestion: "What does a sealed CBAMValid preparation dossier contain?",
    empathyLead:
      "Buyers and verifiers ask what they will receive. You should inspect structure and integrity expectations before you purchase.",
    directAnswer:
      "A sealed package is an immutable operator-prepared dossier with reports, structured data, evidence folder references, and a data integrity manifest with file sizes and SHA-256 hashes — prepared for independent review, not as an accredited verification opinion. Each sealed release also carries a short Package ID (letter + four digits, for example Y7654) so operators can distinguish versions without reading truncated hashes.",
    calculation:
      "Sample calculations illustrate trace shape and unit reporting. Live cases recompute from your installation data under the active ruleset.",
    explanation:
      "Use the public interactive viewer (page thumbs, document stage, contents panel), then the authority and answer sections below, to inspect cover-to-integrity structure before sealing your own case.",
    methodology:
      "Sample content follows the same independence boundary and package-contract discipline as production seals, citing Regulation (EU) 2023/956 and definitive-period implementing rules.",
    evidence:
      "Manifest-listed files must exist with matching size and hash. Public sample demonstrates the integrity pattern without exposing tenant data.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "Verify a dossier signature", href: "/verify", why: "Integrity check" },
      { question: "Buy the preparation pack", href: "/pricing", why: "Commercial next step" },
      { question: "Product capabilities", href: "/product", why: "What you get" },
    ],
    entities: [
      "sample sealed dossier",
      "integrity manifest",
      "SHA-256",
      "verifier navigation package",
      "interactive dossier viewer",
    ],
    fanOutQueries: [
      "CBAM sample dossier",
      "CBAM verification preparation package contents",
      "CBAM integrity manifest",
      "CBAMValid sample dossier preview",
    ],
  },
  {
    path: "/verify",
    primaryQuestion: "How can someone check that a sealed CBAMValid dossier was not altered?",
    empathyLead:
      "Recipients need a trust check without opening a black box. Integrity verification must be independent of marketing claims.",
    directAnswer:
      "Public verification checks the sealed dossier integrity signature / hash against the published manifest pattern. A passing integrity check confirms package bytes match the seal — it does not mean emissions were accredited-verified.",
    calculation:
      "Verification compares cryptographic hashes of package contents. It does not re-run emissions formulas unless you open a separate calculation review.",
    explanation:
      "Use the verify flow with the public token or published hash materials supplied with the sealed release.",
    methodology:
      "Integrity verification is a data-integrity control, separate from accredited verification under CBAM implementing rules.",
    evidence:
      "Hash mismatch or missing bytes fails closed. Successful verify ≠ verification opinion.",
    expert:
      "Integrity tooling is product engineering. Accredited verification remains a separate legal act by an accredited verifier.",
    relatedProblems: [
      { question: "See sample dossier structure", href: "/sample-dossier", why: "What is verified" },
      { question: "Sealed vs verified meaning", href: "/how-it-works", why: "Boundary language" },
    ],
    entities: ["dossier integrity hash", "public verification", "manifest SHA-256"],
    fanOutQueries: [
      "verify CBAM dossier hash",
      "CBAMValid signature verification",
    ],
  },
  {
    path: "/verifier-review",
    primaryQuestion: "How does CBAMValid handle verifier structure review without claiming a verification opinion?",
    empathyLead:
      "Acceptance risk is the buyer’s real fear. Structure fitness must be discussed without inventing accreditation badges.",
    directAnswer:
      "CBAMValid publishes a structure-review surface mapping package fields, evidence lineage, and integrity controls for independent verification workflows. Canonical boundary: Reviewed for structure — not a verification opinion. Third-party signed letters are published only when received — never invented.",
    calculation:
      "Structure review does not restate sealed emissions as assured. Calculation integrity remains separate from accredited verification.",
    explanation:
      "Use the Structure Review Brief and gate-free sample dossier when engaging verification bodies. Home page badge links to this surface.",
    methodology:
      "Target letter language is pinned to IR 2025/2621 workflow fitness and explicitly excludes verification opinions.",
    evidence:
      "Published brief PDF + field map + empty letter slot until a real signed letter arrives.",
    expert:
      "Structure review is a package-fitness engagement. Accredited verification remains a separate legal act.",
    relatedProblems: [
      { question: "Open sample dossier", href: "/sample-dossier", why: "Inspect structure" },
      { question: "Verify integrity hash", href: "/verify", why: "Byte integrity" },
      { question: "Methodology sources", href: "/methodology", why: "Ruleset pin" },
    ],
    entities: [
      "structure review",
      "verification opinion boundary",
      "IR 2025/2621",
      "evidence lineage",
    ],
    fanOutQueries: [
      "CBAM structure review vs verification",
      "CBAMValid verifier review letter",
      "reviewed for structure not a verification opinion",
    ],
  },
  {
    path: "/rulesets",
    primaryQuestion: "Where are CBAMValid ruleset versions published?",
    empathyLead:
      "A sealed dossier without a named ruleset pin is hard to defend when a verifier asks which rules applied.",
    directAnswer:
      "CBAMValid publishes a public ruleset registry with named versions, active dates, source-registry hashes, and linked official sources. Historical seals keep the ruleset they were built against.",
    calculation:
      "Authoritative calculations run against the pinned ruleset for that seal. Changing published rulesets does not rewrite historical seals.",
    explanation:
      "Open /rulesets for the registry, then /methodology for how pins appear in sealed packages.",
    methodology:
      "Rulesets cite EUR-Lex-linked official source IDs from the legal source registry.",
    evidence:
      "Source hash and registry version are published beside each ruleset entry.",
    expert:
      "Publishing rulesets is an authority surface for preparation software — not an accredited verification opinion.",
    relatedProblems: [
      { question: "Methodology sources", href: "/methodology", why: "How pins work" },
      { question: "Sample dossier", href: "/sample-dossier", why: "See sealed structure" },
      { question: "Platform architecture", href: "/platform", why: "CBAM-first category" },
    ],
    entities: ["ruleset version", "source-registry hash", "historical seal pin"],
    fanOutQueries: [
      "CBAMValid ruleset registry",
      "which CBAM ruleset version",
      "CBAM ruleset source hash",
    ],
  },
  {
    path: "/buyer-link",
    primaryQuestion: "How does the CBAMValid buyer share link work?",
    empathyLead:
      "Buyers want one URL, not a ZIP emailed into oblivion. The URL must stay integrity-only.",
    directAnswer:
      "After lock, /d/<token> aliases /verify/<token> for the same sealed-release summary and authorized download path. No login is required for the public token view. Success proves integrity and preparation status — not accredited verification.",
    calculation:
      "The share link does not recalculate emissions. It surfaces the sealed release already produced by the server engine.",
    explanation:
      "Operators share the token URL with EU buyers or reporting teams. Short and canonical forms resolve to the same integrity view.",
    methodology:
      "Token verification is a data-integrity control separate from accredited verification under CBAM implementing rules.",
    evidence:
      "Invalid or inactive tokens fail closed. Successful open ≠ verification opinion.",
    expert:
      "Buyer share is a commercial distribution path for sealed packages, not an assurance badge.",
    relatedProblems: [
      { question: "Public verify", href: "/verify", why: "Hash and token entry" },
      { question: "Sample dossier", href: "/sample-dossier", why: "Inspect before buy" },
      { question: "Security facts", href: "/security", why: "Hosting and DPA" },
    ],
    entities: ["buyer share link", "/d/token", "public verification token"],
    fanOutQueries: [
      "CBAMValid buyer share link",
      "CBAM dossier token URL",
      "/d/token CBAMValid",
    ],
  },
  {
    path: "/security",
    primaryQuestion: "What security facts does CBAMValid publish — and does it claim ISO 27001?",
    empathyLead:
      "Procurement asks for region, encryption, subprocessors, and a DPA. Fake certification language destroys trust.",
    directAnswer:
      "CBAMValid publishes europe-west1 hosting, TLS, HttpOnly sessions, provider encryption at rest, subprocessors (Firebase/Google Cloud and Paddle), and a DPA draft. ISO 27001 and SOC 2 are not claimed.",
    calculation:
      "Security controls protect case and evidence data; they do not alter sealed emissions arithmetic.",
    explanation:
      "Download the DPA draft for procurement discussion. Signed DPAs remain a bilateral commercial step.",
    methodology:
      "Certification claims require issuer, scope, and validity dates — never unpublished placeholder status language.",
    evidence:
      "Published security page + DPA draft PDF. Absence of ISO claim is intentional honesty.",
    expert:
      "Security facts are operational. Accredited verification remains a separate legal act.",
    relatedProblems: [
      { question: "Privacy notice", href: "/privacy", why: "Data handling" },
      { question: "Trust registry", href: "/trust", why: "Pinned claims" },
      { question: "Contact privacy", href: "/contact", why: "Requests" },
      { question: "Buyer share link", href: "/buyer-link", why: "Public token path" },
    ],
    entities: ["europe-west1", "DPA draft", "subprocessors", "no ISO 27001 claim"],
    fanOutQueries: [
      "CBAMValid security",
      "CBAMValid DPA",
      "CBAMValid ISO 27001",
    ],
  },
  {
    path: "/trust",
    primaryQuestion: "How does CBAMValid prove marketing claims without inventing evidence?",
    empathyLead:
      "Enterprise buyers reject sites that invent CRO numbers, logos, or verifier endorsements.",
    directAnswer:
      "CBAMValid publishes a Trust Evidence Registry. Each claim is VERIFIED, CODE PROVEN, SAMPLE, EMPTY BY DESIGN, OWNER ACTION, or EXTERNAL BLOCKER. Legal identity is published (CRO 315881, VAT IE1857162AB, Dublin address). Half-identity and forged letters remain forbidden. Remaining gaps stay visible.",
    calculation:
      "Claim discipline does not change sealed emissions arithmetic; it protects procurement trust around the product.",
    explanation:
      "SAMPLE documents are watermarked specimens. EMPTY BY DESIGN pages (case studies) refuse invented logos. OWNER ACTION / EXTERNAL BLOCKER items stay visible until closed.",
    methodology:
      "H2: no claim without evidence. Status language mirrors the seal engine’s fail-closed posture.",
    evidence:
      "Published /trust registry + full T1.3 /legal-notice identity + /verifier-review SAMPLE surface.",
    expert:
      "Published legal identity plus visible claim gaps beats invented completeness in enterprise procurement.",
    relatedProblems: [
      { question: "Legal notice", href: "/legal-notice", why: "Identity publication" },
      { question: "Structure review", href: "/verifier-review", why: "SAMPLE boundary" },
      { question: "Case studies policy", href: "/case-studies", why: "Empty by design" },
      { question: "Security facts", href: "/security", why: "No fake ISO" },
      { question: "Enterprise Exclusive", href: "/enterprise", why: "SSO SLA Holding" },
    ],
    entities: ["trust registry", "H2", "SAMPLE", "CRO 315881", "VAT IE1857162AB"],
    fanOutQueries: [
      "CBAMValid trust evidence",
      "CBAMValid company registration",
      "CBAMValid VAT",
    ],
  },
  {
    path: "/platform",
    primaryQuestion: "Is CBAMValid opening other regulatory categories beyond CBAM?",
    empathyLead:
      "Category expansion before CBAM leadership creates half-products and diluted trust.",
    directAnswer:
      "Door = CBAM. Additional regimes are available only under an Enterprise expansion SOW — not as public half-products. Enterprise Exclusive also sells SSO, SLA, and holding scope for multi-site CBAM buyers. R6–R9 modules are LIVE to sell.",
    calculation:
      "Additional categories would reuse the package contract and ruleset pin model — they are not live engines today.",
    explanation:
      "Use /enterprise for SSO/SLA/holding. Use /rulesets and /product for the live CBAM surface.",
    methodology:
      "One live ruleset family first. Enterprise expands commercial depth without inventing certifications.",
    evidence:
      "Published /platform, /enterprise, /rulesets, /security with DPA and SLA drafts.",
    expert:
      "Architecture reuse is real. Fake second-product marketing is banned.",
    relatedProblems: [
      { question: "Enterprise Exclusive", href: "/enterprise", why: "SSO SLA Holding" },
      { question: "Published rulesets", href: "/rulesets", why: "Live CBAM pins" },
      { question: "Product", href: "/product", why: "What ships today" },
      { question: "Security", href: "/security", why: "DPA SLA" },
    ],
    entities: ["category architecture", "CBAM first", "Enterprise SOW", "R6-R9"],
    fanOutQueries: [
      "CBAMValid platform architecture",
      "CBAMValid Enterprise SSO",
      "CBAMValid beyond CBAM",
    ],
  },
  {
    path: "/enterprise",
    primaryQuestion: "What does CBAMValid Enterprise Exclusive include?",
    empathyLead:
      "Multi-site exporters need SSO, SLA, and holding scope — not another self-serve checkbox.",
    directAnswer:
      "Enterprise Exclusive starts from USD 12,000 per year (contact sales). It includes contracted SSO/IdP federation, an SLA draft and signed MSA path, holding/multi-entity entitlement, signed DPA path, API/onboarding plan, and verifier coordination. It is not an accredited verification opinion.",
    calculation:
      "Enterprise changes entitlement and access control — sealed emissions arithmetic remains the same fail-closed engine.",
    explanation:
      "Request scoping on /enterprise. Single Pack stays self-serve at USD 449 pay-at-lock.",
    methodology:
      "SSO uses OIDC/SAML via Identity Platform. Holding keeps each seal scoped to one operator/installation/year.",
    evidence:
      "Published Enterprise pages, SLA draft PDF, DPA draft PDF, inquiry API.",
    expert:
      "Enterprise is a commitment regime for procurement — not a fake certification badge.",
    relatedProblems: [
      { question: "SSO", href: "/enterprise/sso", why: "IdP federation" },
      { question: "Holding", href: "/enterprise/holding", why: "Multi-entity" },
      { question: "Pricing", href: "/pricing", why: "Tier map" },
      { question: "Partners", href: "/partners", why: "Channel" },
      { question: "Sample dossier", href: "/sample-dossier", why: "Inspect package" },
      { question: "Trust registry", href: "/trust", why: "Pinned claims" },
    ],
    entities: ["Enterprise Exclusive", "SSO", "SLA", "holding", "from $12,000"],
    fanOutQueries: [
      "CBAMValid Enterprise",
      "CBAMValid SSO",
      "CBAMValid SLA",
      "CBAMValid holding multi-entity",
    ],
  },
  {
    path: "/enterprise/sso",
    primaryQuestion: "Does CBAMValid support SSO for Enterprise buyers?",
    empathyLead:
      "IT will block any SaaS that cannot federate Entra, Google, or Okta.",
    directAnswer:
      "Yes under Enterprise contract. CBAMValid federates Microsoft Entra ID, Google Workspace, or Okta via OIDC/SAML. The server HttpOnly session remains authoritative; SSO does not replace tenant or case authorization.",
    calculation: "SSO does not alter emissions calculations.",
    explanation: "Provisioning requires SOW, IdP metadata, domain allow-list, and pilot cutover.",
    methodology: "Firebase Identity Platform SAML/OIDC bound per tenant.",
    evidence: "Published /enterprise/sso provisioning steps.",
    expert: "SSO is contracted enablement, not a Single Pack feature.",
    relatedProblems: [
      { question: "Enterprise", href: "/enterprise", why: "Full package" },
      { question: "Security", href: "/security", why: "Session model" },
    ],
    entities: ["SSO", "OIDC", "SAML", "Entra", "Okta"],
    fanOutQueries: ["CBAMValid SSO", "CBAMValid SAML", "CBAMValid Entra ID"],
  },
  {
    path: "/enterprise/holding",
    primaryQuestion: "Can a holding company cover multiple operators in CBAMValid?",
    empathyLead:
      "Groups fear either paying per plant forever or blurring legal scope.",
    directAnswer:
      "Enterprise entitlement can sit at holding level while each sealed working file still binds one operator, one installation, and one reporting year. Cross-entity clones do not inherit payment unless the SOW says so.",
    calculation: "Holding structure does not merge emissions across entities in one seal.",
    explanation: "Roles include Holding Admin, Operator Preparer, Internal Reviewer, Read-Only Verifier.",
    methodology: "Explicit scope remains a seal invariant.",
    evidence: "Published /enterprise/holding contract rules.",
    expert: "No silent scope widening — verifiers see clear boundaries.",
    relatedProblems: [
      { question: "Enterprise", href: "/enterprise", why: "Commercial package" },
      { question: "Pricing", href: "/pricing", why: "Tier contrast" },
    ],
    entities: ["holding", "multi-entity", "installation scope"],
    fanOutQueries: ["CBAMValid holding", "CBAMValid multi-site", "CBAMValid group exporters"],
  },
  {
    path: "/partners",
    primaryQuestion: "How do I become a CBAMValid channel partner?",
    empathyLead:
      "Consultancies and verifier firms want a referral track without fake logo walls.",
    directAnswer:
      "Open /partners and submit the partner inquiry. Logos are published only after a signed referral agreement. The program does not create accredited verification endorsements.",
    calculation: "Partner referrals do not change sealed arithmetic.",
    explanation: "Intake is live; public partner logos remain permissioned.",
    methodology: "H2: no invented partner logos.",
    evidence: "Published /partners intake form.",
    expert: "Channel scale follows contracts, not invented badges.",
    relatedProblems: [
      { question: "Enterprise", href: "/enterprise", why: "Buyer path" },
      { question: "Structure review", href: "/verifier-review", why: "Package fitness" },
    ],
    entities: ["channel partner", "referral agreement"],
    fanOutQueries: ["CBAMValid partner", "CBAMValid reseller", "CBAMValid referral"],
  },
  {
    path: "/cn-code",
    primaryQuestion: "How do I check whether a CN code is in CBAM goods scope?",
    empathyLead:
      "Wrong CN scope wastes months. You need a clear scope decision before you build an entire dossier.",
    directAnswer:
      "Use the CN code hub to inspect CBAM Annex I-oriented public entries for covered goods chapters. Classification remains an operator responsibility; CBAMValid does not replace customs classification advice.",
    calculation:
      "Scope is a classification and applicability decision, not an emissions total. Emissions calculations start only after goods and routes are in scope.",
    explanation:
      "Search or browse published CN entries, review sector and route notes, then continue to product setup for in-scope goods.",
    methodology:
      "Public CN pages cite legal source families used for scope publication. Always re-check effective dates against current official texts.",
    evidence:
      "Keep customs documents and CN reasoning evidence with the case for verifier review.",
    expert:
      "Scope guidance is informational. Final classification and legal interpretation remain with the operator and competent advisors.",
    relatedProblems: [
      { question: "CN code scope decision guide", href: "/cbam-cn-code-scope", why: "Decision depth" },
      { question: "Non-EU producer guide", href: "/cbam-non-eu-producer-guide", why: "Exporter duties" },
      { question: "Start a preparation pack", href: "/product", why: "Next operational step" },
    ],
    entities: ["CN code", "Annex I", "CBAM goods scope", "customs classification"],
    fanOutQueries: [
      "is my CN code in CBAM",
      "CBAM CN code list",
      "CBAM Annex I goods",
    ],
  },
  {
    path: "/cbam-2026-definitive-period",
    primaryQuestion: "What changed when the CBAM definitive period started in 2026?",
    empathyLead:
      "Teams still mix transitional quarterly reporting habits with definitive-period annual duties. That confusion creates false deadlines and wrong workplans.",
    directAnswer:
      "The CBAM definitive period applies from 1 January 2026. For 2026 imports, the first CBAM declaration and corresponding certificate surrender deadline is 30 September 2027. Certificate price calculation in 2026 follows a quarterly cadence — that is not the same as transitional quarterly emissions reporting.",
    calculation:
      "Certificate price publication uses quarterly calculation under Implementing Regulation (EU) 2025/2548. Embedded emissions for goods remain installation-based calculations under the emissions implementing rules.",
    explanation:
      "EU importers face annual declaration and certificate surrender duties. Non-EU producers must supply evidence-linked actual data when buyers require it. Do not treat transitional quarterly report dates as 2026 definitive obligations.",
    methodology:
      "Cite Regulation (EU) 2023/956 as amended, plus implementing rules for verification, emissions calculation, and certificate price.",
    evidence:
      "Keep period-correct installation data, goods lists, and evidence hashes aligned to the reporting year you will seal.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "Certificate price cadence", href: "/cbam-certificate-price", why: "Price vs reporting confusion" },
      { question: "Verification preparation", href: "/cbam-verification-preparation", why: "What to assemble" },
      { question: "Non-EU producer duties", href: "/cbam-non-eu-producer-guide", why: "Exporter angle" },
    ],
    entities: [
      "CBAM definitive period",
      "1 January 2026",
      "30 September 2027",
      "certificate surrender",
      "Regulation (EU) 2025/2083",
    ],
    fanOutQueries: [
      "CBAM 2026 definitive period",
      "CBAM declaration deadline 2027",
      "CBAM certificate surrender 2026 imports",
    ],
  },
  {
    path: "/cbam-embedded-emissions-calculation",
    primaryQuestion: "How are CBAM embedded emissions calculated for goods?",
    empathyLead:
      "A wrong total under buyer pressure is worse than a blocked draft. Missing data must stop the result — not become a silent zero.",
    directAnswer:
      "Embedded emissions combine direct process/combustion emissions and, where required, electricity-related indirect emissions, plus applicable precursor emissions. Authoritative results require complete material inputs, reconciled allocation, and evidence links.",
    calculation:
      "Compute direct emissions from activity data and factors or measurements; add indirect electricity emissions where required; include precursor embedded emissions when in scope; allocate installation totals to goods so shares reconcile within tolerance; preserve intermediate precision and apply reporting-stage rounding only at the defined stage.",
    explanation:
      "Separate direct and indirect bases, prevent double counting, and keep unit conversions explicit (including kg/t and energy units). Client previews are advisory until the server seal.",
    methodology:
      "Follow Implementing Regulation (EU) 2025/2547 calculation principles as applied by the active CBAMValid ruleset version recorded in the seal.",
    evidence:
      "Activity data, factors, electricity data, precursor quantities, and allocation methodology need evidence IDs and support status before sealing.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "Actual vs default values", href: "/cbam-actual-vs-default-values", why: "Value basis" },
      { question: "Methodology index", href: "/methodology", why: "Ruleset pinning" },
      { question: "Evidence requirements", href: "/cbam-exporter-evidence-requirements", why: "Proof depth" },
    ],
    entities: [
      "embedded emissions",
      "direct emissions",
      "indirect emissions",
      "precursors",
      "allocation reconciliation",
    ],
    fanOutQueries: [
      "how to calculate CBAM embedded emissions",
      "CBAM direct and indirect emissions",
      "CBAM precursor emissions calculation",
    ],
  },
  {
    path: "/cbam-actual-vs-default-values",
    primaryQuestion: "When should exporters use actual values instead of CBAM default values?",
    empathyLead:
      "Defaults can look easier until a buyer or verifier rejects them. Choosing the wrong basis creates commercial and legal risk.",
    directAnswer:
      "Actual values reflect installation-specific monitored or calculated emissions and generally require independent verification where legally required. Default values are official fallbacks that depend on multiple regulatory dimensions — not a single universal CN number.",
    calculation:
      "Actual-value pathways use installation data and evidence-linked factors. Default-value pathways apply multi-dimensional official factors (including country, route, and year dimensions where defined). Mixing bases without disclosure breaks reproducibility.",
    explanation:
      "Prefer actual values when evidence quality can support verification. Use defaults only under conditions permitted by applicable implementing rules, understanding mark-ups and dimensional dependencies.",
    methodology:
      "Document the actual/default decision in the methodology decision log with legal basis and evidence IDs.",
    evidence:
      "Actual pathways need stronger primary evidence. Default pathways still need transparent citation of the factor source and dimensions used.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "Default values guide", href: "/cbam-default-values", why: "Factor dimensions" },
      { question: "Embedded emissions calculation", href: "/cbam-embedded-emissions-calculation", why: "Compute path" },
      { question: "Verification preparation", href: "/cbam-verification-preparation", why: "Assurance boundary" },
    ],
    entities: ["actual values", "default values", "multi-dimensional factors", "verification requirement"],
    fanOutQueries: [
      "CBAM actual vs default values",
      "when are CBAM actual values required",
      "CBAM default value mark-up",
    ],
  },
  {
    path: "/cbam-default-values",
    primaryQuestion: "What are CBAM default values and why are they multi-dimensional?",
    empathyLead:
      "Searching for “one default number per CN code” is a common trap. Wrong dimensions produce indefensible figures.",
    directAnswer:
      "CBAM default values are official fallback emission factors that depend on multiple dimensions such as goods, country, production route, and year where the published dataset defines them — not a single timeless CN-only number.",
    calculation:
      "Select the factor only after matching all required dimensions in the official dataset applicable to the reporting period. Do not invent interpolated factors.",
    explanation:
      "Defaults exist for defined fallback cases. They are not a shortcut that removes documentation duty or automatic acceptance.",
    methodology:
      "Cite the default-value dataset version and dimensions in the sealed methodology and calculation trace.",
    evidence:
      "Retain the factor source reference, effective period, and selection rationale with the case evidence register.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "Actual vs default decision", href: "/cbam-actual-vs-default-values", why: "Choice framework" },
      { question: "CN scope", href: "/cn-code", why: "Goods identity" },
      { question: "Methodology", href: "/methodology", why: "Traceability" },
    ],
    entities: ["default emission factors", "country route year dimensions", "fallback values"],
    fanOutQueries: [
      "CBAM default values",
      "CBAM default factor by country",
      "CBAM default values 2026",
    ],
  },
  {
    path: "/cbam-certificate-price",
    primaryQuestion: "How does CBAM certificate pricing work in 2026?",
    empathyLead:
      "Finance teams often confuse certificate price publication cadence with transitional quarterly emissions reporting. That mix-up drives the wrong calendar.",
    directAnswer:
      "In 2026, CBAM certificate prices are calculated on a quarterly cadence under Implementing Regulation (EU) 2025/2548. Certificate purchase and surrender obligations follow definitive-period rules and must not be confused with transitional quarterly emissions reporting.",
    calculation:
      "Certificate price is an official published price used for certificate accounting. It is separate from your installation’s embedded-emissions calculation for goods.",
    explanation:
      "Track official certificate price publications for the relevant quarters. Do not treat price cadence as a substitute for annual declaration timing.",
    methodology:
      "Cite IMPL_2025_2548 for price calculation/publication rules; cite emissions implementing rules for goods calculations.",
    evidence:
      "Keep price references used in financial planning separate from sealed emissions evidence packages.",
    expert:
      "CBAMValid prepares emissions evidence packages. It does not sell CBAM certificates or set official certificate prices.",
    relatedProblems: [
      { question: "2026 definitive period deadlines", href: "/cbam-2026-definitive-period", why: "Calendar clarity" },
      { question: "Embedded emissions calculation", href: "/cbam-embedded-emissions-calculation", why: "Goods math" },
      { question: "Pricing for CBAMValid pack", href: "/pricing", why: "Software pack vs certificate price" },
    ],
    entities: [
      "CBAM certificate price",
      "quarterly price calculation",
      "Implementing Regulation (EU) 2025/2548",
    ],
    fanOutQueries: [
      "CBAM certificate price 2026",
      "CBAM certificate quarterly price",
      "CBAM certificate surrender cost",
    ],
  },
  {
    path: "/cbam-verification-preparation",
    primaryQuestion: "How should exporters prepare for independent CBAM verification?",
    empathyLead:
      "Verifiers do not want a story — they want complete, consistent, evidence-linked data. Preparation quality decides how painful the review becomes.",
    directAnswer:
      "Verification preparation means assembling complete, evidence-linked emissions data, methodology decisions, and findings closure so an independent accredited verifier can perform assurance work. CBAMValid prepares the package; it does not issue the verification opinion.",
    calculation:
      "Ensure calculation traces reconcile installation totals to goods, with precursors and direct/indirect separation handled without double counting.",
    explanation:
      "Lock scope, finish evidence support statuses, clear material findings, then seal a package that a verifier can navigate without reconstructing your email history.",
    methodology:
      "Follow verification principles in Implementing Regulation (EU) 2025/2546 as the assurance framework — preparation software does not replace that assurance.",
    evidence:
      "Evidence must be approved and fully supported with matching hashes. Partial support blocks a serious seal.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "Evidence requirements", href: "/cbam-exporter-evidence-requirements", why: "Proof checklist" },
      { question: "Sample dossier", href: "/sample-dossier", why: "Package shape" },
      { question: "Buy preparation pack", href: "/pricing", why: "Seal entitlement" },
    ],
    entities: [
      "verification preparation",
      "accredited verifier",
      "assurance boundary",
      "Implementing Regulation (EU) 2025/2546",
    ],
    fanOutQueries: [
      "how to prepare for CBAM verification",
      "CBAM verifier readiness package",
      "CBAM operator dossier for verification",
    ],
  },
  {
    path: "/cbam-exporter-evidence-requirements",
    primaryQuestion: "What evidence do non-EU exporters need for CBAM embedded emissions?",
    empathyLead:
      "A beautiful PDF with weak evidence fails. Buyers and verifiers follow the data lineage, not the cover page.",
    directAnswer:
      "Exporters need evidence lineage for material data: document identity, issuer, period, MIME/size, storage path, SHA-256 hash, uploader, confidentiality, review status, support status, and links to input fields and calculations.",
    calculation:
      "Each material calculation input should resolve to evidence that supports the numeric claim. Unsupported inputs must block authoritative sealing.",
    explanation:
      "Build an evidence register early. Approve and mark support status before you attempt seal. Duplicate hashes and path traversal attempts are rejected.",
    methodology:
      "Evidence sufficiency rules are fail-closed and versioned with the product quality-control contract.",
    evidence:
      "Physical bytes must match registered hash and size. Pending, rejected, unsupported, missing, or tampered evidence blocks sealing.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "Verification preparation", href: "/cbam-verification-preparation", why: "End-to-end readiness" },
      { question: "Product evidence register", href: "/product", why: "Tooling" },
      { question: "Methodology", href: "/methodology", why: "Method + proof pairing" },
    ],
    entities: [
      "evidence register",
      "SHA-256",
      "support status",
      "field-to-evidence matrix",
    ],
    fanOutQueries: [
      "CBAM exporter evidence requirements",
      "CBAM evidence hash integrity",
      "CBAM supporting documents checklist",
    ],
  },
  {
    path: "/cbam-non-eu-producer-guide",
    primaryQuestion: "What must non-EU producers and exporters do under CBAM?",
    empathyLead:
      "You may not be the declarant, but your EU customer still needs defendable actual data. Waiting until the PO is blocked is already too late.",
    directAnswer:
      "Non-EU producers and exporters should determine goods scope, compile installation and production-route data, calculate evidence-linked embedded emissions, and provide an operator-prepared package that EU importers can use toward CBAM duties. CBAMValid helps prepare that package for independent accredited verification.",
    calculation:
      "Produce installation-year embedded emissions with clear direct/indirect and precursor treatment aligned to the goods you export.",
    explanation:
      "Align commercial contracts to data handover, keep CN classification rationale, and seal reproducible packages your buyer can share with advisors or verifiers.",
    methodology:
      "Use versioned EU rulesets and keep independence language honest: preparation ≠ accredited verification.",
    evidence:
      "Supply evidence-backed actual values when required; document default-value use only when permitted and disclosed.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "2026 definitive period", href: "/cbam-2026-definitive-period", why: "Timeline" },
      { question: "How CBAMValid works", href: "/how-it-works", why: "Operational path" },
      { question: "Pricing", href: "/pricing", why: "Pack scope" },
    ],
    entities: [
      "non-EU producer",
      "exporter",
      "EU importer",
      "embedded emissions handover",
    ],
    fanOutQueries: [
      "CBAM duties for non-EU producers",
      "CBAM exporter obligations",
      "CBAM evidence for EU buyer",
    ],
  },
  {
    path: "/cbam-cn-code-scope",
    primaryQuestion: "How do I decide if my goods CN code falls under CBAM?",
    empathyLead:
      "Scope mistakes cascade into wrong data collection. Confirm Annex I coverage before you build the full evidence stack.",
    directAnswer:
      "Compare your goods’ Combined Nomenclature codes against CBAM Annex I coverage as published in the applicable legal texts and CBAMValid’s public CN registry entries. CBAMValid helps you navigate published scope notes; it does not replace formal customs classification.",
    calculation:
      "Out-of-scope goods should not receive forced emissions totals. In-scope goods proceed to installation-level calculation.",
    explanation:
      "Use the CN hub and sector notes, document your classification rationale, and escalate ambiguous cases to competent customs advisors.",
    methodology:
      "Scope decisions should be logged with legal source IDs and effective dates.",
    evidence:
      "Retain commercial descriptions, binding tariff information where available, and CN reasoning evidence with the case.",
    expert:
      "Scope guidance is informational. Classification liability remains with the economic operator.",
    relatedProblems: [
      { question: "CN code hub", href: "/cn-code", why: "Browse entries" },
      { question: "Non-EU producer guide", href: "/cbam-non-eu-producer-guide", why: "Exporter context" },
      { question: "Product setup", href: "/product", why: "Case build" },
    ],
    entities: ["CN classification", "Annex I goods", "CBAM scope decision"],
    fanOutQueries: [
      "CBAM CN code scope",
      "is product under CBAM Annex I",
      "CBAM goods list by CN",
    ],
  },
  {
    path: "/cbam-methodology",
    primaryQuestion: "What is the CBAM methodology overview CBAMValid publishes?",
    empathyLead:
      "Teams need a short map before diving into formulas. Methodology without version pins becomes non-reproducible.",
    directAnswer:
      "CBAMValid’s methodology overview explains versioned rulesets, reproducible calculation traces, evidence linkage, and the independence boundary between operator preparation and accredited verification.",
    calculation:
      "Overview pages point to detailed calculation guides; authoritative numbers still come from the sealed server engine for a specific case snapshot.",
    explanation:
      "Use this page as the methodology cluster hub, then fan out to embedded-emissions, actual/default, and legal-source pages.",
    methodology:
      "Ruleset versioning + deterministic replay + legal source citation is the core contract.",
    evidence:
      "Method claims on public pages stay aligned to verified regulatory facts and product boundaries.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "Full methodology index", href: "/methodology", why: "Deep sources" },
      { question: "Embedded emissions calculation", href: "/cbam-embedded-emissions-calculation", why: "Formula path" },
      { question: "Product engine capabilities", href: "/product", why: "Implementation" },
    ],
    entities: ["CBAM methodology", "ruleset versioning", "reproducible traces"],
    fanOutQueries: [
      "CBAM methodology overview",
      "CBAM ruleset version",
      "CBAM calculation reproducibility",
    ],
  },
  {
    path: "/about",
    primaryQuestion: "Who is CBAMValid and what independence boundary applies?",
    empathyLead:
      "Buyers and compliance teams need to know whether a vendor is an official EU service — or an independent preparation tool with clear limits.",
    directAnswer:
      "CBAMValid is an independent software service that helps exporters and importers prepare evidence-linked CBAM dossiers. It is not an EU institution, customs authority, accredited CBAM verifier, or CBAM Registry submission service.",
    calculation:
      "Mathematical engines and allocation logic are reviewed against EU CBAM mathematical rules by Prof. Dr. Neela Nataraj (IIT Bombay). That review supports calculation integrity — it is not an accredited verification opinion.",
    explanation:
      "Use CBAMValid to compile scope, evidence, calculations, and sealed packages for handover to buyers or independent verifiers.",
    methodology:
      "Public methodology pages cite versioned rulesets and Regulation (EU) 2023/956-family sources; sealed packages pin the ruleset used at seal time.",
    evidence:
      "Independence and support identity claims are product-policy facts published on About, Legal Notice, and contact surfaces.",
    expert: EXPERT_BLOCK,
    relatedProblems: [
      { question: "Contact support", href: "/contact", why: "Human help" },
      { question: "Methodology sources", href: "/methodology", why: "Ruleset basis" },
      { question: "Product capabilities", href: "/product", why: "What you get" },
    ],
    entities: ["CBAMValid", "independent software service", "IIT Bombay mathematical review"],
    fanOutQueries: [
      "is CBAMValid an official EU service",
      "who reviews CBAMValid calculations",
      "CBAMValid independence notice",
    ],
  },
  {
    path: "/contact",
    primaryQuestion: "How do I contact CBAMValid for technical, billing, or legal questions?",
    empathyLead:
      "When a seal is blocked or a buyer is waiting, you need a real inbox — not a ticket black hole.",
    directAnswer:
      "Email info@cbamvalid.com for technical, dossier, and billing help. Legal and privacy requests use the published legal and privacy addresses on the contact page. Typical response window is 24–48 business hours.",
    calculation:
      "Support does not recalculate sealed releases client-side. Authoritative numbers remain those sealed by the server engine for a specific case snapshot.",
    explanation:
      "Include your case ID, reporting year, and the blocker text when asking for technical help so diagnosis stays fast.",
    methodology:
      "Support answers product and workflow questions; accredited verification opinions remain outside CBAMValid’s scope.",
    evidence:
      "Canonical support identity is info@cbamvalid.com as published in site legal configuration.",
    expert:
      "Support staff explain product boundaries. Academic mathematical review of engines is separate from day-to-day support tickets.",
    relatedProblems: [
      { question: "Pricing and pack scope", href: "/pricing", why: "Billing clarity" },
      { question: "About independence", href: "/about", why: "Who we are" },
      { question: "Refund policy", href: "/refund-policy", why: "Commercial terms" },
    ],
    entities: ["info@cbamvalid.com", "technical support", "billing support"],
    fanOutQueries: [
      "CBAMValid support email",
      "CBAMValid billing contact",
      "CBAMValid GDPR contact",
    ],
  },
] as const;

export function getAuthorityChain(path: string): AuthorityChainRecord | undefined {
  return AUTHORITY_CHAINS.find((chain) => chain.path === path);
}

export function listAuthorityChainPaths(): readonly string[] {
  return AUTHORITY_CHAINS.map((chain) => chain.path);
}
