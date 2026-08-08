import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(process.cwd(), "app/step8-premium-actions.css"), "utf8");
const layout = readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8");

describe("Step 8 premium final-action visual contract", () => {
  it("loads the Step 8 visual override after globals", () => {
    const globalsIndex = layout.indexOf('import "./globals.css";');
    const premiumIndex = layout.indexOf('import "./step8-premium-actions.css";');
    expect(globalsIndex).toBeGreaterThanOrEqual(0);
    expect(premiumIndex).toBeGreaterThan(globalsIndex);
  });

  it("scopes the visual hierarchy to the semantic Step 8 primary action", () => {
    expect(css).toContain('main:has([data-testid="step8-primary-action"])');
    expect(css).toContain('[data-testid="step8-primary-action"]');
  });

  it("uses a differentiated enterprise hierarchy", () => {
    expect(css).toContain("#0f6b4e");
    expect(css).toContain("#0b5d44");
    expect(css).toContain("background: transparent !important;");
    expect(css).toContain("background: rgba(26, 25, 21, 0.025) !important;");
  });

  it("keeps blocked and payment states distinct from seal-ready green", () => {
    expect(css).toContain('a[data-testid="step8-primary-action"][href*="/credits/buy"]');
    expect(css).toContain("#b97827");
    expect(css).toContain('button[data-testid="step8-primary-action"][aria-haspopup="true"]');
    expect(css).toContain("#b4513a");
  });

  it("preserves responsive and reduced-motion behavior", () => {
    expect(css).toContain("@media (max-width: 860px)");
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
