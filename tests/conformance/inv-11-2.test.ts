import { describe, expect, it } from "vitest";
import { assertCtrSourceAllowed } from "../../scripts/seo/kac-prioritize";

describe("INV-11.2 industry CTR table ban", () => {
  it("allows only site GSC or unavailable CTR state", () => {
    expect(() => assertCtrSourceAllowed("site_gsc")).not.toThrow();
    expect(() => assertCtrSourceAllowed(null)).not.toThrow();
  });

  it("rejects synthetic industry benchmark CTR", () => {
    expect(() => assertCtrSourceAllowed("industry_benchmark_table")).toThrow(/INV-11\.2/);
  });
});