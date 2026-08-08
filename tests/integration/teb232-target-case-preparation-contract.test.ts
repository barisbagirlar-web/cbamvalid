import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("TEB232 exact target preparation", () => {
  const helper = readSource("lib/cbam/qa/prepare-teb232-target-case.ts");
  const route = readSource("app/api/qa/reconcile-teb232/route.ts");
  const client = readSource("components/cbam/Teb232TargetCasePreparer.tsx");

  it("is hard-scoped to the approved test identity and exact target case", () => {
    expect(helper).toContain("case_80aeb60175ce08a0d3acb7bc46617f152f0442f97ee652435280a2f2dff5e7cc");
    expect(helper).toContain("TEB232_TARGET_PREPARE_IDENTITY_REFUSED");
    expect(helper).toContain("TEB232_TARGET_CASE_REFUSED");
    expect(helper).toContain("TEB232_TARGET_CASE_OWNER_MISMATCH");
  });

  it("treats only a SEALED report as already released and protects an active PROCESSING seal", () => {
    expect(helper).toContain('.collection("cbam_reports")');
    expect(helper).toContain('reportStatuses.includes("SEALED")');
    expect(helper).toContain("TEB232_TARGET_CASE_ALREADY_RELEASED");
    expect(helper).toContain('reportStatuses.includes("PROCESSING")');
    expect(helper).toContain("TEB232_TARGET_CASE_SEAL_IN_PROGRESS");
    expect(helper).not.toContain("if (!reportSnapshot.empty)");
    expect(route).toContain("TEB232_TARGET_CASE_SEAL_IN_PROGRESS");
  });

  it("requires 100 percent readiness and verified evidence before writing", () => {
    expect(helper).toContain("readiness.isEligibleForSealing !== true");
    expect(helper).toContain("readiness.completenessPercentage !== 100");
    expect(helper).toContain('record.reviewStatus !== "APPROVED"');
    expect(helper).toContain('record.supportStatus !== "SUPPORTED"');
    expect(helper).toContain('record.malwareScanStatus !== "CLEAN"');
    expect(helper).toContain("TEB232_TARGET_POSTWRITE_VERIFICATION_FAILED");
  });

  it("backs up and restores the target evidence and document on failure", () => {
    expect(helper).toContain("captureFiles");
    expect(helper).toContain("restoreFiles");
    expect(helper).toContain("await caseRef.set(documentBackup)");
  });

  it("routes the exact target request through the authenticated server preparation path", () => {
    expect(route).toContain("prepareTeb232TargetCase");
    expect(route).toContain("body.targetCaseId");
    expect(client).toContain('body: JSON.stringify({ targetCaseId: TARGET_CASE_ID })');
    expect(client).toContain('payload.fixtureKey !== "STEEL_IN"');
    expect(client).toContain("payload.operatorPreparation !== 100");
    expect(client).toContain("payload.evidenceAssurance !== 100");
  });
});
