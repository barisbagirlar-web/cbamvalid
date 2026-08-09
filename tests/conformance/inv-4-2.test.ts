import { describe, expect, it } from "vitest";
import { extractCriticalSnapshot, validateCanonicalHreflangParity } from "../../scripts/seo/crawl-rendered";

describe("INV-4.2 negative fixtures", () => {
  it("blocks canonical mutation after hydration", () => {
    const raw = extractCriticalSnapshot(
      '<html><head><title>Pricing</title><meta name="description" content="Pricing description long enough"><link rel="canonical" href="https://cbamvalid.com/pricing"></head><body><h1>Pricing</h1></body></html>',
    );
    const rendered = extractCriticalSnapshot(
      '<html><head><title>Pricing</title><meta name="description" content="Pricing description long enough"><link rel="canonical" href="https://cbamvalid.com/product"></head><body><h1>Pricing</h1></body></html>',
    );
    expect(validateCanonicalHreflangParity(raw, rendered, "/pricing").some((block) => block.includes("INV-4.2"))).toBe(true);
  });

  it("blocks hreflang mutation after hydration", () => {
    const raw = extractCriticalSnapshot(
      '<html><head><title>Methodology</title><meta name="description" content="Methodology description long enough"><link rel="canonical" href="https://cbamvalid.com/methodology"></head><body><h1>Methodology</h1></body></html>',
    );
    const rendered = extractCriticalSnapshot(
      '<html><head><title>Methodology</title><meta name="description" content="Methodology description long enough"><link rel="canonical" href="https://cbamvalid.com/methodology"><link rel="alternate" hreflang="de" href="https://cbamvalid.com/de/methodology"></head><body><h1>Methodology</h1></body></html>',
    );
    expect(validateCanonicalHreflangParity(raw, rendered, "/methodology").some((block) => block.includes("INV-4.2"))).toBe(true);
  });
});
