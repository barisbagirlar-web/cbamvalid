import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const home = read("components/marketing/SoftwareProductHome.tsx");
const rootPage = read("app/(public)/page.tsx");
const pricing = read("app/(public)/pricing/page.tsx");
const terms = read("app/(public)/terms/page.tsx");
const header = read("components/layout/PublicHeader.tsx");
const footer = read("components/layout/AppFooter.tsx");
const classification = read("app/(public)/product-classification/page.tsx");
const siteConfig = read("lib/site-config.ts");

describe("Paddle product classification contract", () => {
  it("presents the root domain as self-service B2B software", () => {
    expect(rootPage).toContain("SoftwareProductHome");
    expect(rootPage).toContain("Self-Service Emissions Data Software");
    expect(home).toContain("B2B SaaS · Automated digital delivery");
    expect(home).toContain("software access and automated digital delivery only");
    expect(siteConfig).toContain("Self-Service Emissions Data Software");
  });

  it("explicitly excludes government, filing and authority services", () => {
    for (const source of [home, pricing, terms, footer, classification]) {
      expect(source.toLowerCase()).toContain("government");
    }
    expect(pricing).toContain("Registry filing, customs filing or permit submissions");
    expect(terms).toContain("does not act for a customer before");
    expect(classification).toContain("Does CBAMValid submit to an authority?");
  });

  it("keeps the purchase limited to software and automated files", () => {
    expect(pricing).toContain("automated digital PDF generation");
    expect(pricing).toContain("automated digital JSON generation");
    expect(pricing).toContain("automated digital XLSX generation");
    expect(terms).toContain("software access and automated digital delivery");
    expect(classification).toContain("Automated PDF, JSON and XLSX generation");
  });

  it("removes the ambiguous global compliance-validation tagline", () => {
    expect(header).not.toContain("Carbon Border Compliance Validation");
    expect(footer).not.toContain("Carbon Border Compliance Validation");
    expect(header).toContain("Self-Service Emissions Data Software");
    expect(footer).toContain("Self-Service Emissions Data Software");
  });
});
