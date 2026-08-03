import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = fs.readFileSync(
  path.join(process.cwd(), "app/(workspace)/credits/buy/page.tsx"),
  "utf8"
);
const config = fs.readFileSync(path.join(process.cwd(), "next.config.js"), "utf8");

describe("live checkout release contract", () => {
  it("ships the corrected Cases fallback and ProfitWell CSP together", () => {
    expect(page).toContain('href="/cases"');
    expect(page).not.toContain('href="/cbam"');
    expect(config).toContain("https://public.profitwell.com");
  });
});
