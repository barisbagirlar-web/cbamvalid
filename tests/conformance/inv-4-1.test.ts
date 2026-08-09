import { describe, expect, it } from "vitest";
import {
  extractCriticalSnapshot,
  validateCriticalContentParity,
  validateCurrentPriceHtml,
  validatePublicStaticRegistryCoverage,
} from "../../scripts/seo/crawl-rendered";

describe("INV-4.1 negative fixtures", () => {
  it("blocks critical H1 content that changes after hydration", () => {
    const raw = extractCriticalSnapshot(
      '<html><head><title>Product | CBAMValid</title><meta name="description" content="Stable description for the product page"><link rel="canonical" href="https://cbamvalid.com/product"></head><body><h1>Server product heading</h1></body></html>',
    );
    const rendered = extractCriticalSnapshot(
      '<html><head><title>Product | CBAMValid</title><meta name="description" content="Stable description for the product page"><link rel="canonical" href="https://cbamvalid.com/product"></head><body><h1>Client-only replacement</h1></body></html>',
    );
    expect(validateCriticalContentParity(raw, rendered, "/product").some((block) => block.includes("INV-4.1"))).toBe(true);
  });

  it("blocks a money page when the current pricing SSOT is absent", () => {
    expect(validateCurrentPriceHtml("<main>Legacy amount only</main>", "/pricing").some((block) => block.includes("INV-4.1"))).toBe(true);
  });

  it("blocks an ungoverned static public route", () => {
    expect(validatePublicStaticRegistryCoverage(["/", "/new-public"], ["/"])).toEqual([
      "INV-4.1 static public route missing from SEO governance /new-public",
    ]);
  });
});
