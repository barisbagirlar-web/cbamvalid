import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertOwnerCandidateSimilarity } from "../../scripts/seo/kac-prioritize";

const config = JSON.parse(
  readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8"),
) as { thresholds: { similarityMax: number } };

describe("INV-11.3 owner similarity gate", () => {
  it("rejects a synthetic duplicate owner above config.thresholds.similarityMax", () => {
    const owner = "CBAM default values methodology evidence";
    expect(() => assertOwnerCandidateSimilarity(owner, [owner], config.thresholds.similarityMax)).toThrow(/INV-11\.3/);
  });

  it("accepts a clearly distinct owner concept", () => {
    expect(() =>
      assertOwnerCandidateSimilarity(
        "CBAM certificate price calculation",
        ["product software purchase workflow"],
        config.thresholds.similarityMax,
      ),
    ).not.toThrow();
  });
});