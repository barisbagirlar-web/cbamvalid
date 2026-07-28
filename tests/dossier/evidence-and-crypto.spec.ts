import { describe, expect, it } from "vitest";
import { runEvidenceSufficiency } from "../../functions/src/cbam/validation/evidence-sufficiency";
import { createVerifierGradeCase } from "../fixtures/verifier-grade-case";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { buildCryptoClaims } from "../../src/dossier/70-seal/crypto-claims";

describe("WP-07 evidence sufficiency", () => {
  it("rejects sole text/plain support for material classes (S0176 class defect)", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    // Force all evidence to text/plain — the historical S0176 defect class
    caseData.evidenceRegister = caseData.evidenceRegister.map((ev) => ({
      ...ev,
      mimeType: "text/plain",
      fileName: ev.fileName.replace(/\.[^.]+$/, ".txt"),
    }));
    const rows = runEvidenceSufficiency(caseData, "2027-01-15T12:00:00.000Z");
    const supported = rows.filter((r) => r.state === "SUPPORTED").length;
    const partialOrWorse = rows.filter((r) => r.state !== "SUPPORTED").length;
    expect(partialOrWorse).toBeGreaterThan(0);
    expect(supported / Math.max(rows.length, 1)).toBeLessThanOrEqual(0.35);
    expect(rows.some((r) => r.reasonCodes.includes("EVIDENCE_CLASS_MIME_INADMISSIBLE") || r.reasonCodes.includes("SINGLE_SOURCE_CONCENTRATION") || r.reasonCodes.includes("EVIDENCE_DIVERSITY_INSUFFICIENT"))).toBe(true);
  });
});

describe("WP-11 crypto claims", () => {
  it("SOFTWARE protectionLevel must not claim Level 3", () => {
    const claims = buildCryptoClaims({
      protectionLevel: "SOFTWARE",
      componentCount: 25,
      publicVerificationUrl: null,
    });
    expect(claims.securityClassLabel).not.toContain("Level 3");
    expect(claims.mayClaimFipsLevel3).toBe(false);
    expect(claims.integrityWording).toContain("detached KMS signature");
    expect(claims.publicVerificationState).toBe("UNAVAILABLE");
  });

  it("HSM may claim Level 3", () => {
    const claims = buildCryptoClaims({
      protectionLevel: "HSM",
      componentCount: 25,
      publicVerificationUrl: "https://cbamvalid.com/verify/pkg_test",
    });
    expect(claims.securityClassLabel).toContain("Level 3");
    expect(claims.publicVerificationState).toBe("ACTIVE");
  });
});
