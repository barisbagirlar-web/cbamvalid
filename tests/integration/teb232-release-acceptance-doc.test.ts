import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const doc = fs.readFileSync(
  path.join(process.cwd(), "docs/releases/2026-08-04-teb232-checkout-fix.md"),
  "utf8"
);

describe("Teb232 release acceptance", () => {
  it("requires all four observable live outcomes", () => {
    expect(doc).toContain("https://public.profitwell.com");
    expect(doc).toContain("React hydration error #418");
    expect(doc).toContain("fallback working-files link targets `/cases`");
    expect(doc).toContain("exactly the four canonical controlled cases");
  });
});
