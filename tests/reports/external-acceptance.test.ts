/**
 * FAZ 16 — External professional acceptance tests.
 *
 * The external-acceptance module is authoritative data describing the
 * mandatory external review. It must be fail-closed: ACCEPTED is unreachable
 * while any required reviewer is pending or any critical/high finding is open.
 */
import { describe, expect, it } from "vitest";
import {
  EXTERNAL_ACCEPTANCE_CRITERIA,
  EXTERNAL_REVIEWER_ROLES,
  buildExternalAcceptanceState,
  recordExternalAssessment,
  validateExternalAcceptanceCriteria,
} from "../../functions/src/cbam/report/external-acceptance";

describe("FAZ 16 — external professional acceptance", () => {
  it("defines all 12 mandated review criteria and all 3 reviewer roles", () => {
    const { missing } = validateExternalAcceptanceCriteria();
    expect(missing).toEqual([]);
    expect(EXTERNAL_ACCEPTANCE_CRITERIA).toHaveLength(12);
    expect(EXTERNAL_REVIEWER_ROLES).toHaveLength(3);
    expect(EXTERNAL_REVIEWER_ROLES.every((reviewer) => reviewer.required)).toBe(true);
  });

  it("is fail-closed by default: NOT_ACCEPTED, no completion, 36 checklist rows", () => {
    const state = buildExternalAcceptanceState();
    expect(state.overall).toBe("NOT_ACCEPTED");
    expect(state.acceptsAsOf).toBeNull();
    expect(state.checklist).toHaveLength(36);
    expect(state.reviewers.every((reviewer) => reviewer.completionState === "PENDING")).toBe(true);
    expect(state.checklist.every((row) => row.status === "NOT_COMPLETED")).toBe(true);
  });

  it("keeps NOT_ACCEPTED while a critical finding is open even after full review", () => {
    let state = buildExternalAcceptanceState();
    for (const reviewer of EXTERNAL_REVIEWER_ROLES) {
      for (const criterion of EXTERNAL_ACCEPTANCE_CRITERIA) {
        state = recordExternalAssessment({
          state,
          reviewerRole: reviewer.role,
          criterionId: criterion.id,
          status: "OPEN_FINDING",
          findingReference: "EXT-FND-CRIT-01",
          assessedBy: "Reviewer",
          assessedAt: "2027-02-01T00:00:00.000Z",
          criticalFindingsOpen: 1,
          highFindingsOpen: 0,
        });
      }
    }
    expect(state.overall).toBe("NOT_ACCEPTED");
    expect(state.criticalFindingsOpen).toBe(1);
  });

  it("keeps NOT_ACCEPTED while any reviewer is still pending", () => {
    let state = buildExternalAcceptanceState();
    for (const criterion of EXTERNAL_ACCEPTANCE_CRITERIA) {
      state = recordExternalAssessment({
        state,
        reviewerRole: "CBAM_METHODOLOGY_SPECIALIST",
        criterionId: criterion.id,
        status: "PASS",
        assessedBy: "Methodology Specialist",
        assessedAt: "2027-02-01T00:00:00.000Z",
        criticalFindingsOpen: 0,
        highFindingsOpen: 0,
      });
    }
    expect(state.reviewers[0]?.completionState).toBe("COMPLETE");
    expect(state.reviewers[1]?.completionState).toBe("PENDING");
    expect(state.overall).toBe("NOT_ACCEPTED");
  });

  it("reaches ACCEPTED only when all reviewers pass all criteria with zero findings", () => {
    let state = buildExternalAcceptanceState();
    for (const reviewer of EXTERNAL_REVIEWER_ROLES) {
      for (const criterion of EXTERNAL_ACCEPTANCE_CRITERIA) {
        state = recordExternalAssessment({
          state,
          reviewerRole: reviewer.role,
          criterionId: criterion.id,
          status: "PASS",
          assessedBy: "Reviewer",
          assessedAt: "2027-02-01T00:00:00.000Z",
          criticalFindingsOpen: 0,
          highFindingsOpen: 0,
        });
      }
    }
    expect(state.overall).toBe("ACCEPTED");
    expect(state.acceptsAsOf).toBe("2027-02-01T00:00:00.000Z");
  });

  it("revokes ACCEPTED when a later high finding is recorded", () => {
    let state = buildExternalAcceptanceState();
    for (const reviewer of EXTERNAL_REVIEWER_ROLES) {
      for (const criterion of EXTERNAL_ACCEPTANCE_CRITERIA) {
        state = recordExternalAssessment({
          state,
          reviewerRole: reviewer.role,
          criterionId: criterion.id,
          status: "PASS",
          assessedBy: "Reviewer",
          assessedAt: "2027-02-01T00:00:00.000Z",
          criticalFindingsOpen: 0,
          highFindingsOpen: 0,
        });
      }
    }
    state = recordExternalAssessment({
      state,
      reviewerRole: "FINANCIAL_OPERATIONAL_DATA_CONTROL_SPECIALIST",
      criterionId: "EXT-05",
      status: "OPEN_FINDING",
      findingReference: "EXT-HIGH-MAT-01",
      assessedBy: "Data Specialist",
      assessedAt: "2027-02-03T00:00:00.000Z",
      criticalFindingsOpen: 0,
      highFindingsOpen: 1,
    });
    expect(state.overall).toBe("NOT_ACCEPTED");
    expect(state.acceptsAsOf).toBeNull();
  });

  it("rejects assessments for unknown criteria or roles", () => {
    const state = buildExternalAcceptanceState();
    expect(() =>
      recordExternalAssessment({
        state,
        reviewerRole: "CBAM_METHODOLOGY_SPECIALIST",
        criterionId: "EXT-99",
        status: "PASS",
        assessedBy: "Reviewer",
        assessedAt: "2027-02-01T00:00:00.000Z",
        criticalFindingsOpen: 0,
        highFindingsOpen: 0,
      })
    ).toThrow(/EXTERNAL_CRITERION_UNKNOWN/);
  });
});
