import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertIntentEligible } from "../../scripts/seo/cro-governance";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as { thresholds: { intentScoreMin: number } };

describe("INV-14.1 intent satisfaction CRO gate", () => {
  it("rejects a synthetic page whose N1..N7 total is at or below the configured gate", () => {
    const v = config.thresholds.intentScoreMin;
    expect(() => assertIntentEligible({ N1:v,N2:v,N3:v,N4:v,N5:v,N6:v,N7:v }, v)).toThrow(/INV-14\.1/);
  });

  it("accepts a page only when total intent score is above the configured gate", () => {
    const v = config.thresholds.intentScoreMin;
    expect(assertIntentEligible({ N1:v+1,N2:v+1,N3:v+1,N4:v+1,N5:v+1,N6:v+1,N7:v+1 }, v)).toBeGreaterThan(v * 7);
  });
});