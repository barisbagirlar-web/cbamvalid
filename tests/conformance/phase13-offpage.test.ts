import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  auditBacklinks,
  buildLinkableAssetInventory,
  evaluateBrandDemand,
  type RegistryRecord,
} from "../../scripts/seo/audit-offpage";
import { assertNoAutomaticEmail, buildUnlinkedMentionDrafts } from "../../scripts/seo/track-mentions";

const registry = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/seo/registry/cbamvalid_seo_registry.json"), "utf8"),
) as { data: { records: RegistryRecord[] } };
const config = JSON.parse(
  readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8"),
) as { thresholds: { brandSerpOwnershipWarnPct: number } };

describe("SEO V6 Phase 13 off-page authority", () => {
  it("inventories only live registry assets explicitly marked linkable", () => {
    const inventory = buildLinkableAssetInventory(registry.data.records);
    expect(inventory.linkableAssetCount).toBeGreaterThan(0);
    expect(inventory.assets.every((asset) => asset.registryLinkableAsset)).toBe(true);
    expect(inventory.prCampaignStatus).toBe("REQUIRES_A3_APPROVAL");
    console.log(`SEO_LINKABLE_ASSET_INVENTORY=${JSON.stringify(inventory)}`);
  });

  it("does not invent backlink authority/toxicity when no backlink dataset is connected", () => {
    expect(auditBacklinks([])).toMatchObject({ status: "SKIP_NO_DATA", partial: true, action: "REPORT_ONLY_NO_DISAVOW" });
  });

  it("keeps brand/non-brand, brand SERP and AI citation metrics unavailable without measurement evidence", () => {
    const result = evaluateBrandDemand({
      gscBrandQueries: null,
      gscNonBrandQueries: null,
      adsBrandVolume: null,
      directTrafficSharePct: null,
      brandSerpOwnershipPct: null,
      brandSerpOwnershipWarnPct: config.thresholds.brandSerpOwnershipWarnPct,
      aiCitationSamplePct: null,
      aiCitationMethod: null,
    });
    expect(result.brandNonBrandSeparation).toBe("SKIP_NO_DATA");
    expect(result.brandSerpStatus).toBe("SKIP_NO_DATA");
    expect(result.aiCitationStatus).toBe("SKIP_NO_DATA");
  });

  it("produces unlinked-mention outreach drafts but never automatic email", () => {
    expect(() => assertNoAutomaticEmail("draft-only")).not.toThrow();
    expect(() => assertNoAutomaticEmail("auto-send")).toThrow(/automatic email/i);
    const drafts = buildUnlinkedMentionDrafts([{ sourceUrl: "https://example.test/story", sourceTitle: "CBAM tools", brandMentioned: true, linkedToSite: false, contactHint: null }]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.status).toBe("DRAFT_ONLY");
  });
});