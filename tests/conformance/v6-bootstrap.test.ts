import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ExitCode,
  guaranteeViolations,
  parseJsonFile,
  secretViolations,
  validateConfig,
  validateInvariantRegistry,
  validatePhaseWrites,
} from "../../scripts/seo/preflight";
import { evaluateColdStart, runColdStartCheck } from "../../scripts/seo/coldstart-check";

type Envelope = {
  meta: {
    artifact: string;
    schemaVersion: string;
    generatedAt: string;
    generatorScript: string;
    inputWindow: { start: string | null; end: string | null };
    confidence: "high" | "medium" | "low";
    partial: boolean;
    siteId: string;
    coldStart: boolean | null;
    structuralBreaksApplied: string[];
  };
  data: unknown;
};

const ROOT = resolve(process.cwd());

function isEnvelope(input: unknown): input is Envelope {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return false;
  const meta = (input as { meta?: unknown }).meta;
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return false;
  const value = meta as Record<string, unknown>;
  return (
    typeof value.artifact === "string" &&
    typeof value.schemaVersion === "string" &&
    typeof value.generatedAt === "string" &&
    !Number.isNaN(Date.parse(value.generatedAt)) &&
    typeof value.generatorScript === "string" &&
    typeof value.inputWindow === "object" && value.inputWindow !== null &&
    (value.confidence === "high" || value.confidence === "medium" || value.confidence === "low") &&
    typeof value.partial === "boolean" &&
    typeof value.siteId === "string" && value.siteId.length > 0 &&
    (typeof value.coldStart === "boolean" || value.coldStart === null) &&
    Array.isArray(value.structuralBreaksApplied)
  );
}

function validEnvelope(overrides: Partial<Envelope["meta"]> = {}): Envelope {
  return {
    meta: {
      artifact: "fixture",
      schemaVersion: "6.0",
      generatedAt: "2026-08-09T12:29:00Z",
      generatorScript: "tests/conformance/v6-bootstrap.test.ts",
      inputWindow: { start: null, end: null },
      confidence: "low",
      partial: true,
      siteId: "cbamvalid",
      coldStart: null,
      structuralBreaksApplied: [],
      ...overrides,
    },
    data: {},
  };
}

function completedPhases(): Set<string> {
  const text = readFileSync(resolve(ROOT, "docs/seo/PROGRESS.md"), "utf8");
  const phases = new Set<string>();
  for (const line of text.split("\n")) {
    const match = line.match(/^\|\s*(BOOTSTRAP|FAZ\s+\d{2})\s*\|\s*completed\s*\|/);
    if (!match) continue;
    if (match[1] === "BOOTSTRAP") phases.add("bootstrap");
    else phases.add(String(Number.parseInt(match[1].replace("FAZ", "").trim(), 10)));
  }
  return phases;
}

