import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const home = read("components/marketing/SoftwareProductHome.tsx");
const rootPage = read("app/(public)/page.tsx");
const productLayout = read("app/(public)/product/layout.tsx");
const pricing = read("app/(public)/pricing/page.tsx");
const terms = read("app/(public)/terms/page.tsx");
const privacy = read("app/(public)/privacy/page.tsx");
const refund = read("app/(public)/refund-policy/page.tsx");
const header = read("components/layout/PublicHeader.tsx");
const footer = read("components/layout/AppFooter.tsx");
const classification = read("app/(public)/product-classification/page.tsx");
const siteConfig = read("lib/site-config.ts");
const pricingConfig = read("lib/billing/pricing-config.ts");
const legalConfig = read("lib/legal-config.ts");
const rootLogo = read("cbam_logo.svg");
const publicLogo = read("public/cbam_logo.svg");
const lockup = read("public/brand/cbamvalid-lockup.svg");
const llm = read("public/llm.txt");

const STALE_CLASSIFICATION = [
  "Carbon Border Compliance Validation",
  "Exporter Verification Preparation Pack",
  "Prepared for Independent Accredited Verification",
  "CBAM Exporter Final Evidence Report",
] as const;

describe("Paddle product classification contract", () => {
  it("presents the root domain as self-service B2B software", () => {
    expect(rootPage).toContain("SoftwareProductHome");
    expect(rootPage).toContain("Self-Service Emissions Data Software");
    expect(rootPage).toContain("automated PDF, JSON and XLSX delivery");
    expect(home).toContain("B2B SaaS · Automated digital delivery");
    expect(home).toContain("privately operated self-service B2B software");
    expect(siteConfig).toContain("Self-Service Emissions Data Software");
    expect(productLayout).toContain("Self-Service Emissions Data Software");
  });

  it("keeps high-risk category words off primary commercial surfaces", () => {
    for (const source of [rootPage, home, pricing, header, footer]) {
      expect(source.toLowerCase()).not.toContain("government service");
    }
    expect(pricing).not.toContain("Registry filing");
    expect(pricing).not.toContain("customs filing");
    expect(home).not.toContain("authority representation");
  });

  it("keeps detailed exclusions in dedicated legal and classification pages", () => {
    expect(terms).toContain("No Human or Government Services Included");
    expect(terms).toContain("software access and automated digital delivery");
    expect(classification).toContain("Self-Service B2B Software");
    expect(classification).toContain("Does CBAMValid submit to an authority?");
  });

  it("keeps the purchase limited to software and automated files", () => {
    const pricingLower = pricing.toLowerCase();
    expect(pricingLower).toContain("automated digital pdf generation");
    expect(pricingLower).toContain("automated digital json generation");
    expect(pricingLower).toContain("automated digital xlsx generation");
    expect(pricing).toContain("CANONICAL_PRICING.priceFormatted");
    expect(pricingConfig).toContain('packName: "CBAMValid Working File Software Unlock"');
    expect(pricingConfig).toContain("amountMinor: 44900");
  });

  it("publishes complete legal and refund information", () => {
    expect(privacy).toContain("providing access to the self-service software");
    expect(privacy).not.toContain("Enterprise Account settings");
    expect(refund).toContain("Paddle.com is the Merchant of Record");
    expect(legalConfig).toContain('governingLaw: "Ireland"');
    expect(legalConfig).not.toContain('governingLaw: "the laws of Ireland"');
  });

  it("removes obsolete classification language from logos and machine-readable discovery", () => {
    for (const source of [rootLogo, publicLogo, lockup, rootPage, home, pricing, footer, llm]) {
      for (const phrase of STALE_CLASSIFICATION) {
        expect(source).not.toContain(phrase);
      }
    }
    expect(rootLogo).toContain("Self-Service Emissions Data Software");
    expect(publicLogo).toContain("Self-Service Emissions Data Software");
    expect(lockup).toContain("Self-Service Emissions Data Software");
    expect(llm).toContain("CBAMValid — Self-Service Emissions Data Software");
  });
});
