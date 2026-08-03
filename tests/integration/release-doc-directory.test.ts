import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("release documentation", () => {
  it("keeps the Teb232 checkout acceptance record", () => {
    expect(
      fs.existsSync(path.join(process.cwd(), "docs/releases/2026-08-04-teb232-checkout-fix.md"))
    ).toBe(true);
  });
});
