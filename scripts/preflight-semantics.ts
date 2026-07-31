/**
 * Pure exit-code semantics for the teb232 V5 readiness preflight.
 *
 * Release / acceptance mode: a NOT_READY case must fail the gate (exit 1) so
 * CI can never mistake a blocked case for a passing release gate.
 *
 * Diagnostic expected-block mode (EXPECT_BLOCKED=1): exit 0 ONLY when the case
 * is blocked AND the actual seal-blocker IDs exactly match the expected set,
 * with zero unexpected blockers. Used to prove a fixture behaves exactly as
 * intended without silently claiming a blocked case is a release pass.
 */
export type PreflightMode = "release" | "diagnostic-expected-block";

export function resolvePreflightMode(env: Record<string, string | undefined>): PreflightMode {
  const flag = env.EXPECT_BLOCKED;
  return flag === "1" || flag?.toLowerCase() === "true"
    ? "diagnostic-expected-block"
    : "release";
}

export function parseExpectedBlockerIds(raw?: string): string[] {
  return (raw ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .sort();
}

export type PreflightExitDecision =
  | { exitCode: 0; result: "RELEASE_ACCEPTANCE_CASE_READY"; missing: []; unexpected: [] }
  | { exitCode: 1; result: "RELEASE_ACCEPTANCE_CASE_NOT_READY"; missing: []; unexpected: [] }
  | { exitCode: 0; result: "DIAGNOSTIC_EXPECTED_BLOCK_MATCHED"; missing: []; unexpected: [] }
  | { exitCode: 1; result: "DIAGNOSTIC_EXPECTED_BLOCK_ACTUAL_PASS"; missing: []; unexpected: [] }
  | { exitCode: 1; result: "DIAGNOSTIC_EXPECTED_BLOCKER_IDS_REQUIRED"; missing: []; unexpected: [] }
  | {
      exitCode: 1;
      result: "DIAGNOSTIC_EXPECTED_BLOCK_MISMATCH";
      missing: string[];
      unexpected: string[];
    };

export interface PreflightExitInput {
  mode: PreflightMode;
  sealBlockedByV5: boolean;
  actualBlockerIds: string[];
  expectedBlockerIds?: string[];
}

export function decidePreflightExit(input: PreflightExitInput): PreflightExitDecision {
  const actual = [...new Set(input.actualBlockerIds)].sort();

  if (input.mode === "release") {
    return input.sealBlockedByV5
      ? { exitCode: 1, result: "RELEASE_ACCEPTANCE_CASE_NOT_READY", missing: [], unexpected: [] }
      : { exitCode: 0, result: "RELEASE_ACCEPTANCE_CASE_READY", missing: [], unexpected: [] };
  }

  if (!input.sealBlockedByV5) {
    return {
      exitCode: 1,
      result: "DIAGNOSTIC_EXPECTED_BLOCK_ACTUAL_PASS",
      missing: [],
      unexpected: [],
    };
  }

  const expected = [...new Set(input.expectedBlockerIds ?? [])].sort();
  if (expected.length === 0) {
    return {
      exitCode: 1,
      result: "DIAGNOSTIC_EXPECTED_BLOCKER_IDS_REQUIRED",
      missing: [],
      unexpected: [],
    };
  }

  const missing = expected.filter((id) => !actual.includes(id));
  const unexpected = actual.filter((id) => !expected.includes(id));
  if (missing.length === 0 && unexpected.length === 0) {
    return { exitCode: 0, result: "DIAGNOSTIC_EXPECTED_BLOCK_MATCHED", missing: [], unexpected: [] };
  }
  return {
    exitCode: 1,
    result: "DIAGNOSTIC_EXPECTED_BLOCK_MISMATCH",
    missing,
    unexpected,
  };
}
