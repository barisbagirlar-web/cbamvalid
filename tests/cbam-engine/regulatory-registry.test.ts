import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DEFINITIVE_SOURCE_IDS as ROOT_SOURCE_IDS,
  DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT as ROOT_FINGERPRINT,
  OFFICIAL_SOURCES as ROOT_SOURCES,
} from "../../lib/cbam/registry/legal-sources";
import {
  DEFINITIVE_SOURCE_IDS as FUNCTIONS_SOURCE_IDS,
  DEFINITIVE_SOURCE_REGISTRY_FINGERPRINT as FUNCTIONS_FINGERPRINT,
  OFFICIAL_SOURCES as FUNCTIONS_SOURCES,
} from "../../functions/src/cbam/registry/legal-sources";
import {
  getActiveRuleset as getRootRuleset,
  VERIFICATION_MATERIALITY_RATE as ROOT_MATERIALITY,
} from "../../lib/cbam/registry/rulesets";
import {
  getActiveRuleset as getFunctionsRuleset,
  VERIFICATION_MATERIALITY_RATE as FUNCTIONS_MATERIALITY,
} from "../../functions/src/cbam/registry/rulesets";
import { SECTOR_CONFIGS as ROOT_SECTORS } from "../../lib/cbam/sectors/sector-adapter";
import { SECTOR_CONFIGS as FUNCTIONS_SECTORS } from "../../functions/src/cbam/sectors/sector-adapter";

function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}

function fingerprint(ids: readonly string[], sources: Record<string, unknown>): string {
  const payload = ids.map((id) => sources[id]);
  return createHash("sha256").update(canonical(payload)).digest("hex");
}

describe("definitive-period regulatory source registry", () => {
  it("uses one identical verified registry in browser and Functions runtimes", () => {
    expect(ROOT_SOURCE_IDS).toEqual(FUNCTIONS_SOURCE_IDS);
    expect(ROOT_SOURCES).toEqual(FUNCTIONS_SOURCES);
    expect(ROOT_FINGERPRINT).toBe(FUNCTIONS_FINGERPRINT);
    expect(ROOT_SOURCE_IDS).toEqual([
      "REG_2023_956",
      "REG_2025_2083",
      "IMPL_2025_2546",
      "IMPL_2025_2547",
      "IMPL_2025_2548",
      "DEL_2025_2551",
    ]);
  });

  it("recomputes the pinned fingerprint from exact canonical source records", () => {
    expect(fingerprint(ROOT_SOURCE_IDS, ROOT_SOURCES)).toBe(ROOT_FINGERPRINT);
    expect(fingerprint(FUNCTIONS_SOURCE_IDS, FUNCTIONS_SOURCES)).toBe(FUNCTIONS_FINGERPRINT);
    expect(ROOT_FINGERPRINT).toMatch(/^[a-f0-9]{64}$/);
  });

  it("contains no speculative legal instruments or placeholder hashes", () => {
    const serialized = JSON.stringify(ROOT_SOURCES);
    expect(serialized).not.toContain("2620");
    expect(serialized).not.toContain("2621");
    expect(serialized).not.toMatch(/placeholder|\.\.\./i);
    for (const sourceId of ROOT_SOURCE_IDS) {
      const source = ROOT_SOURCES[sourceId];
      expect(source.verificationAuthority).toBe("EUR_LEX");
      expect(source.legalStatus).toBe("IN_FORCE");
      expect(source.eliUri).toMatch(/^https:\/\/eur-lex\.europa\.eu\//);
      expect(source.celexId).toMatch(/^3\d{4}R\d{4}$/);
      expect(source.methodologyScope.length).toBeGreaterThan(0);
    }
  });

  it("fails closed outside the active definitive ruleset and locks 5 percent materiality", () => {
    const root = getRootRuleset(new Date("2026-07-16T00:00:00.000Z"));
    const functions = getFunctionsRuleset(new Date("2026-07-16T00:00:00.000Z"));
    expect(root).toEqual(functions);
    expect(root.sourceHash).toBe(ROOT_FINGERPRINT);
    expect(root.verificationMaterialityRate).toBe(0.05);
    expect(root.verificationTemplateRequired).toBe(true);
    expect(ROOT_MATERIALITY).toBe(0.05);
    expect(FUNCTIONS_MATERIALITY).toBe(0.05);
    expect(() => getRootRuleset(new Date("2025-12-31T00:00:00.000Z"))).toThrow("CBAM_RULESET_NOT_SEALABLE");
    expect(() => getFunctionsRuleset(new Date("invalid"))).toThrow("CBAM_RULESET_DATE_INVALID");
  });

  it("requires every sealable sector legal basis to resolve to the verified registry", () => {
    expect(ROOT_SECTORS).toEqual(FUNCTIONS_SECTORS);
    for (const sector of Object.values(ROOT_SECTORS)) {
      if (!sector.sealingAllowed) continue;
      expect(sector.legalStatus).toBe("IN_FORCE");
      expect(sector.legalBasisSourceIds.length).toBeGreaterThanOrEqual(4);
      for (const sourceId of sector.legalBasisSourceIds) {
        expect(sourceId in ROOT_SOURCES).toBe(true);
      }
      expect(sector.verificationFocus.length).toBeGreaterThanOrEqual(4);
      expect(sector.defaultBoundaries.length).toBeGreaterThan(40);
    }
  });
});
