/**
 * Compliance calendar SSOT contract (2026 definitive period).
 *
 * The milestone dates must follow the verified DEHSt / European Commission
 * CBAM guidance: certificate sales open 1 Feb 2027, quarterly 50% holding
 * checks from Q1 2027, first annual declaration + certificate surrender by
 * 30 Sep 2027 for 2026 imports, surplus repurchase window from 31 Oct 2027.
 * The product UI derives the visible panel exclusively from this module.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CBAM_COMPLIANCE_MILESTONES,
  FIRST_2026_DECLARATION_DEADLINE,
  getComplianceCalendarState,
  getNextDeclarationMilestone,
} from "@/lib/cbam/compliance-calendar";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("compliance calendar SSOT", () => {
  it("defines the first 2026 declaration deadline as 30 September 2027", () => {
    expect(FIRST_2026_DECLARATION_DEADLINE).toBe("2027-09-30");
  });

  it("covers the verified definitive-period milestone sequence", () => {
    const dates = CBAM_COMPLIANCE_MILESTONES.map((m) => m.date);
    expect(dates).toContain("2027-02-01"); // certificate sales open
    expect(dates).toContain("2027-03-31"); // Q1 2027 holding check
    expect(dates).toContain("2027-06-30"); // Q2 2027 holding check
    expect(dates).toContain("2027-09-30"); // declaration + surrender + Q3 holding
    expect(dates).toContain("2027-10-31"); // surplus repurchase window
    expect([...dates].sort()).toEqual(dates); // chronological order
  });

  it("derives state relative to today without timezone drift", () => {
    const state = getComplianceCalendarState(new Date("2026-08-10T12:00:00Z"));
    expect(state.referenceYear).toBe("2026");
    expect(state.daysUntilFirstDeclaration).toBeGreaterThan(0);

    const declaration = state.milestones.find((m) => m.kind === "declaration");
    expect(declaration).toBeDefined();
    expect(declaration!.date).toBe(FIRST_2026_DECLARATION_DEADLINE);
    expect(declaration!.state).toBe("upcoming");
    expect(getNextDeclarationMilestone(state)?.id).toBe(declaration!.id);
  });

  it("marks milestones passed once their date is behind today", () => {
    const state = getComplianceCalendarState(new Date("2028-01-01T00:00:00Z"));
    expect(state.daysUntilFirstDeclaration).toBeLessThan(0);
    expect(state.milestones.every((m) => m.state === "passed")).toBe(true);
    expect(getNextDeclarationMilestone(state)).toBeUndefined();
  });

  it("flags the window as due within the last 30 days", () => {
    const state = getComplianceCalendarState(new Date("2027-09-10T00:00:00Z"));
    const declaration = state.milestones.find((m) => m.kind === "declaration");
    expect(declaration!.state).toBe("due");
  });

  it("is the single source the dashboard panel consumes", () => {
    const panel = readSource("components/cbam/ComplianceCalendarPanel.tsx");
    const dashboard = readSource("app/(workspace)/cbam/page.tsx");
    expect(panel).toContain("getComplianceCalendarState");
    expect(panel).toContain("getNextDeclarationMilestone");
    expect(dashboard).toContain("ComplianceCalendarPanel");
  });
});
