import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertBatchUniqueness } from "../../scripts/seo/programmatic-factory";

const config = JSON.parse(readFileSync(resolve(process.cwd(), "sites/cbamvalid/seo.config.json"), "utf8")) as { thresholds:{ similarityMax:number } };

describe("INV-18.6 batch uniqueness", () => {
  it("rejects a batch whose median similarity reaches the configured maximum", () => {
    const max = config.thresholds.similarityMax;
    expect(() => assertBatchUniqueness([max,max,max], max)).toThrow(/INV-18\.6/);
  });
});
