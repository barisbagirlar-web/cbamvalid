/**
 * G-02 — period-open behaviour. D-01.
 *
 * A structurally complete case assessed while the annual period is still open
 * must produce ON_TRACK_PERIOD_OPEN with a high data score. The open period
 * never degrades the data axis or the state label.
 */
import { describe, expect, it } from "vitest";
import { buildV6Package } from "./gate-helpers";

describe("G-02 status.period-open", () => {
  it("yields ON_TRACK_PERIOD_OPEN for a complete case with the period still open", async () => {
    const built = await buildV6Package("STEEL_IN", "2026-09-30T00:00:00.000Z");
    expect(built.scores.periodEnded).toBe(false);
    expect(built.state).toBe("ON_TRACK_PERIOD_OPEN");
    expect(built.scores.dataEvidenceReadiness).toBeGreaterThanOrEqual(90);
  });

  it("yields READY_FOR_INDEPENDENT_VERIFICATION once the same period closes with complete data", async () => {
    const built = await buildV6Package("STEEL_IN", "2027-01-31T00:00:00.000Z");
    expect(built.scores.periodEnded).toBe(true);
    expect(built.state).toBe("READY_FOR_INDEPENDENT_VERIFICATION");
    expect(built.scores.dataEvidenceReadiness).toBeGreaterThanOrEqual(90);
  });
});
