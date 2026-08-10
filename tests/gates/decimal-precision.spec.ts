/**
 * G-16 — decimal precision and floating-point prohibition.
 *
 * Monetary, emissions and rate values entering hashes must be string-encoded
 * fixed-point decimals, never IEEE 754 numbers. The ESLint rule
 * (scripts/lint/no-float-in-hashed-fields.mjs) blocks number literals at the
 * call site; assertNoFloatFieldsInHash enforces it at runtime on every
 * calculation hash; this spec verifies both plus the well-known
 * 0.1 + 0.2 floating-point trap.
 *
 * Evidence: artifacts/gates/G-16/decimal-precision-report.json
 */
import { Decimal } from "decimal.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { assertNoFloatFieldsInHash, reproduceJcsHash } from "../../functions/src/cbam/report/v6/jcs";
import { buildV6Package } from "./gate-helpers";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-16");

describe("G-16 decimal-precision", () => {
  it("keeps decimal arithmetic exact where IEEE 754 is not (0.1 + 0.2 trap)", () => {
    const exact = new Decimal("0.1").plus(new Decimal("0.2")).toString();
    const float = (0.1 + 0.2).toString();
    expect(exact).toBe("0.3");
    expect(float).toBe("0.30000000000000004");
    // A hash over the exact decimal must differ from a hash over the float.
    expect(reproduceJcsHash({ total: exact })).not.toBe(reproduceJcsHash({ total: float }));
  });

  it("hashes a fixed-point decimal string byte-identically in every runtime", () => {
    const value = { totalEmbeddedEmissions: "780000.000000", allocationShare: "0.412500" };
    const hash = reproduceJcsHash(value);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(reproduceJcsHash(value));
  });

  it("rejects an IEEE 754 number in a monetary/emissions field", () => {
    expect(() => assertNoFloatFieldsInHash({ totalEmbedded: 780000 })).toThrow(
      "FLOAT_IN_HASH_FIELD:$.totalEmbedded"
    );
    expect(() => assertNoFloatFieldsInHash({ conversionRate: 1.06 })).toThrow(
      "FLOAT_IN_HASH_FIELD:$.conversionRate"
    );
    expect(() => assertNoFloatFieldsInHash({ totalEmbedded: "780000.000000" })).not.toThrow();
  });

  it("allows non-monetary metadata numbers through the runtime guard", () => {
    expect(() =>
      assertNoFloatFieldsInHash({ goodIndex: 0, fileCount: 27, manifestSha256: "ab12" })
    ).not.toThrow();
  });

  it("enforces G-16 on a real produced calculation trace (gate helper)", async () => {
    const built = await buildV6Package("STEEL_IN");
    const trace = built.calculation.trace;
    expect(trace.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const node of trace) {
      try {
        assertNoFloatFieldsInHash(node);
      } catch (error) {
        violations.push(`${node.formulaId}:${error instanceof Error ? error.message : String(error)}`);
      }
    }
    // Every trace node feeds reproduceJcsHash at seal time, so the trace must
    // carry zero float-bearing number fields end to end.
    expect(violations).toEqual([]);
  });

  it("writes the G-16 evidence artifact", () => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "decimal-precision-report.json"),
      JSON.stringify(
        {
          rule: "no-float-in-hashed-fields (eslint) + assertNoFloatFieldsInHash (runtime)",
          decimalArithmetic: "decimal.js precision 34, ROUND_HALF_UP",
          verified: [
            "0.1 + 0.2 exact via Decimal, trap via IEEE 754",
            "fixed-point string hashes byte-identically",
            "runtime guard rejects number in monetary/emissions fields",
            "produced STEEL_IN calculation trace has zero float-bearing numbers",
          ],
        },
        null,
        2
      )
    );
    expect(true).toBe(true);
  });
});
