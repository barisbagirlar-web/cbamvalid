import { describe, expect, it } from "vitest";
import type { VerifierReservedFields } from "../../functions/src/cbam/schema";
import {
  countExternalVerifierCompletion,
  getExternalVerifierCompletionItems,
  hasIndependentVerifierSignOff,
} from "../../functions/src/cbam/report/honest-scoreboard";
import { createFourDossierCase } from "../fixtures/four-dossiers";

describe("external verifier status single source of truth", () => {
  it("does not count pre-filled identity or accreditation before signed opinion", () => {
    const base = createFourDossierCase("ALU_CN").verifierReserved ?? {};
    const verifierReserved: VerifierReservedFields = {
      ...base,
      verifierLegalName: "Example Accredited Verifier Ltd",
      accreditationNumber: "ACC-12345",
      nationalAccreditationBody: "Example NAB",
      finalOpinion: "NO_OPINION",
      signature: "",
    };

    expect(verifierReserved.verifierLegalName).toBeTruthy();
    expect(verifierReserved.accreditationNumber).toBeTruthy();
    expect(hasIndependentVerifierSignOff(verifierReserved)).toBe(false);

    const items = getExternalVerifierCompletionItems(verifierReserved);
    expect(items.some((item) => item.dataRecorded)).toBe(true);
    expect(items.every((item) => item.complete === false)).toBe(true);
    expect(countExternalVerifierCompletion(verifierReserved)).toEqual({
      completed: 0,
      total: 7,
    });
  });

  it("keeps an empty verifier work programme at zero of seven", () => {
    expect(countExternalVerifierCompletion(undefined)).toEqual({
      completed: 0,
      total: 7,
    });
  });
});
