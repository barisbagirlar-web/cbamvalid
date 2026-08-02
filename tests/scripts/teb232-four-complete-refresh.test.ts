import { describe, expect, it } from "vitest";
import { assessCaseReadiness } from "../../functions/src/cbam/validation/readiness-assessor";
import { FOUR_DOSSIER_KEYS } from "../fixtures/four-dossiers";
import {
  TEB232_EMAIL,
  TEB232_OLD_CASE_IDS,
  TEB232_PROJECT,
  TEB232_REFRESH_SET,
  TEB232_UID,
  buildTeb232Case,
  teb232CaseId,
} from "../../scripts/refresh-teb232-four-complete-cases";

const FORBIDDEN_VISIBLE_MARKERS = ["fixture", "sandbox", "stress", "illustrative scenario"];

describe("Teb232 four-complete-case refresh contract", () => {
  it("is pinned to the exact production test identity and exact old-case allowlist", () => {
    expect(TEB232_PROJECT).toBe("cbam-desk");
    expect(TEB232_EMAIL).toBe("teb232@gmail.com");
    expect(TEB232_UID).toBe("r3Sv0U5YqEcLLylbw5ndwK1Zg652");
    expect(TEB232_REFRESH_SET).toBe("TEB232_FOUR_COMPLETE_V1");
    expect(TEB232_OLD_CASE_IDS).toHaveLength(4);
    expect(new Set(TEB232_OLD_CASE_IDS).size).toBe(4);
  });

  for (const key of FOUR_DOSSIER_KEYS) {
    it(`${key} is complete, evidence-backed and seal-ready for Teb232`, async () => {
      const prepared = await buildTeb232Case(key);
      expect(prepared.data.caseId).toBe(teb232CaseId(key));
      expect(prepared.data.ownerId).toBe(TEB232_UID);
      expect(prepared.data.status).toBe("DRAFT");
      expect(prepared.evidenceFiles.length).toBe(prepared.data.evidenceRegister.length);
      expect(prepared.data.evidenceRegister.length).toBeGreaterThanOrEqual(9);

      const readiness = assessCaseReadiness(prepared.data);
      expect(readiness.isEligibleForSealing).toBe(true);
      expect(readiness.completenessPercentage).toBe(100);
      expect(readiness.criticalBlockers).toEqual([]);
      expect(readiness.allGaps).toEqual([]);

      for (const evidence of prepared.data.evidenceRegister) {
        expect(evidence.reviewStatus).toBe("APPROVED");
        expect(evidence.supportStatus).toBe("SUPPORTED");
        expect(evidence.malwareScanStatus).toBe("CLEAN");
        expect(evidence.storagePath).toMatch(
          new RegExp(`^evidence/${TEB232_UID}/${prepared.data.caseId}/`)
        );
        expect(evidence.fileHash).toMatch(/^[a-f0-9]{64}$/);
        expect(evidence.sizeBytes).toBeGreaterThan(0);
      }

      const customerVisible = JSON.stringify({
        importerIdentity: prepared.data.importerIdentity,
        exporterIdentity: prepared.data.exporterIdentity,
        reportingPeriod: prepared.data.reportingPeriod,
        goods: prepared.data.goods,
        installation: prepared.data.installation,
        directEmissions: prepared.data.directEmissions,
        electricityConsumed: prepared.data.electricityConsumed,
        gridEmissionFactor: prepared.data.gridEmissionFactor,
        precursors: prepared.data.precursors,
        carbonPriceRecords: prepared.data.carbonPriceRecords,
        evidenceRegister: prepared.data.evidenceRegister,
        methodologyDecisions: prepared.data.methodologyDecisions,
      }).toLowerCase();
      for (const marker of FORBIDDEN_VISIBLE_MARKERS) {
        expect(customerVisible).not.toContain(marker);
      }
    }, 60_000);
  }
});
