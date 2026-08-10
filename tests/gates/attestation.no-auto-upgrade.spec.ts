/**
 * G-14 — professional boundary protection.
 *
 * No automated rule may ever elevate evidence to APPROVED/SUPPORTED/CLEAN on
 * its own, and no output may imply a verification opinion. A case sealed with
 * reviewStatus=PENDING evidence must surface PENDING and nothing APPROVED.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildV6PackageFromCase, masterRecordPdfText } from "./gate-helpers";
import { createFourDossierCase } from "../fixtures/four-dossiers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-14");

describe("G-14 attestation.no-auto-upgrade", () => {
  it("never auto-elevates PENDING evidence and never implies an opinion", async () => {
    const caseData = createFourDossierCase("CEMENT_EG");
    caseData.evidenceRegister = caseData.evidenceRegister.map((record, index) =>
      index === 0
        ? { ...record, reviewStatus: "PENDING", supportStatus: "PENDING", qualityGrade: undefined, qualityAssessedBy: undefined, qualityAssessedAt: undefined }
        : record
    );

    const built = await buildV6PackageFromCase(caseData, "2027-01-31T00:00:00.000Z");

    const pending = built.caseData.evidenceRegister[0]!;
    expect(pending.reviewStatus).toBe("PENDING");
    expect(pending.supportStatus).toBe("PENDING");
    expect(pending.qualityGrade).toBeUndefined();

    const serializedOutputs = JSON.stringify({
      evidenceRegister: built.caseData.evidenceRegister.filter((record) => record.reviewStatus === "PENDING"),
      evidenceGaps: built.masterRecordModel.evidenceGaps,
    });
    expect(serializedOutputs).toContain("PENDING");
    expect(serializedOutputs).not.toContain("APPROVED");
    expect(serializedOutputs).not.toContain("SUPPORTED");

    const { text } = await masterRecordPdfText(built.masterRecordModel);
    const opinionImplication = /(verified|approved by verifier|audit opinion|assurance provided|ready for submission|meets EU requirements)\b/i;
    expect(opinionImplication.test(text)).toBe(false);
    expect(text).toContain("Operator record. No independent verification opinion is implied.");

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "no-auto-attestation.json"),
      JSON.stringify(
        {
          pendingEvidenceIds: built.caseData.evidenceRegister.filter((record) => record.reviewStatus === "PENDING").map((record) => record.evidenceId),
          elevatedToApproved: built.caseData.evidenceRegister.some((record) => record.reviewStatus === "APPROVED" && record.evidenceId === built.caseData.evidenceRegister[0]?.evidenceId),
          opinionImplicationMatches: text.match(opinionImplication) ?? [],
          boundaryStatementPresent: text.includes("Operator record. No independent verification opinion is implied."),
        },
        null,
        2
      )
    );
  });
});
