import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("TEB232 controlled draft preparation", () => {
  const targetHelper = readSource("lib/cbam/qa/prepare-teb232-target-case.ts");
  const genericHelper = readSource("lib/cbam/qa/prepare-teb232-drafts-for-seal.ts");
  const scenario = readSource("lib/cbam/qa/teb232-draft-scenario.ts");
  const route = readSource("app/api/qa/reconcile-teb232/route.ts");
  const client = readSource("components/cbam/Teb232TargetCasePreparer.tsx");

  it("keeps the historical exact target hard-scoped while generic drafts remain Teb232-only", () => {
    expect(targetHelper).toContain("case_80aeb60175ce08a0d3acb7bc46617f152f0442f97ee652435280a2f2dff5e7cc");
    expect(targetHelper).toContain("TEB232_TARGET_PREPARE_IDENTITY_REFUSED");
    expect(targetHelper).toContain("TEB232_TARGET_CASE_REFUSED");
    expect(targetHelper).toContain("TEB232_TARGET_CASE_OWNER_MISMATCH");
    expect(genericHelper).toContain("TEB232_DRAFT_PREPARE_IDENTITY_REFUSED");
    expect(genericHelper).toContain("TEB232_DRAFT_CASE_OWNER_MISMATCH");
    expect(genericHelper).toContain('authenticatedEmail.trim().toLowerCase() !== TEB232_EMAIL');
    expect(genericHelper).toContain("params.authenticatedUid !== TEB232_UID");
  });

  it("protects active PROCESSING seals and delegates the historical target to its stricter repair path", () => {
    expect(genericHelper).toContain('.collection("cbam_reports")');
    expect(genericHelper).toContain('statuses.includes("PROCESSING")');
    expect(genericHelper).toContain("TEB232_DRAFT_CASE_SEAL_IN_PROGRESS");
    expect(genericHelper).toContain("params.targetCaseId === TEB232_TARGET_CASE_ID");
    expect(genericHelper).toContain("prepareTeb232TargetCaseForSeal(params)");
    expect(route).toContain("TEB232_TARGET_CASE_SEAL_IN_PROGRESS");
  });

  it("requires 100 percent readiness and verified evidence before writing any generic test draft", () => {
    expect(scenario).toContain("readiness.isEligibleForSealing !== true");
    expect(scenario).toContain("readiness.completenessPercentage !== 100");
    expect(scenario).toContain("readiness.criticalBlockers.length !== 0");
    expect(scenario).toContain("readiness.allGaps.length !== 0");
    expect(scenario).toContain('record.reviewStatus !== "APPROVED"');
    expect(scenario).toContain('record.supportStatus !== "SUPPORTED"');
    expect(scenario).toContain('record.malwareScanStatus !== "CLEAN"');
    expect(genericHelper).toContain("TEB232_DRAFT_POSTWRITE_VERIFICATION_FAILED");
  });

  it("backs up and restores generic draft evidence and document on failure", () => {
    expect(genericHelper).toContain("captureFiles");
    expect(genericHelper).toContain("restoreFiles");
    expect(genericHelper).toContain("await caseRef.set(documentBackup)");
  });

  it("routes every Teb232 case detail through authenticated generic preparation and supports bulk preparation", () => {
    expect(route).toContain("prepareTeb232DraftCaseForSeal");
    expect(route).toContain("prepareAllTeb232DraftCasesForSeal");
    expect(route).toContain("body.targetCaseId");
    expect(route).toContain("body.prepareAllDrafts === true");
    expect(client).toContain("CASE_PATH_PATTERN");
    expect(client).toContain("Boolean(targetCaseId)");
    expect(client).toContain("body: JSON.stringify({ targetCaseId })");
    expect(client).toContain("ALLOWED_FIXTURE_KEYS.has(payload.fixtureKey)");
    expect(client).toContain("payload.operatorPreparation !== 100");
    expect(client).toContain("payload.evidenceAssurance !== 100");
  });
});