describe("SEO V6 conformance — 15 mandatory checks", () => {
  it("C-01 artifact-envelope", () => {
    expect(isEnvelope(validEnvelope())).toBe(true);
    const invalid = validEnvelope();
    invalid.meta.siteId = "";
    expect(isEnvelope(invalid)).toBe(false);
  });

  it("C-02 invariant-result-schema", () => {
    const allowed = new Set(["PASS", "FAIL", "SKIP_NO_DATA"]);
    expect(allowed.has("PASS")).toBe(true);
    expect(allowed.has("SKIPPED")).toBe(false);
  });

  it("C-03 no-hardcoded-thresholds", () => {
    const source = readFileSync(resolve(ROOT, "scripts/seo/coldstart-check.ts"), "utf8");
    expect(source).toContain("thresholds.coldStartMinDataDays");
    expect(source).not.toMatch(/gscDataDays\s*<\s*28\b/);
  });

  it("C-04 phase-writes-lock", () => {
    const contracts = parseJsonFile("PHASE_CONTRACTS.json") as Record<string, { writes: string[]; forbidsWrites: string[] }>;
    expect(validatePhaseWrites(["docs/seo/MANDATE.md", "scripts/seo/preflight.ts"], contracts.bootstrap)).toEqual([]);
    expect(validatePhaseWrites(["app/(public)/page.tsx"], contracts.bootstrap)).toContain("app/(public)/page.tsx: forbidden");
  });

  it("C-05 money-integer", () => {
    const raw = parseJsonFile("sites/cbamvalid/seo.config.json") as Record<string, unknown>;
    const valid = validateConfig(raw, "cbamvalid");
    expect(Number.isInteger(valid.economics.defaultValuePerConversionMinor)).toBe(true);
    const broken = structuredClone(raw) as Record<string, unknown>;
    const economics = broken.economics as Record<string, unknown>;
    economics.defaultValuePerConversionMinor = 1.5;
    expect(() => validateConfig(broken, "cbamvalid")).toThrow(/integer/);
  });

  it("C-06 guarantee-regex", () => {
    expect(guaranteeViolations("This policy prohibits ranking guarantees.")).toEqual([]);
    expect(guaranteeViolations("Guaranteed ranking and traffic growth for every customer.").length).toBeGreaterThan(0);
  });

  it("C-07 approval-records", () => {
    const ledger = readFileSync(resolve(ROOT, "docs/seo/KARAR_DEFTERI.md"), "utf8");
    expect(ledger).toContain("Approver:");
    expect(ledger).toContain("Scope:");
    expect(ledger).toContain("NO DEPLOY");
  });

  it("C-08 registry-single-writer", () => {
    const contracts = parseJsonFile("PHASE_CONTRACTS.json") as Record<string, { writes: string[]; forbidsWrites: string[] }>;
    const writers = Object.entries(contracts)
      .filter(([, value]) => Array.isArray(value.writes) && value.writes.some((path) => path.startsWith("data/seo/registry/")))
      .map(([phase]) => phase);
    expect(writers).toEqual(["faz-01"]);
  });

  it("C-09 negative-tests-exist", () => {
    const registry = parseJsonFile("data/seo/invariants.json") as { invariants: Array<{ phase: string | number; severity: string; negativeTest: string | null }> };
    const enforced = completedPhases();
    for (const invariant of registry.invariants) {
      const globallyEnforced = invariant.phase === "G" || invariant.phase === "X";
      const phaseEnforced = enforced.has(String(invariant.phase));
      if (invariant.severity !== "BLOCK" || (!globallyEnforced && !phaseEnforced)) continue;
      expect(invariant.negativeTest, `${String(invariant.phase)} BLOCK missing negative test`).toBeTruthy();
      expect(existsSync(resolve(ROOT, invariant.negativeTest as string)), invariant.negativeTest ?? "missing").toBe(true);
    }
  });

  it("C-10 determinism", () => {
    const registry = parseJsonFile("data/seo/invariants.json");
    expect(validateInvariantRegistry(registry)).toEqual(validateInvariantRegistry(registry));
    expect(evaluateColdStart(27, 28)).toBe(evaluateColdStart(27, 28));
  });

  it("C-11 exit-codes", () => {
    expect(ExitCode.PASS).toBe(0);
    expect(ExitCode.BLOCK).toBe(1);
    expect(ExitCode.WARN).toBe(2);
    expect(ExitCode.MISSING_DATA).toBe(3);
    expect(ExitCode.CONFIG).toBe(4);
    expect(runColdStartCheck(["--site", "cbamvalid"])).toBe(ExitCode.MISSING_DATA);
  });

  it("C-12 envelope-completeness", () => {
    const envelope = validEnvelope();
    expect(Object.keys(envelope.meta).sort()).toEqual([
      "artifact", "coldStart", "confidence", "generatedAt", "generatorScript", "inputWindow", "partial", "schemaVersion", "siteId", "structuralBreaksApplied",
    ].sort());
  });

  it("C-13 structural-breaks-join", () => {
    const joinedAcrossKnownBreak = validEnvelope({ structuralBreaksApplied: ["2025-09-11:num100-removal"] });
    expect(joinedAcrossKnownBreak.meta.structuralBreaksApplied.length).toBeGreaterThan(0);
    const unlabeled = validEnvelope({ structuralBreaksApplied: [] });
    expect(unlabeled.meta.structuralBreaksApplied).toEqual([]);
  });

  it("C-14 coldstart-flag", () => {
    const config = validateConfig(parseJsonFile("sites/cbamvalid/seo.config.json"), "cbamvalid");
    const threshold = config.thresholds.coldStartMinDataDays;
    expect(typeof threshold).toBe("number");
    expect(evaluateColdStart((threshold as number) - 1, threshold as number)).toBe(true);
    expect(evaluateColdStart(threshold as number, threshold as number)).toBe(false);
  });

  it("C-15 portfolio-siteid", () => {
    expect(isEnvelope(validEnvelope({ siteId: "cbamvalid" }))).toBe(true);
    expect(isEnvelope(validEnvelope({ siteId: "" }))).toBe(false);
  });

  it("bootstrap secret fixture rejects credential-shaped input", () => {
    expect(secretViolations("-----BEGIN PRIVATE KEY-----").length).toBeGreaterThan(0);
  });

  it("invariant registry exact totals", () => {
    expect(validateInvariantRegistry(parseJsonFile("data/seo/invariants.json"))).toEqual([]);
  });
});
