import { describe, expect, it } from "vitest";
import { assertOffpageTacticAllowed, type OffpageTactic } from "../../scripts/seo/audit-offpage";

describe("INV-13.2 paid-link/PBN/link-scheme ban", () => {
  it.each<OffpageTactic>([
    "paid_link",
    "pbn",
    "link_exchange",
    "mass_guest_post",
    "cross_site_link_network",
  ])("rejects prohibited tactic %s", (tactic) => {
    expect(() => assertOffpageTacticAllowed(tactic)).toThrow(/INV-13\.2.*YETKI_IHLALI/);
  });

  it("allows earned PR and draft-only unlinked mention outreach", () => {
    expect(() => assertOffpageTacticAllowed("earned_pr")).not.toThrow();
    expect(() => assertOffpageTacticAllowed("unlinked_mention_outreach")).not.toThrow();
  });
});