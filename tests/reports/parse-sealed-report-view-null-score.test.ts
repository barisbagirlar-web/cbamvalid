import { describe, expect, it } from "vitest";
import { parseSealedReportView } from "../../lib/cbam/report-contract";

const HASH = "a".repeat(64);

function minimalReport(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    reportId: `report_${HASH}`,
    uid: "uid_test",
    caseId: "case_test",
    entitlementId: "ent_test",
    requestId: "11111111-1111-4111-8111-222222222222",
    releaseVersion: 1,
    documentHash: HASH,
    manifestHash: HASH,
    packageHash: HASH,
    status: "SEALED",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    calculation: {
      goods: [],
      totalDirectEmissions: "0.00",
      totalIndirectEmissions: "0.00",
      totalPrecursorEmissions: "0.00",
      totalEmbeddedEmissions: "0.00",
      productionVolume: "0.00",
      specificEmbeddedEmissions: "0.00",
      eligibleCertificateReduction: "0.00",
      allocationShareTotal: "0.00",
      allocationReconciliationDelta: "0.00",
      calculationRootHash: HASH,
      ruleset: "2025-2546",
      engineVersion: "1.0.0",
    },
    caseDataHash: HASH,
    rulesetVersion: "2025-2546",
    sourceHash: HASH,
    kmsKeyVersion: "v1",
    kmsAlgorithm: "RSA_SIGN_PKCS1_2048_SHA256",
    signatureBase64: "x".repeat(64),
    storage: {},
    packageTopLevelComponentCount: 27,
    automatedReadiness: "READY_FOR_INDEPENDENT_VERIFICATION",
    independentVerifierStatus: "NOT_REVIEWED",
    verificationMaterialityRate: 0.05,
    ...extra,
  };
}

describe("parseSealedReportView null readinessScore", () => {
  it("accepts readinessScore null from Firestore/JSON without throwing", () => {
    const view = parseSealedReportView(minimalReport({ readinessScore: null }));
    expect(view.readinessScore).toBeUndefined();
  });

  it("keeps a string readinessScore", () => {
    const view = parseSealedReportView(minimalReport({ readinessScore: "88.50" }));
    expect(view.readinessScore).toBe("88.50");
  });
});
