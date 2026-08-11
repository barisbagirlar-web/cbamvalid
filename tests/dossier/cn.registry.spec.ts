import { describe, expect, it } from "vitest";
import { resolveCn } from "../../src/dossier/01-ruleset/cn.registry";
import { createFourDossierCase } from "../fixtures/four-dossiers";

function allGoodsCnCodes(): string[] {
  const keys = ["STEEL_IN", "CEMENT_EG", "ALU_CN", "FERTILISER_TR"] as const;
  const codes = new Set<string>();
  for (const key of keys) {
    const data = createFourDossierCase(key);
    for (const good of data.goods) {
      codes.add(String(good.cnCode.value ?? ""));
    }
  }
  return [...codes];
}

describe("cn.registry — dört-dossier fixture kapsamı", () => {
  it("2507 (kaolin) çimento Annex I kapsamında — CEMENT_EG regresyonu", () => {
    const resolution = resolveCn("25071000");
    expect(resolution.inScope).toBe(true);
    expect(resolution.sector).toBe("CEMENT");
    expect(resolution.reason).toBe("IN_SCOPE");
  });

  it("tüm dört-dossier CN kodları registry'de in-scope", () => {
    const codes = allGoodsCnCodes();
    expect(codes.length).toBeGreaterThanOrEqual(8);
    for (const code of codes) {
      const resolution = resolveCn(code);
      expect(
        resolution.inScope,
        `${code} OUT_OF_SCOPE (sector=${resolution.sector} reason=${resolution.reason})`
      ).toBe(true);
    }
  });
});
