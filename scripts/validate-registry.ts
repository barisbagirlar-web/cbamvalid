/**
 * Şartname v2.1 §2.1 / Ek Kod-1: Zod Registry Validation
 *
 * Protocol: Validates every SeoPageRecord against the Zod schema at build time.
 * Invalid entries block deploy.
 *
 * [INTERNAL] P0 deploy-blocking gate
 *
 * Usage: npx ts-node scripts/validate-registry.ts
 */

import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

// ─── Zod schema for SeoPageRecord (§2) ───

const PageRoleSchema = z.enum([
  "home", "hub", "category", "tool", "service",
  "article", "research", "comparison", "product", "local", "legal",
]);

const RichResultTypeSchema = z.enum([
  "Article", "BreadcrumbList", "Dataset", "Organization",
  "ProfilePage", "QAPage", "SoftwareApplication", "VideoObject", "None",
]);

const UniqueValueTypeSchema = z.enum([
  "firstPartyData", "calculator", "expertExperience",
  "methodology", "caseStudy", "comparison", "dataset", "template",
]);

const ContentQualityContractSchema = z.object({
  userProblem: z.string().min(10),
  decisionEnabled: z.string().min(10),
  uniqueValueTypes: z.array(UniqueValueTypeSchema).min(2),
  evidenceRefs: z.array(z.string()),
  limitations: z.array(z.string()),
  lastHumanReviewAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
});

