import { describe, expect, it } from "vitest";
import {
  decidePreflightExit,
  parseExpectedBlockerIds,
  resolvePreflightMode,
  type PreflightExitDecision,
} from "../../scripts/preflight-semantics";

const ID_A = "FND-EVD-REQ-INST-BOUNDS-3cc9fd42";
const ID_B = "FND-EVD-REQ-PERIOD-YEAR-73cb0ba5";
const ID_C = "FND-EVD-REQ-IM-EORI-f54bf13a";

describe("preflight exit semantics", () => {
  it("release mode: NOT_READY case must exit 1 (never a silent release pass)", () => {
    const decision = decidePreflightExit({
      mode: "release",
      sealBlockedByV5: true,
      actualBlockerIds: [ID_A, ID_B],
    });
    expect(decision.exitCode).toBe(1);
    expect(decision.result).toBe("RELEASE_ACCEPTANCE_CASE_NOT_READY");
  });

  it("release mode: ready case exits 0", () => {
    const decision = decidePreflightExit({
      mode: "release",
      sealBlockedByV5: false,
      actualBlockerIds: [],
    });
    expect(decision.exitCode).toBe(0);
    expect(decision.result).toBe("RELEASE_ACCEPTANCE_CASE_READY");
  });

  it("diagnostic mode: exact blocker-ID match exits 0", () => {
    const decision = decidePreflightExit({
      mode: "diagnostic-expected-block",
      sealBlockedByV5: true,
      actualBlockerIds: [ID_A, ID_B],
      expectedBlockerIds: [ID_A, ID_B],
    });
    expect(decision).toEqual({
      exitCode: 0,
      result: "DIAGNOSTIC_EXPECTED_BLOCK_MATCHED",
      missing: [],
      unexpected: [],
    });
  });

  it("diagnostic mode: unmatched order and duplicates still match", () => {
    const decision = decidePreflightExit({
      mode: "diagnostic-expected-block",
      sealBlockedByV5: true,
      actualBlockerIds: [ID_B, ID_A, ID_A],
      expectedBlockerIds: [ID_A, ID_B],
    });
    expect(decision.exitCode).toBe(0);
    expect(decision.result).toBe("DIAGNOSTIC_EXPECTED_BLOCK_MATCHED");
  });

  it("diagnostic mode: unexpected blocker forces exit 1", () => {
    const decision = decidePreflightExit({
      mode: "diagnostic-expected-block",
      sealBlockedByV5: true,
      actualBlockerIds: [ID_A, ID_C],
      expectedBlockerIds: [ID_A],
    });
    expect(decision.exitCode).toBe(1);
    expect(decision.result).toBe("DIAGNOSTIC_EXPECTED_BLOCK_MISMATCH");
    expect(decision.missing).toEqual([]);
    expect(decision.unexpected).toEqual([ID_C]);
  });

  it("diagnostic mode: missing blocker forces exit 1", () => {
    const decision = decidePreflightExit({
      mode: "diagnostic-expected-block",
      sealBlockedByV5: true,
      actualBlockerIds: [ID_A],
      expectedBlockerIds: [ID_A, ID_B],
    });
    expect(decision.exitCode).toBe(1);
    expect(decision.result).toBe("DIAGNOSTIC_EXPECTED_BLOCK_MISMATCH");
    expect(decision.missing).toEqual([ID_B]);
    expect(decision.unexpected).toEqual([]);
  });

  it("diagnostic mode: a clear case exits 1 (expected block was not observed)", () => {
    const decision = decidePreflightExit({
      mode: "diagnostic-expected-block",
      sealBlockedByV5: false,
      actualBlockerIds: [],
      expectedBlockerIds: [ID_A],
    });
    expect(decision.exitCode).toBe(1);
    expect(decision.result).toBe("DIAGNOSTIC_EXPECTED_BLOCK_ACTUAL_PASS");
  });

  it("diagnostic mode: missing EXPECTED_BLOCKER_IDS exits 1", () => {
    const decision = decidePreflightExit({
      mode: "diagnostic-expected-block",
      sealBlockedByV5: true,
      actualBlockerIds: [ID_A],
    });
    expect(decision.exitCode).toBe(1);
    expect(decision.result).toBe("DIAGNOSTIC_EXPECTED_BLOCKER_IDS_REQUIRED");
  });

  it("resolvePreflightMode honours EXPECT_BLOCKED=1 / true and defaults to release", () => {
    expect(resolvePreflightMode({})).toBe("release");
    expect(resolvePreflightMode({ EXPECT_BLOCKED: "0" })).toBe("release");
    expect(resolvePreflightMode({ EXPECT_BLOCKED: "1" })).toBe("diagnostic-expected-block");
    expect(resolvePreflightMode({ EXPECT_BLOCKED: "true" })).toBe("diagnostic-expected-block");
    expect(resolvePreflightMode({ EXPECT_BLOCKED: "TRUE" })).toBe("diagnostic-expected-block");
  });

  it("parseExpectedBlockerIds trims, drops empties, sorts, and dedupes via decide", () => {
    expect(parseExpectedBlockerIds(` ${ID_B}, ${ID_A}, ,${ID_B} `)).toEqual([ID_A, ID_B, ID_B]);
    expect(parseExpectedBlockerIds(undefined)).toEqual([]);
    const decision = decidePreflightExit({
      mode: "diagnostic-expected-block",
      sealBlockedByV5: true,
      actualBlockerIds: [ID_A, ID_B],
      expectedBlockerIds: [ID_A, ID_B, ID_B],
    }) as PreflightExitDecision;
    expect(decision.exitCode).toBe(0);
  });
});
