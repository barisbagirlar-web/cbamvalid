import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SEO_ROUTE_REGISTRY } from "../../lib/seo/registry";
import type { SeoRouteContract } from "../../lib/seo/types";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const CONTENT_ASSETS_PATH = resolve(ROOT, "data/seo/content_assets.json");
const DATA_ASSET_PLAN_PATH = resolve(ROOT, "data/seo/data_asset_plan.json");
const CONFIG_PATH = resolve(ROOT, "sites/cbamvalid/seo.config.json");
const DECISION_LOG_PATH = resolve(ROOT, "docs/seo/KARAR_DEFTERI.md");

type ContentOrigin = "human_existing" | "ai_assisted" | "ai_generated" | "programmatic";
type PublicationStatus = "draft" | "published" | "retired";
type ExpertReviewStatus = "verified" | "missing" | "not_required";

type ContentAsset = {
  id: string;
  path: string;
  origin: ContentOrigin;
  publicationStatus: PublicationStatus;
  lastMeaningfulChangeAt: string | null;
  lastReviewAt: string | null;
  regulatoryRisk: "low" | "medium" | "high";
  expertReview: {
    required: boolean;
    status: ExpertReviewStatus;
    reviewerEvidence: string | null;
  };
  humanApproval: {
    required: boolean;
    approved: boolean | null;
    decisionId: string | null;
  };
};

type ContentAssetsArtifact = {
  data: {
    publicationPolicy: {
      automaticAiPublicationAllowed: boolean;
      humanApprovalRequiredForAiPublication: boolean;
      unverifiedExpertIdentityAllowed: boolean;
    };
    assets: ContentAsset[];
  };
};

type DataSourceClass = "official_public" | "synthetic_sample" | "user_derived" | "user_private";
type PrivacyStatus = "not_required" | "pending" | "approved" | "not_publishable";

export type DataAsset = {
  id: string;
  sourceClass: DataSourceClass;
  purpose: string;
  containsPersonalData: boolean | "unknown" | "possible";
  privacyReview: {
    required: boolean;
    status: PrivacyStatus;
    decisionId: string | null;
  };
  publicPublicationAllowed: boolean;
};

type DataAssetPlanArtifact = {
  data: {
    assets: DataAsset[];
    policy: {
      userDerivedPublicDataRequiresApprovedPrivacyReview: boolean;
      privateCustomerEvidencePublicPublicationAllowed: boolean;
      aggregatePublicationDefault: "deny" | "allow";
    };
  };
};

type SeoConfig = {
  thresholds: {
    similarityMax: number;
    decayDays: number;
    contentDebtWarnPct: number;
  };
};

export type SimilarityDocument = {
  id: string;
  text: string;
};

