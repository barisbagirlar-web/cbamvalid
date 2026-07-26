import { describe, expect, it } from "vitest";
import { SEO_CONVERSION_EVENTS } from "@/lib/seo/analytics-events";

describe("SEO analytics contract", () => {
  it("includes closed-loop funnel events", () => {
    for (const required of [
      "organic_landing_view",
      "seo_to_product",
      "seo_to_pricing",
      "seo_to_register",
      "dossier_start",
      "begin_checkout",
      "purchase",
    ]) {
      expect(SEO_CONVERSION_EVENTS).toContain(required);
    }
  });
});
