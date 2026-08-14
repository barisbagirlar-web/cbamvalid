import {
  INDEPENDENCE_CLAIM,
  PRICE_CLAIM,
  PRODUCT_POSITIONING_CLAIM,
  SEALED_OUTPUT_BOUNDARY_CLAIM,
  SUPPORT_EMAIL_CLAIM,
  assertVerifiedClaim,
} from "./claims";
import { listVerifiedRegulatoryStatements, SEO_LEGAL_SOURCE_INDEX } from "./regulatory-sources";
import { listSitemapRoutes } from "./registry";
import { siteConfig } from "@/lib/site-config";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

export interface LlmDocModel {
  readonly title: string;
  readonly summary: string;
  readonly productPositioning: string;
  readonly independence: string;
  readonly pricingLine: string;
  readonly supportEmail: string;
  readonly resources: readonly { readonly title: string; readonly url: string; readonly note: string }[];
  readonly sealedOutputs: readonly string[];
  readonly regulatoryStatements: readonly string[];
  readonly legalSources: readonly { readonly id: string; readonly title: string; readonly url: string }[];
  readonly lastUpdated: string;
}

const RESOURCE_OVERRIDES: Readonly<Record<string, { title: string; note: string }>> = {
  "/": {
    title: "Self-Service Emissions Data Software",
    note: "B2B software overview, customer-controlled workflow and automated digital delivery",
  },
  "/product": {
    title: "Software Product and Capabilities",
    note: "Deterministic calculations, automated quality controls and digital exports",
  },
  "/pricing": {
    title: "Software Pricing",
    note: "USD 449 one-time working-file software unlock",
  },
  "/sample-dossier": {
    title: "Sample Automated Digital Output",
    note: "Gate-free PDF, JSON and XLSX preview; live seals ship a 25-file verifier ZIP plus a separate operator Master Record",
  },
  "/verify": {
    title: "Digital Package Integrity Check",
    note: "Public hash and signature verification for sealed software outputs",
  },
};

export function buildLlmDocModel(): LlmDocModel {
  const price = assertVerifiedClaim(PRICE_CLAIM, "PRICE_CLAIM");
  const resources = listSitemapRoutes()
    .filter((route) => route.pageType !== "legal" && route.pageType !== "cn-detail")
    .slice(0, 24)
    .map((route) => {
      const override = RESOURCE_OVERRIDES[route.canonicalPath];
      return {
        title: override?.title ?? route.h1,
        url: `${siteConfig.canonicalOrigin}${route.canonicalPath === "/" ? "" : route.canonicalPath}`,
        note: override?.note ?? route.primaryIntent,
      };
    });

  return {
    title: "CBAMValid — Self-Service Emissions Data Software",
    summary:
      "CBAMValid (https://cbamvalid.com) is privately operated self-service B2B software for customer-entered emissions data, deterministic calculations, automated quality controls, and automated PDF, JSON and XLSX delivery.",
    productPositioning: assertVerifiedClaim(PRODUCT_POSITIONING_CLAIM, "PRODUCT_POSITIONING_CLAIM"),
    independence: assertVerifiedClaim(INDEPENDENCE_CLAIM, "INDEPENDENCE_CLAIM"),
    pricingLine: `${price.formatted} per ${price.packName} (one-time; no subscription; unlimited drafts; 1 installation; 1 reporting year; pay once to lock a working file — ${CANONICAL_PRICING.correctionPolicy.toLowerCase()}).`,
    supportEmail: assertVerifiedClaim(SUPPORT_EMAIL_CLAIM, "SUPPORT_EMAIL_CLAIM"),
    resources,
    sealedOutputs: assertVerifiedClaim(SEALED_OUTPUT_BOUNDARY_CLAIM, "SEALED_OUTPUT_BOUNDARY_CLAIM"),
    regulatoryStatements: listVerifiedRegulatoryStatements(),
    legalSources: Object.values(SEO_LEGAL_SOURCE_INDEX).map((source) => ({
      id: source.id,
      title: source.title,
      url: source.eliUri,
    })),
    lastUpdated: "2026-08-14",
  };
}

export function renderLlmsTxt(model: LlmDocModel): string {
  const lines: string[] = [
    `# ${model.title}`,
    "",
    `> ${model.summary}`,
    "",
    "## Product positioning",
    "",
    `- ${model.productPositioning}`,
    `- Pricing: ${model.pricingLine}`,
    "",
    "## Product boundary",
    "",
    model.independence,
    "",
    "## Sealed digital outputs",
    "",
  ];

  for (const line of model.sealedOutputs) {
    lines.push(`- ${line}`);
  }

  lines.push(
    "",
    "## Core public resources",
    "",
  );

  for (const resource of model.resources) {
    lines.push(`- [${resource.title}](${resource.url}): ${resource.note}`);
  }

  lines.push("", "## Key regulatory facts", "");
  for (const statement of model.regulatoryStatements) {
    lines.push(`- ${statement}`);
  }

  lines.push("", "## Authoritative source families", "");
  for (const source of model.legalSources) {
    lines.push(`- ${source.id}: [${source.title}](${source.url})`);
  }

  lines.push(
    "",
    "## Contact",
    "",
    `- Website: ${siteConfig.canonicalOrigin}`,
    `- Support: ${model.supportEmail}`,
    "",
    `Last updated: ${model.lastUpdated}`,
    "",
  );

  return lines.join("\n");
}

export function renderLlmsFullTxt(model: LlmDocModel): string {
  return [
    renderLlmsTxt(model).trimEnd(),
    "",
    "## Scope limitations",
    "",
    "- Outputs are generated from customer-entered data",
    "- Customers manage external submissions and third-party review independently",
    "- The software does not issue accredited opinions or authority acceptance",
    "- The operator Master Record is not a verifier ZIP member",
    "- Directory entries are not counted as verifier package components",
    "- No synthetic customer counts, ratings, or testimonials",
    "",
  ].join("\n");
}
