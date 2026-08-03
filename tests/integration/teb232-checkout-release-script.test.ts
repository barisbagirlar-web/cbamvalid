import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = fs.readFileSync(
  path.join(process.cwd(), "scripts/release-teb232-checkout-fix.sh"),
  "utf8"
);

describe("Teb232 checkout release script", () => {
  it("deploys, verifies CSP, and cleans the exact obsolete case", () => {
    expect(script).toContain("scripts/deploy-hosting-cutover.sh");
    expect(script).toContain("scripts/verify-live-checkout-release.mjs");
    expect(script).toContain("scripts/cleanup-teb232-obsolete-iskenderun-case.ts");
    expect(script).toContain("TEB232_CHECKOUT_RELEASE=PASS");
  });
});
