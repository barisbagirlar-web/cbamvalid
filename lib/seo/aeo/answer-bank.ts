import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";
import type { AeoAnswerRecord } from "./types";

const PRICE = CANONICAL_PRICING.priceFormatted;
const PACK = CANONICAL_PRICING.packName;

/**
 * Canonical Answer + Evidence bank for AEO / FAQPage / visible page blocks.
 * Only verified commercial and product facts — no synthetic social proof.
 */
export const AEO_ANSWER_BANK: readonly AeoAnswerRecord[] = [
  {
    id: "what-does-usd-249-buy",
    question: `What does ${PRICE} buy on CBAMValid?`,
    aliases: [
      "CBAMValid price",
      "Exporter Verification Preparation Pack cost",
      "is CBAMValid a subscription",
      "what is included in the preparation pack",
    ],
    directAnswer: `${PRICE} buys one ${PACK}: one locked working file for one legal operator, one production installation, and one reporting year — with unlimited drafts and exactly ${CANONICAL_PRICING.includedSealedReleases} successful sealed releases. It is a one-time pack, not a subscription, and not a soft Excel-only export.`,
    empathyContext:
      "EU buyers increasingly ask for actual embedded-emissions evidence. Paying once should cover real correction cycles without trapping you in a vague “credits” story or an open-ended SaaS bill.",
    evidence: [
      {
        label: "Commercial unit",
        detail: `1 operator + 1 installation + 1 reporting year · ${CANONICAL_PRICING.includedSealedReleases} sealed releases · unlimited drafts`,
        href: "/pricing",
        evidenceStatus: "verified",
      },
      {
        label: "Payment timing",
        detail: "Card is charged at checkout when you buy the pack. Sealing uses a release from that pack; it does not charge again.",
        href: "/pricing",
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
    directAnswer: `Drafting and editing are free. Your card is charged when you buy the ${PACK} (${PRICE}) at checkout. Each successful seal then uses one of the ${CANONICAL_PRICING.includedSealedReleases} included releases. Failed seals use none. Re-download of a sealed package is free.`,
    empathyContext:
      "Nobody wants a surprise charge mid-review. You should be able to finish data quality work first, then buy a pack when you are ready to seal deliverables for your buyer or verifier.",
    evidence: [
      {
        label: "Draft policy",
        detail: CANONICAL_PRICING.draftPolicy,
        href: "/pricing",
        evidenceStatus: "verified",
      },
      {
        label: "Release consumption",
        detail: "Only a successful seal consumes one release. Blocked or failed seals consume zero.",
        href: "/how-it-works",
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
      "No. One Preparation Pack is scoped to one legal operator, one installation, and one reporting year. Another factory or another reporting year requires another pack. Within that locked scope you may draft freely and seal up to five times.",
    empathyContext:
      "This protects honest customers who need correction versions, and blocks paying once then quietly renaming a case into a different plant or year.",
    evidence: [
      {
        label: "Scope rule",
        detail: "1 operator · 1 installation · 1 reporting year per pack",
        href: "/pricing",
        evidenceStatus: "verified",
      },
      {
        label: "Correction releases",
        detail: `${CANONICAL_PRICING.includedSealedReleases} successful sealed releases for corrections inside the same scope`,
        href: "/pricing",
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
      "You create one working file for one installation and one reporting year, enter goods and production data, link evidence, clear quality blockers, buy the Preparation Pack at checkout, then lock up to five immutable packages and download PDF, JSON, and O3CI field-mapped exports.",
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
      "Embedded emissions combine direct process/combustion emissions and, where required, electricity-related indirect emissions, plus applicable precursor emissions. Missing material inputs must block authoritative results rather than becoming silent zeros.",
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
    question: "Can one USD 249 pack cover a second plant or another reporting year?",
    aliases: [
      "CBAMValid multi plant pricing",
      "one pack two installations",
      "CBAMValid scope lock",
    ],
    directAnswer: `No. ${PRICE} covers one locked working file: one legal operator, one production installation, and one reporting year, with ${CANONICAL_PRICING.includedSealedReleases} successful sealed releases inside that scope. Another plant or year requires another pack.`,
    empathyContext:
      "Procurement teams often hope one purchase covers the group. Scope lock prevents silent widening that would break evidence and entitlement integrity.",
    evidence: [
      {
        label: "Commercial unit",
        detail: "1 operator + 1 installation + 1 reporting year",
        href: "/pricing",
        evidenceStatus: "verified",
      },
      {
        label: "Release math",
        detail: "Failed seals consume zero; re-download is free; corrections create new sealed versions inside the same pack",
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
      "Start a free draft for one installation and one reporting year, confirm CN scope, enter production and emissions inputs you already have, link available evidence, and clear visible blockers. Buy the pack only when you are ready to seal a handover package — drafting does not charge your card.",
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
] as const;

export function listAnswersForRoute(path: string): AeoAnswerRecord[] {
  return AEO_ANSWER_BANK.filter((answer) => answer.routes.includes(path));
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