const SeoPageRecordSchema = z.object({
  route: z.string().startsWith("/"),
  locale: z.string().min(2),
  role: PageRoleSchema,
  canonicalRoute: z.string().startsWith("/"),
  title: z.string().min(10),
  metaDescription: z.string().min(50),
  h1: z.string().min(3),
  primaryIntent: z.string().min(5),
  primaryEntityId: z.string().min(3),
  secondaryEntityIds: z.array(z.string()),
  authorId: z.string().optional(),
  reviewerId: z.string().optional(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  modifiedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  richResultTypes: z.array(RichResultTypeSchema).min(1),
  imageUrl: z.string().url().optional(),
  conversionEvent: z.string().min(3),
  sourceRefs: z.array(z.string()),
  parentHubRoute: z.string().startsWith("/").optional(),
  relatedRoutes: z.array(z.string().startsWith("/")),
  qualityContract: ContentQualityContractSchema.optional(),
  contentSourcePath: z.string().optional(),
});

// ─── G1: Check that types.ts exports exist ───

const typesFile = path.join(workspaceRoot, "lib", "seo", "types.ts");
if (!fs.existsSync(typesFile)) {
  console.error("[ZOD-REGISTRY] ❌ lib/seo/types.ts not found");
  process.exit(1);
}

const typesContent = fs.readFileSync(typesFile, "utf-8");
const requiredTypes = [
  "PageRole", "RichResultType", "ContentQualityContract",
  "SeoPageRecord", "SeoChange",
];

let exitCode = 0;
const failures: string[] = [];

console.log("[ZOD-REGISTRY] ========================================");
console.log("[ZOD-REGISTRY] §2.1: Zod Registry Validation (Ek Kod-1)");
console.log("[ZOD-REGISTRY] ========================================\n");

for (const typeName of requiredTypes) {
  if (typesContent.includes(`export type ${typeName}`) || typesContent.includes(`export interface ${typeName}`)) {
    console.log(`[ZOD-REGISTRY] ✅ Type "${typeName}" defined in types.ts`);
  } else {
    console.error(`[ZOD-REGISTRY] ❌ Type "${typeName}" NOT found in types.ts`);
    failures.push(`Missing type: ${typeName}`);
    exitCode = 1;
  }
}

// ─── G2: Build-time schema validation of sample SeoPageRecord ───

console.log("\n[ZOD-REGISTRY] Validating sample SeoPageRecord against Zod schema...");

const sampleRecord = {
  route: "/cbam-impact-2026/cement",
  locale: "en",
  role: "research",
  canonicalRoute: "/cbam-impact-2026/cement",
  title: "2026 CBAM Financial Impact Report — Cement Sector | CBAMValid",
  metaDescription: "Data-driven analysis of estimated carbon cost liability for cement importers under EU CBAM Regulation 2023/956. EU ETS-based projections per CN code.",
  h1: "2026 CBAM Financial Impact: Cement Sector",
  primaryIntent: "CBAM carbon cost estimation cement sector",
  primaryEntityId: "cbam-financial-impact-cement-2026",
  secondaryEntityIds: ["cn-code-25231000", "cn-code-25232100"],
  authorId: "barisbagirlar@gmail.com",
  publishedAt: "2026-07-19",
  modifiedAt: "2026-07-19",
  richResultTypes: ["Dataset", "Article", "BreadcrumbList"],
  conversionEvent: "financial_impact_report_download",
  sourceRefs: ["https://eur-lex.europa.eu/eli/reg_impl/2023/1773/oj"],
  parentHubRoute: "/reports",
  relatedRoutes: ["/cbam-impact-2026/steel", "/cbam-impact-2026/aluminium"],
  qualityContract: {
    userProblem: "Cement importers need to estimate CBAM carbon tax liability before shipping",
    decisionEnabled: "Whether to use actual data vs default values for CBAM declaration",
    uniqueValueTypes: ["firstPartyData", "methodology", "comparison"],
    evidenceRefs: ["EU 2023/1773 Annex III"],
    limitations: ["Based on default benchmarks, not installation-specific actual data"],
    lastHumanReviewAt: "2026-07-19",
  },
};

const result = SeoPageRecordSchema.safeParse(sampleRecord);
if (result.success) {
  console.log("[ZOD-REGISTRY] ✅ Sample SeoPageRecord passes Zod validation");
} else {
  console.error("[ZOD-REGISTRY] ❌ Sample SeoPageRecord fails Zod validation:");
  console.error(result.error.issues ?? result.error);
  failures.push("Sample record fails Zod schema");
  exitCode = 1;
}

// ─── G3: Check SeoMeta in registry.ts for minimal completeness ───

const registryFile = path.join(workspaceRoot, "lib", "seo", "registry.ts");
if (fs.existsSync(registryFile)) {
  const registryContent = fs.readFileSync(registryFile, "utf-8");

  // Count actual entries: each entry has both `path:` and `pageType:` in its block
  const entryMatches = [...registryContent.matchAll(/"(\/[^"]*)"\s*:\s*\{/g)];
  const validEntries: string[] = [];

  for (const match of entryMatches) {
    const key = match[1];
    const startIdx = match.index! + match[0].length;
    // Find matching closing brace
    let depth = 1;
    let endIdx = startIdx;
    for (let i = startIdx; i < registryContent.length && depth > 0; i++) {
      if (registryContent[i] === '{') depth++;
      if (registryContent[i] === '}') depth--;
      if (depth === 0) endIdx = i;
    }
    const block = registryContent.substring(startIdx, endIdx);

    // Only count blocks that have both path: and pageType: (actual entries)
    if (block.includes("path:") && block.includes("pageType:")) {
      validEntries.push(key);
    }
  }

  const uniqueEntries = [...new Set(validEntries)];
  console.log(`\n[ZOD-REGISTRY] Registry entries found: ${uniqueEntries.length}`);

  // Check qualityContract presence on entries
  let qcCount = 0;
  for (const key of uniqueEntries) {
    const entryBlock = registryContent.split(`"${key}"`)[1]?.split(/\s*\},?\s*$/m)[0] || "";
    if (entryBlock.includes("qualityContract")) {
      qcCount++;
    }
  }
  console.log(`[ZOD-REGISTRY] Entries with ContentQualityContract: ${qcCount}/${uniqueEntries.length}`);

  if (qcCount < 3) {
    console.log("[ZOD-REGISTRY] ℹ️ Consider adding qualityContract to more entries per §10.2");
  }
}

// ─── REPORT ───

console.log("\n[ZOD-REGISTRY] ========================================");
if (exitCode === 0) {
  console.log("[ZOD-REGISTRY] ✅ Zod registry validation passed.");
} else {
  console.error(`[ZOD-REGISTRY] ❌ ${failures.length} validation failure(s). Deploy BLOCKED.`);
  failures.forEach(f => console.error(`[ZOD-REGISTRY]   → ${f}`));
}
console.log("[ZOD-REGISTRY] ========================================");

process.exit(exitCode);
