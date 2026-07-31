import { describe, expect, it } from "vitest";
import { buildPublicVerificationPayload } from "../../lib/verify/public-verification";

const SHA = "ab".repeat(32);
const SHA2 = "cd".repeat(32);

describe("buildPublicVerificationPayload", () => {
  it("exposes integrity metadata and never leaks customer data", () => {
    const payload = buildPublicVerificationPayload({
      packageId: "cbam-2026-abc12345",
      sealRow: {
        reportId: "report_1111111111111111111111111111111111111111111111111111111111111111",
        caseId: "case_confidential",
        uid: "uid_confidential",
        entitlementId: "ent_confidential",
        releaseVersion: 3,
        issuedAt: "2026-07-30T10:00:00.000Z",
        manifestHash: SHA,
        packageHash: SHA2,
        kmsKeyVersion: "projects/x/keyRings/y/cryptoKeys/z/cryptoKeyVersions/2",
        kmsAlgorithm: "RSA_SIGN_PKCS1_2048_SHA256",
        signatureBase64: "c2lnbmF0dXJlLWJ5dGVz",
      },
      reportRow: {
        status: "SEALED",
        isCurrentRelease: true,
        packageMetadata: { actualTopLevelComponentCount: 26, manifestFileCount: 29 },
      },
    });

    expect(payload.packageId).toBe("cbam-2026-abc12345");
    expect(payload.reportId).toMatch(/^report_/);
    expect(payload.status).toBe("SEALED");
    expect(payload.releaseVersion).toBe(3);
    expect(payload.generatedAt).toBe("2026-07-30T10:00:00.000Z");
    expect(payload.manifestHash).toBe(SHA);
    expect(payload.packageHash).toBe(SHA2);
    expect(payload.kmsKeyVersion).toContain("cryptoKeyVersions/2");
    expect(payload.kmsAlgorithm).toBe("RSA_SIGN_PKCS1_2048_SHA256");
    expect(payload.signatureVerificationState).toBe("VALID");
    expect(payload.componentCount).toBe(26);
    expect(payload.isCurrentRelease).toBe(true);
    expect(payload.publicVerificationState).toBe("ACTIVE");

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("confidential");
    expect(serialized).not.toContain("uid_");
    expect(serialized).not.toContain("ent_");
    expect(serialized).not.toContain("case_");
  });

  it("maps superseded lifecycle and missing crypto to empty strings, not placeholders", () => {
    const payload = buildPublicVerificationPayload({
      packageId: "cbam-2026-zzz99999",
      reportRow: {
        reportId: "report_2222222222222222222222222222222222222222222222222222222222222222",
        releaseVersion: 2,
        status: "SEALED",
        publicVerificationState: "SUPERSEDED",
        isCurrentRelease: false,
        createdAt: "2026-06-01T00:00:00.000Z",
      },
    });

    expect(payload.status).toBe("SUPERSEDED");
    expect(payload.publicVerificationState).toBe("SUPERSEDED");
    expect(payload.isCurrentRelease).toBe(false);
    expect(payload.manifestHash).toBe("");
    expect(payload.packageHash).toBe("");
    expect(payload.kmsKeyVersion).toBe("");
    expect(payload.kmsAlgorithm).toBe("");
    expect(payload.signatureVerificationState).toBe("UNSIGNED");
    expect(payload.componentCount).toBe(0);
    expect(payload.generatedAt).toBe("2026-06-01T00:00:00.000Z");
    expect(JSON.stringify(payload)).not.toContain("NOT_AVAILABLE");
    expect(JSON.stringify(payload)).not.toContain("UNAVAILABLE");
  });

  it("derives REVOKED state and falls back to report fields", () => {
    const payload = buildPublicVerificationPayload({
      packageId: "cbam-2026-revoke01",
      reportRow: {
        reportId: "report_3333333333333333333333333333333333333333333333333333333333333333",
        status: "REVOKED",
        manifestHash: SHA,
        signatureBase64: "ZmFrZS1zaWduYXR1cmU=",
      },
    });

    expect(payload.status).toBe("REVOKED");
    expect(payload.publicVerificationState).toBe("REVOKED");
    expect(payload.manifestHash).toBe(SHA);
    expect(payload.signatureVerificationState).toBe("VALID");
  });

  it("returns UNSIGNED when no signature is recorded", () => {
    const payload = buildPublicVerificationPayload({
      packageId: "cbam-2026-unsigned1",
      sealRow: { reportId: "report_4", manifestHash: SHA, packageHash: SHA2 },
    });
    expect(payload.signatureVerificationState).toBe("UNSIGNED");
  });
});
