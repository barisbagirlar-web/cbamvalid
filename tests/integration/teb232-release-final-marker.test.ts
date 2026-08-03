import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Teb232 checkout release final marker", () => {
  it("records the exact one-case cleanup scope", () => {
    const marker = fs.readFileSync(
      path.join(process.cwd(), "docs/releases/2026-08-04-teb232-checkout-fix.final"),
      "utf8"
    );
    expect(marker).toContain("one exact obsolete Teb232 Iskenderun case");
  });
});
