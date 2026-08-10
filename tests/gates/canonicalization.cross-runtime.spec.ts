/**
 * G-15 — cross-runtime canonical serialisation determinism.
 *
 * The same logical content must produce the identical SHA-256 in the Node and
 * Python runtimes. RFC 8785 official vectors plus a representative sealed
 * package dataset are canonicalised and hashed in both implementations.
 *
 * Evidence: artifacts/gates/G-15/cross-runtime-report.json
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalJcs, reproduceJcsHash } from "../../functions/src/cbam/report/v6/jcs";
import { PYTHON_BIN } from "./cross-runtime-helper";

const ARTIFACT_DIR = join(process.cwd(), "artifacts", "gates", "G-15");
const JCS_SCRIPT = join(process.cwd(), "scripts", "verify", "jcs.py");

const Rfc8785VectorValues: ReadonlyArray<{ name: string; value: unknown }> = [
  {
    name: "IETF Example",
    value: { Numbers: { M: 1, T: true, N: null, A: [1, "a"], S: "a b", K: "\\", X: "\u2028" } },
  },
  {
    name: "Unicode duplicate keys",
    value: { "Ω": "\u03a9", "Φ": "\u03a6" },
  },
  {
    name: "Key ordering by Unicode code point",
    value: { "2": "two", "1": "one", "aa": "aa", "A": "A", "a": "a", "ä": "ä", "a\u0308": "a\u0308", "\uD834\uDD1E": "G-CLEF", "ẞ": "ẞ" },
  },
  {
    name: "Big number normalisation",
    value: { big: 1.0e10 },
  },
  {
    name: "Big number exponential form",
    value: { big: 1.234567890123456e100 },
  },
];

/** Representative sealed-package dataset (G-16 string-encoded fixed point). */
const PackageDataset = {
  schemaVersion: "CBAMVALID-DOSSIER-7.0",
  engineVersion: "4.1.0",
  reportingPeriod: { startDate: "2026-01-01", endDate: "2026-12-31", year: 2026 },
  installation: { name: "Acme Çimento", country: "TR" },
  goods: [
    {
      cnCode: "25070080",
      productionVolume: "780000.000000",
      directEmissions: "612000.500000",
      indirectEmissions: "0.000000",
      allocationShare: "1.000000",
    },
  ],
  totals: { embeddedEmissions: "780000.000000", allocationShareTotal: "1.000000" },
  precursorCount: 2,
  statusFlags: { ready: true, blocked: false },
};

function pythonCanonical(value: unknown): string {
  const result = spawnSync(PYTHON_BIN, [JCS_SCRIPT, "--canonical"], {
    input: JSON.stringify(value),
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

function pythonHash(value: unknown): string {
  const result = spawnSync(PYTHON_BIN, [JCS_SCRIPT, "--hash"], {
    input: JSON.stringify(value),
    encoding: "utf8",
  });
  expect(result.status, result.stderr).toBe(0);
  return result.stdout.trim();
}

const comparisons: Array<{
  name: string;
  canonicalEqual: boolean;
  hashEqual: boolean;
  nodeHash: string;
  pythonHashValue: string;
}> = [];

describe("G-15 canonicalization.cross-runtime", () => {
  for (const vector of [...Rfc8785VectorValues, { name: "Representative sealed package", value: PackageDataset }]) {
    it(`produces identical canonical bytes and SHA-256 in Node and Python: ${vector.name}`, () => {
      const nodeCanonical = canonicalJcs(vector.value);
      const pythonCanonicalValue = pythonCanonical(vector.value);
      const nodeHash = reproduceJcsHash(vector.value);
      const pythonHashValue = pythonHash(vector.value);
      expect(pythonCanonicalValue).toBe(nodeCanonical);
      expect(pythonHashValue).toBe(nodeHash);
      comparisons.push({
        name: vector.name,
        canonicalEqual: pythonCanonicalValue === nodeCanonical,
        hashEqual: pythonHashValue === nodeHash,
        nodeHash,
        pythonHashValue,
      });
    });
  }

  it("writes the G-15 cross-runtime evidence artifact", () => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(
      join(ARTIFACT_DIR, "cross-runtime-report.json"),
      JSON.stringify(
        {
          rule: "RFC8785:JCS:1.0",
          runtimes: ["node:crypto (SHA-256)", "python3:hashlib (SHA-256)"],
          vectors: comparisons.length,
          allMatched: comparisons.every((comparison) => comparison.canonicalEqual && comparison.hashEqual),
          comparisons,
        },
        null,
        2
      )
    );
    expect(comparisons.every((comparison) => comparison.canonicalEqual && comparison.hashEqual)).toBe(true);
  });
});
