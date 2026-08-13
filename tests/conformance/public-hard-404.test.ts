import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public hard-404 soft-404 guards", () => {
  it("keeps global not-found public, noindex, and free of dashboard soft-404 cues", () => {
    const source = readFileSync(resolve(process.cwd(), "app/not-found.tsx"), "utf8");
    expect(source).toContain('title: "Page not found"');
    expect(source).toMatch(/robots:\s*\{[\s\S]*index:\s*false/);
    expect(source).toContain('href="/"');
    expect(source).toContain('href="/refund-policy"');
    expect(source).toContain('href="/contact"');
    expect(source).not.toMatch(/\/dashboard/);
    expect(source).not.toMatch(/Return to Dashboard/i);
  });

  it("keeps global-error recovery on the public home path", () => {
    const source = readFileSync(resolve(process.cwd(), "app/global-error.tsx"), "utf8");
    expect(source).toContain('window.location.href = "/"');
    expect(source).toContain("Return to Home");
    expect(source).not.toMatch(/\/dashboard/);
    expect(source).not.toMatch(/Return to Dashboard/i);
  });
});
