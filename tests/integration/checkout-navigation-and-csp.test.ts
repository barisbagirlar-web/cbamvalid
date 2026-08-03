import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("checkout navigation and Paddle Retain CSP", () => {
  it("sends working-file actions to the Cases workspace", () => {
    const page = read("app/(workspace)/credits/buy/page.tsx");
    expect(page).toContain('href="/cases"');
    expect(page).toContain('"/cases?purchase=success"');
    expect(page).not.toContain('href="/cbam"');
  });

  it("permits Paddle Retain/ProfitWell without broadening the entire CSP", () => {
    const config = read("next.config.js");
    expect(config).toContain("script-src 'self'");
    expect(config).toContain("https://public.profitwell.com");
    expect(config).toContain("connect-src 'self'");
    expect(config).toContain("https://*.profitwell.com");
  });
});
