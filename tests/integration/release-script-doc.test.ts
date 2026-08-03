import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const doc = fs.readFileSync(
  path.join(process.cwd(), "scripts/README-teb232-checkout-release.txt"),
  "utf8"
);

describe("Teb232 release operator command", () => {
  it("uses the bundled fail-closed release script", () => {
    expect(doc).toContain("scripts/release-teb232-checkout-fix.sh");
    expect(doc).toContain("LIVE_CHECKOUT_RELEASE_CSP=PASS");
    expect(doc).toContain("TEB232_OBSOLETE_ISKENDERUN_CLEANUP=PASS");
  });
});
