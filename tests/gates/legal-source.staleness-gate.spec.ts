/**
 * G-21 — legal source freshness (staleness gate).
 *
 * A regulation cited in a sealed package must still be in force at production
 * time. The registry gate refuses to count a source as active when its last
 * verification is older than 90 days.
 *
 * Evidence: artifacts/gates/G-21/legal-source-staleness-report.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEGAL_SOURCE_MAX_AGE_DAYS,
  assessLegalSourceFreshness,
  assertLegalSourcesFresh,
  getDefinitiveLegalSources,
  type LegalSourceStatus,
} from "../../functions/src/cbam/registry/legal-sources";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-21");

describe("G-21 legal-source.staleness-gate", () => {
  it("configures the 90-day staleness horizon", () => {
    expect(LEGAL_SOURCE_MAX_AGE_DAYS).toBe(90);
  });

  it("treats every definitive source as fresh at a production date within 90 days", () => {
    const entries = assessLegalSourceFreshness("2026-08-10T00:00:00.000Z");
    expect(entries.length).toBeGreaterThanOrEqual(6);
    for (const entry of entries) {
      expect(entry.fresh, `${entry.id} stale (${entry.ageInDays} days)`).toBe(true);
    }
    expect(() => assertLegalSourcesFresh("2026-08-10T00:00:00.000Z")).not.toThrow();
  });

  it("fails closed when a source verification is older than the horizon", () => {
    // Definitive sources were last reviewed 2026-07-31; 2026-12-31 is 153 days later.
    expect(() => assertLegalSourcesFresh("2026-12-31T00:00:00.000Z")).toThrow(
      /LEGAL_SOURCE_STALE/
    );
    const stale = assessLegalSourceFreshness("2026-12-31T00:00:00.000Z").filter((entry) => !entry.fresh);
    expect(stale.length).toBeGreaterThan(0);
  });

  it("honours the age threshold exactly at the boundary", () => {
    // 10 days elapsed vs a 10-day horizon → fresh; 9-day horizon → stale.
    const fresh = assessLegalSourceFreshness("2026-08-10T00:00:00.000Z", 10);
    expect(fresh.every((entry) => entry.fresh)).toBe(true);
    const stale = assessLegalSourceFreshness("2026-08-10T00:00:00.000Z", 9);
    expect(stale.every((entry) => entry.fresh)).toBe(false);
  });

  it("carries an in-force source status for every definitive source", () => {
    for (const record of getDefinitiveLegalSources()) {
      const status: LegalSourceStatus = record.sourceStatus ?? "IN_FORCE";
      expect(status).toBe("IN_FORCE");
      expect(record.lastVerifiedAt ?? record.lastReviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("writes the G-21 evidence artifact", () => {
    const report = assessLegalSourceFreshness("2026-08-10T00:00:00.000Z");
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "legal-source-staleness-report.json"),
      JSON.stringify(
        {
          rule: "Legal source active only within 90 days of last verification",
          asOf: "2026-08-10",
          entries: report,
          allFresh: report.every((entry) => entry.fresh),
        },
        null,
        2
      )
    );
    expect(report.every((entry) => entry.fresh)).toBe(true);
  });
});
