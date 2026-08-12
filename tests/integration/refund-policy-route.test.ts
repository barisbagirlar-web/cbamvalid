import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("refund policy route contract", () => {
  it("keeps the canonical refund-policy page and aliases /refunds permanently", () => {
    const root = process.cwd();
    const pagePath = path.join(root, "app/(public)/refund-policy/page.tsx");
    const configPath = path.join(root, "next.config.js");
    const footerPath = path.join(root, "components/layout/AppFooter.tsx");
    const pricingPath = path.join(root, "app/(public)/pricing/page.tsx");

    expect(fs.existsSync(pagePath)).toBe(true);

    const config = fs.readFileSync(configPath, "utf8");
    expect(config).toContain("source: '/refunds'");
    expect(config).toContain("source: '/refund'");
    expect(config).toMatch(/destination:.*\/refund-policy/);

    const footer = fs.readFileSync(footerPath, "utf8");
    expect(footer).toContain('href="/refund-policy"');
    expect(footer).not.toContain('href="/refunds"');

    const pricing = fs.readFileSync(pricingPath, "utf8");
    expect(pricing).toContain('href="/refund-policy"');
    expect(pricing).toContain("Do you offer refunds?");
    expect(pricing).not.toContain('href="/refunds"');
  });
});
