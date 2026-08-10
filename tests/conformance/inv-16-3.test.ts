import { describe, expect, it } from "vitest";
import { assertUgcModeration } from "../../scripts/seo/tam-growth";

describe("INV-16.3", () => {
  it("blocks UGC loop without moderation", () => {
    expect(() => assertUgcModeration({ loop: "ugc_loop", moderationScript: null })).toThrow(/INV-16\.3/);
  });
  it("accepts UGC loop when moderation is explicit", () => {
    expect(() => assertUgcModeration({ loop: "ugc_loop", moderationScript: "scripts/seo/moderate-ugc.ts" })).not.toThrow();
  });
});
