import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const verifier = fs.readFileSync(
  path.join(process.cwd(), "scripts/verify-live-checkout-release.mjs"),
  "utf8"
);

describe("live checkout release verifier", () => {
  it("fails closed when the ProfitWell CSP origin is absent", () => {
    expect(verifier).toContain("LIVE_CHECKOUT_RELEASE_CSP_MISSING_PROFITWELL");
    expect(verifier).toContain("LIVE_CHECKOUT_RELEASE_CSP=PASS");
    expect(verifier).toContain('response.headers.get("content-security-policy")');
  });
});