export type ContentGovernanceResult = {
  blocks: string[];
  warnings: string[];
  info: string[];
  stats: {
    managedAssets: number;
    similarityPairsChecked: number;
    maxSimilarity: number;
    staleAssets: number;
    expertReviewGaps: number;
    dataAssets: number;
  };
};

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "cbam", "cbamvalid", "for", "from", "how", "in", "is", "it", "of", "on", "or", "the", "to", "with",
]);

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function isIsoDate(value: string | null): boolean {
  if (value === null) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function decisionMarker(assetId: string): string {
  return `APPROVE_AI_CONTENT_PUBLICATION:${assetId}`;
}

export function validateAiPublicationApprovals(assets: readonly ContentAsset[], decisionLog: string): string[] {
  const blocks: string[] = [];
  for (const asset of assets) {
    const aiOrigin = asset.origin === "ai_assisted" || asset.origin === "ai_generated" || asset.origin === "programmatic";
    if (!aiOrigin || asset.publicationStatus !== "published") continue;
    if (!asset.humanApproval.required || asset.humanApproval.approved !== true || !asset.humanApproval.decisionId) {
      blocks.push(`INV-5.1 AI-origin published asset lacks explicit human approval ${asset.id}`);
      continue;
    }
    if (!decisionLog.includes(decisionMarker(asset.id))) {
      blocks.push(`INV-5.1 AI-origin approval decision not found in decision ledger ${asset.id}`);
    }
  }
  return uniqueSorted(blocks);
}

function normalizedTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

/**
 * Similarity uses both lexical tokens and adjacent token bigrams. Unigram-only
 * Jaccard over-weights shared template vocabulary on structured CN pages and can
 * falsely classify different product intents as duplicates. Bigrams preserve
 * phrase/order evidence while near-duplicate copy still scores high.
 */
function similarityFeatures(text: string): Set<string> {
  const tokens = normalizedTokens(text);
  const features = new Set(tokens);
  for (let index = 0; index + 1 < tokens.length; index += 1) {
    features.add(`${tokens[index]}::${tokens[index + 1]}`);
  }
  return features;
}

export function jaccardSimilarity(left: string, right: string): number {
  const a = similarityFeatures(left);
  const b = similarityFeatures(right);
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const feature of a) if (b.has(feature)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function validateSimilarityPairs(
  documents: readonly SimilarityDocument[],
  similarityMax: number,
): { blocks: string[]; pairsChecked: number; maxSimilarity: number } {
  const blocks: string[] = [];
  let pairsChecked = 0;
  let maxSimilarity = 0;
  for (let leftIndex = 0; leftIndex < documents.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < documents.length; rightIndex += 1) {
      const left = documents[leftIndex]!;
      const right = documents[rightIndex]!;
      const score = jaccardSimilarity(left.text, right.text);
      pairsChecked += 1;
      maxSimilarity = Math.max(maxSimilarity, score);
      if (score > similarityMax) {
        blocks.push(`INV-5.2 content similarity ${score.toFixed(4)} > ${similarityMax.toFixed(4)} for ${left.id} <> ${right.id}`);
      }
    }
  }
  return { blocks: uniqueSorted(blocks), pairsChecked, maxSimilarity };
}

export function buildRegistrySimilarityDocuments(routes: readonly SeoRouteContract[]): SimilarityDocument[] {
  return routes
    .filter((route) => route.indexability === "index")
    .map((route) => ({
      id: route.path,
      text: [route.title, route.h1, route.description, route.primaryIntent].join(" "),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function validateContentDates(assets: readonly ContentAsset[], now: Date): string[] {
  const blocks: string[] = [];
  const today = now.toISOString().slice(0, 10);
  for (const asset of assets) {
    if (!isIsoDate(asset.lastMeaningfulChangeAt)) blocks.push(`INV-5.6 invalid significant-change date ${asset.id}`);
    if (!isIsoDate(asset.lastReviewAt)) blocks.push(`INV-5.6 invalid review date ${asset.id}`);
    if (asset.lastMeaningfulChangeAt && asset.lastMeaningfulChangeAt > today) blocks.push(`INV-5.6 future significant-change date ${asset.id}`);
    if (asset.lastReviewAt && asset.lastReviewAt > today) blocks.push(`INV-5.6 future review date ${asset.id}`);
    if (asset.lastMeaningfulChangeAt && asset.lastReviewAt && asset.lastReviewAt < asset.lastMeaningfulChangeAt) {
      blocks.push(`INV-5.6 review predates significant change ${asset.id}`);
    }
  }
  return uniqueSorted(blocks);
}

export function evaluateContentDebt(
  assets: readonly ContentAsset[],
  now: Date,
  decayDays: number,
  contentDebtWarnPct: number,
): { warnings: string[]; staleAssets: string[] } {
  const staleAssets = assets
    .filter((asset) => asset.publicationStatus === "published" && asset.lastMeaningfulChangeAt)
    .filter((asset) => {
      const changedAt = Date.parse(`${asset.lastMeaningfulChangeAt}T00:00:00.000Z`);
      const ageDays = Math.floor((now.getTime() - changedAt) / 86_400_000);
      return ageDays > decayDays && (!asset.lastReviewAt || asset.lastReviewAt < asset.lastMeaningfulChangeAt!);
    })
    .map((asset) => asset.id)
    .sort();
  const publishedCount = assets.filter((asset) => asset.publicationStatus === "published").length;
  const debtPct = publishedCount === 0 ? 0 : (staleAssets.length * 100) / publishedCount;
  const warnings = debtPct > contentDebtWarnPct
    ? [`INV-5.3 content decay debt ${debtPct.toFixed(2)}% > ${contentDebtWarnPct}% (${staleAssets.join(",")})`]
    : [];
  return { warnings, staleAssets };
}

export function expertAuthorityWarnings(assets: readonly ContentAsset[]): string[] {
  return assets
    .filter((asset) => asset.expertReview.required && asset.expertReview.status !== "verified")
    .map((asset) => `INV-5.4 expert review evidence missing ${asset.id}`)
    .sort();
}

export function validateDataAssetPrivacy(assets: readonly DataAsset[]): string[] {
  const blocks: string[] = [];
  for (const asset of assets) {
    const customerDerived = asset.sourceClass === "user_derived" || asset.sourceClass === "user_private";
    if (!customerDerived || !asset.publicPublicationAllowed) continue;
    if (!asset.privacyReview.required || asset.privacyReview.status !== "approved" || !asset.privacyReview.decisionId) {
      blocks.push(`INV-5.5 customer-derived data asset cannot be public without approved privacy review ${asset.id}`);
    }
    if (asset.sourceClass === "user_private") {
      blocks.push(`INV-5.5 private customer evidence cannot be a public data asset ${asset.id}`);
    }
  }
  return uniqueSorted(blocks);
}

function validateManagedPaths(assets: readonly ContentAsset[], routes: readonly SeoRouteContract[]): string[] {
  const registry = new Set(routes.map((route) => route.path));
  return assets.filter((asset) => !registry.has(asset.path)).map((asset) => `INV-5.6 managed content path missing from SEO registry ${asset.path}`).sort();
}

export function runContentGovernance(now = new Date()): ContentGovernanceResult {
  const contentArtifact = readJson<ContentAssetsArtifact>(CONTENT_ASSETS_PATH);
  const dataPlan = readJson<DataAssetPlanArtifact>(DATA_ASSET_PLAN_PATH);
  const config = readJson<SeoConfig>(CONFIG_PATH);
  const decisionLog = readFileSync(DECISION_LOG_PATH, "utf8");
  const assets = contentArtifact.data.assets;
  const blocks: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  if (contentArtifact.data.publicationPolicy.automaticAiPublicationAllowed) {
    blocks.push("INV-5.1 automatic AI publication must remain disabled");
  }
  blocks.push(...validateAiPublicationApprovals(assets, decisionLog));
  blocks.push(...validateContentDates(assets, now));
  blocks.push(...validateManagedPaths(assets, SEO_ROUTE_REGISTRY));

  const similarity = validateSimilarityPairs(
    buildRegistrySimilarityDocuments(SEO_ROUTE_REGISTRY),
    config.thresholds.similarityMax,
  );
  blocks.push(...similarity.blocks);

  const debt = evaluateContentDebt(
    assets,
    now,
    config.thresholds.decayDays,
    config.thresholds.contentDebtWarnPct,
  );
  warnings.push(...debt.warnings);

  const authorityWarnings = expertAuthorityWarnings(assets);
  warnings.push(...authorityWarnings);
  blocks.push(...validateDataAssetPrivacy(dataPlan.data.assets));

  info.push(`INV-5.6 managed significant-change timestamps=${assets.filter((asset) => asset.lastMeaningfulChangeAt !== null).length}`);
  return {
    blocks: uniqueSorted(blocks),
    warnings: uniqueSorted(warnings),
    info: uniqueSorted(info),
    stats: {
      managedAssets: assets.length,
      similarityPairsChecked: similarity.pairsChecked,
      maxSimilarity: similarity.maxSimilarity,
      staleAssets: debt.staleAssets.length,
      expertReviewGaps: authorityWarnings.length,
      dataAssets: dataPlan.data.assets.length,
    },
  };
}

function main(): void {
  const result = runContentGovernance();
  console.log(`PHASE5_MANAGED_ASSETS=${result.stats.managedAssets}`);
  console.log(`PHASE5_SIMILARITY_PAIRS=${result.stats.similarityPairsChecked}`);
  console.log(`PHASE5_MAX_SIMILARITY=${result.stats.maxSimilarity.toFixed(4)}`);
  console.log(`PHASE5_STALE_ASSETS=${result.stats.staleAssets}`);
  console.log(`PHASE5_EXPERT_REVIEW_GAPS=${result.stats.expertReviewGaps}`);
  console.log(`PHASE5_DATA_ASSETS=${result.stats.dataAssets}`);
  for (const line of result.info) console.log(`INFO ${line}`);
  for (const warning of result.warnings) console.warn(`WARN ${warning}`);
  for (const block of result.blocks) console.error(`BLOCK ${block}`);
  if (result.blocks.length > 0) process.exit(1);
  if (result.warnings.length > 0) process.exit(2);
  console.log(process.argv.includes("--dry-run") ? "SEO_V6_PHASE5=PASS_DRY_RUN" : "SEO_V6_PHASE5=PASS");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
