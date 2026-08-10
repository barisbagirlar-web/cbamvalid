import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type RegistryRecord = {
  route: string;
  type: string;
  status: string;
  primaryEntity: string;
  linkableAsset: boolean;
};

export type DisavowDecision = {
  manualAction: boolean;
  provenNegativeSeo: boolean;
  a3ApprovalId: string | null;
  decisionRecordId: string | null;
};

export type OffpageTactic =
  | "earned_pr"
  | "unlinked_mention_outreach"
  | "paid_link"
  | "pbn"
  | "link_exchange"
  | "mass_guest_post"
  | "cross_site_link_network";

export const MANDATE_ASSET_TYPES = [
  "data-study",
  "tool-calculator",
  "template-checklist",
  "original-research",
  "expert-commentary-repository",
  "visual-asset",
] as const;

export function buildLinkableAssetInventory(records: readonly RegistryRecord[]) {
  const assets = records
    .filter((record) => record.status === "live" && record.linkableAsset)
    .map((record) => ({
      route: record.route,
      registryType: record.type,
      primaryEntity: record.primaryEntity,
      registryLinkableAsset: true as const,
      mandateAssetType: inferMandateAssetType(record.route),
    }))
    .sort((a, b) => a.route.localeCompare(b.route));

  return {
    requiredAssetTypes: [...MANDATE_ASSET_TYPES],
    assets,
    linkableAssetCount: assets.length,
    prCampaignEligible: assets.length > 0,
    prCampaignStatus: assets.length > 0 ? "REQUIRES_A3_APPROVAL" : "BLOCKED_NO_LINKABLE_ASSET",
  };
}

function inferMandateAssetType(route: string): (typeof MANDATE_ASSET_TYPES)[number] | null {
  if (route === "/sample-dossier") return "template-checklist";
  if (route === "/answers" || route === "/glossary") return "expert-commentary-repository";
  return null;
}

export function assertPrCampaignAllowed(linkableAssetCount: number): void {
  if (linkableAssetCount < 1) throw new Error("INV-13.3 PR campaign cannot be proposed without a registry linkable asset");
}

export function assertDisavowAllowed(decision: DisavowDecision): void {
  const evidenceCondition = decision.manualAction || decision.provenNegativeSeo;
  if (!evidenceCondition || !decision.a3ApprovalId || !decision.decisionRecordId) {
    throw new Error("INV-13.1 disavow requires manual-action/proven-negative-SEO evidence plus A3 approval plus KARAR_DEFTERI decision");
  }
}

export function assertOffpageTacticAllowed(tactic: OffpageTactic): void {
  const prohibited = new Set<OffpageTactic>([
    "paid_link",
    "pbn",
    "link_exchange",
    "mass_guest_post",
    "cross_site_link_network",
  ]);
  if (prohibited.has(tactic)) {
    throw new Error(`INV-13.2 YETKI_IHLALI prohibited off-page tactic: ${tactic}`);
  }
}

export function auditBacklinks(rows: readonly unknown[]) {
  if (rows.length === 0) {
    return {
      status: "SKIP_NO_DATA" as const,
      partial: true,
      sourceDistribution: null,
      anchorDistribution: null,
      toxicSignals: [],
      action: "REPORT_ONLY_NO_DISAVOW",
      reason: "No connected backlink dataset; no authority/toxicity metric is invented.",
    };
  }
  return {
    status: "PASS" as const,
    partial: false,
    sourceDistribution: "INPUT_REQUIRED_BY_CALLER",
    anchorDistribution: "INPUT_REQUIRED_BY_CALLER",
    toxicSignals: [],
    action: "REPORT_ONLY_NO_DISAVOW",
  };
}

export function evaluateBrandDemand(input: {
  gscBrandQueries: number | null;
  gscNonBrandQueries: number | null;
  adsBrandVolume: number | null;
  directTrafficSharePct: number | null;
  brandSerpOwnershipPct: number | null;
  brandSerpOwnershipWarnPct: number;
  aiCitationSamplePct: number | null;
  aiCitationMethod: string | null;
}) {
  const brandSeriesAvailable =
    input.gscBrandQueries !== null &&
    input.gscNonBrandQueries !== null &&
    input.adsBrandVolume !== null &&
    input.directTrafficSharePct !== null;
  const brandSerpStatus =
    input.brandSerpOwnershipPct === null
      ? "SKIP_NO_DATA"
      : input.brandSerpOwnershipPct < input.brandSerpOwnershipWarnPct
        ? "WARN"
        : "PASS";
  const aiCitationStatus =
    input.aiCitationSamplePct === null || !input.aiCitationMethod ? "SKIP_NO_DATA" : "PASS";

  return {
    brandNonBrandSeparation: brandSeriesAvailable ? "PASS" : "SKIP_NO_DATA",
    gscBrandQueries: input.gscBrandQueries,
    gscNonBrandQueries: input.gscNonBrandQueries,
    adsBrandVolume: input.adsBrandVolume,
    directTrafficSharePct: input.directTrafficSharePct,
    brandSerpOwnershipPct: input.brandSerpOwnershipPct,
    brandSerpStatus,
    aiCitationSamplePct: input.aiCitationSamplePct,
    aiCitationMethod: input.aiCitationMethod,
    aiCitationStatus,
    partial: !brandSeriesAvailable || brandSerpStatus === "SKIP_NO_DATA" || aiCitationStatus === "SKIP_NO_DATA",
  };
}

function main() {
  const registry = JSON.parse(
    readFileSync(resolve(process.cwd(), "data/seo/registry/cbamvalid_seo_registry.json"), "utf8"),
  ) as { data: { records: RegistryRecord[] } };
  const config = JSON.parse(
    readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8"),
  ) as { thresholds: { brandSerpOwnershipWarnPct: number }; policy: { perplexityQuery: string | null } };

  const inventory = buildLinkableAssetInventory(registry.data.records);
  assertPrCampaignAllowed(inventory.linkableAssetCount);
  const backlinkAudit = auditBacklinks([]);
  const brandDemand = evaluateBrandDemand({
    gscBrandQueries: null,
    gscNonBrandQueries: null,
    adsBrandVolume: null,
    directTrafficSharePct: null,
    brandSerpOwnershipPct: null,
    brandSerpOwnershipWarnPct: config.thresholds.brandSerpOwnershipWarnPct,
    aiCitationSamplePct: null,
    aiCitationMethod: config.policy.perplexityQuery ? "configured-query-pending-permitted-sampler" : null,
  });
  console.log(`SEO_OFFPAGE_RESULT=${JSON.stringify({ inventory, backlinkAudit, brandDemand })}`);
}

if (process.argv[1]?.endsWith("audit-offpage.ts")) main();
