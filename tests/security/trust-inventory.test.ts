import { describe, expect, it } from "vitest";
import { SUBPROCESSORS } from "../../lib/security/subprocessors";
import {
  SECURITY_ASSURANCE_FACTS,
  STATUS_PUBLIC,
  SUPPORT_RESPONSE_TARGETS,
} from "../../lib/trust/operational-commitments";
import { TRUST_EVIDENCE_ITEMS } from "../../lib/trust/evidence-registry";

describe("B2B trust inventory and Art. 28 subprocessors", () => {
  it("lists communications, analytics, observability and payments — not only GCP+Paddle", () => {
    const categories = new Set(SUBPROCESSORS.map((row) => row.category));
    expect(categories.has("infrastructure")).toBe(true);
    expect(categories.has("payments")).toBe(true);
    expect(categories.has("analytics")).toBe(true);
    expect(categories.has("communications")).toBe(true);
    expect(categories.has("observability")).toBe(true);
    expect(categories.has("security")).toBe(true);

    const blob = SUBPROCESSORS.map((row) => `${row.name} ${row.personalDataNote}`).join("\n");
    expect(blob).toMatch(/Analytics/i);
    expect(blob).toMatch(/Logging/i);
    expect(blob).toMatch(/email/i);
    expect(blob).toMatch(/No separate.*Sentry/i);
    expect(blob).toMatch(/No separate ESP/i);
  });

  it("publishes support targets and honest assurance gaps without inventing uptime %", () => {
    expect(SUPPORT_RESPONSE_TARGETS.map((row) => row.id)).toEqual(["P0", "P1", "P2", "P3"]);
    expect(STATUS_PUBLIC.noUptimeSla).toMatch(/No contractual availability percentage/i);
    expect(SECURITY_ASSURANCE_FACTS.penTest).toMatch(/No independent penetration-test/i);
    expect(SECURITY_ASSURANCE_FACTS.waf).toMatch(/No commercial WAF/i);
  });

  it("pins status, subprocessors, pen-test and uptime slots in the trust registry", () => {
    const ids = TRUST_EVIDENCE_ITEMS.map((item) => item.id);
    expect(ids).toContain("subprocessors-inventory");
    expect(ids).toContain("service-status-page");
    expect(ids).toContain("pen-test-report");
    expect(ids).toContain("waf-rate-limit-product");
    expect(ids).toContain("uptime-percentage-sla");
    expect(ids).toContain("de-minimis-demand-boundary");
    expect(ids).toContain("actual-default-demand-trap");
    expect(ids).toContain("ruleset-drift-boundary");
    expect(ids).toContain("engine-third-party-audit");

    const emptyByDesign = TRUST_EVIDENCE_ITEMS.filter((item) => item.status === "EMPTY_BY_DESIGN");
    expect(emptyByDesign.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        "pen-test-report",
        "waf-rate-limit-product",
        "uptime-percentage-sla",
        "engine-third-party-audit",
      ]),
    );
  });
});
