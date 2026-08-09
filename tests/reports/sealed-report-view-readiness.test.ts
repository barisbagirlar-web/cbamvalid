import { describe, expect, it } from "vitest";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { toSealedReportView } from "../../functions/src/cbam/report/report-contract";
import {
  FIXTURE_CASE_ID,
  FIXTURE_GENERATED_AT,
  FIXTURE_OWNER_ID,
  FIXTURE_PACKAGE_CODE,
  FIXTURE_REPORT_ID,
  createVerifierGradeCase,
} from "../fixtures/verifier-grade-case";

const RULESET_VERSION = "2025-2546";

function baseRecord(extra: Record<string, unknown>): Record<string, unknown> {
  const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
  const calculation = performDossierCalculations(caseData);
  return {
    reportId: FIXTURE_REPORT_ID,
    packageCode: FIXTURE_PACKAGE_CODE,
    uid: FIXTURE_OWNER_ID,
    caseId: FIXTURE_CASE_ID,
    entitlementId: "ent_test",
    requestId: "11111111-1111-4111-8111-222222222222",
    releaseVersion: 1,
    documentHash: "a".repeat(64),
    manifestHash: "a".repeat(64),
    packageHash: "a".repeat(64),
    status: "SEALED",
    createdAt: FIXTURE_GENERATED_AT,
    updatedAt: FIXTURE_GENERATED_AT,
    calculation,
    caseDataHash: "a".repeat(64),
    rulesetVersion: RULESET_VERSION,
    sourceHash: "a".repeat(64),
    kmsKeyVersion: "v1",
    kmsAlgorithm: "RSA_SIGN_PKCS1_2048_SHA256",
    signatureBase64: "x".repeat(64),
    storage: {},
    dossierSchemaVersion: "CBAMVALID-DOSSIER-5.0",
    ...extra,
  };
}

describe("sealed report view readiness mapping (Enterprise 1000 mandate)", () => {
  it("maps NOT_READY operator status to NOT_READY automated readiness with score", () => {
    const view = toSealedReportView(baseRecord({ operatorReadinessStatus: "NOT_READY", readinessScore: "60.55" }));
    expect(view.automatedReadiness).toBe("NOT_READY");
    expect(view.readinessScore).toBe("60.55");
    expect(view.operatorReadinessStatus).toBe("NOT_READY");
  });

  it("maps CONDITIONAL operator status to CONDITIONAL automated readiness", () => {
    const view = toSealedReportView(baseRecord({ operatorReadinessStatus: "CONDITIONAL", readinessScore: "84.10" }));
    expect(view.automatedReadiness).toBe("CONDITIONAL");
    expect(view.readinessScore).toBe("84.10");
  });

  it("maps READY_FOR_VERIFICATION operator status to passed preparation state", () => {
    const view = toSealedReportView(baseRecord({ operatorReadinessStatus: "READY_FOR_VERIFICATION", readinessScore: "97.00" }));
    expect(view.automatedReadiness).toBe("OPERATOR_PREPARATION_COMPLETE");
    expect(view.readinessScore).toBe("97.00");
  });

  it("keeps readiness fields on the legacy fallback when operator status is absent", () => {
    const view = toSealedReportView(baseRecord({}));
    expect(view.automatedReadiness).toBe("OPERATOR_PREPARATION_COMPLETE");
  });

  it("carries the persisted reporting year to the sealed report view", () => {
    const view = toSealedReportView(baseRecord({ reportingYear: 2026 }));
    expect(view.reportingYear).toBe(2026);
  });

  it("keeps reportingYear absent on legacy records without the field", () => {
    const view = toSealedReportView(baseRecord({}));
    expect(view.reportingYear).toBeUndefined();
  });
});
