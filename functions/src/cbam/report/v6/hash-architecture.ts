/**
 * G-04 — hash architecture single truth and explainability.
 *
 * Multiple root hashes may coexist, but every hash is named, scoped and
 * reproducible. The canonical serialisation rule is written down and a
 * independent function applies it so the gate test reproduces the sealed
 * hash byte-for-byte. A formula hash under the same name must never differ
 * between Calculation Trace and Calculation Graph.
 */
import crypto from "node:crypto";
import type { HashArchitectureRow } from "./types";

export const HASH_CANONICAL_RULE = [
  "CANONICAL_SERIALISATION:1.0",
  "Encoding: UTF-8, no BOM.",
  "Field order: object keys sorted lexicographically (localeCompare, byte order).",
  "Strings: JSON.stringify escaping (double quotes).",
  "Numbers: canonical decimal representation; integers without exponent.",
  "Arrays: elements in declared order.",
  "null/undefined/missing: serialised as the literal null.",
  "Whitespace: none between tokens; empty object {} and empty array [].",
  "Digest: SHA-256 over the canonical UTF-8 bytes, lowercase hexadecimal.",
].join("\n");

/** Canonical serialisation identical to the sealed-package manifest writer. */
export function canonicalSerialization(value: unknown): string {
  if (value === undefined || value === null || typeof value !== "object") {
    return value === undefined ? "null" : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalSerialization).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map((key) => `${JSON.stringify(key)}:${canonicalSerialization(record[key])}`)
    .join(",")}}`;
}

export function reproduceHash(value: unknown): string {
  return crypto
    .createHash("sha256")
    .update(canonicalSerialization(value), "utf8")
    .digest("hex");
}

export function reproduceHashFromBytes(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function buildHashArchitecture(params: {
  manifestHash: string;
  calculationRootHash: string;
  graphRootHash?: string;
  legalSourceRegistryHash: string;
  packageHash?: string;
  traceCalculationHashes: ReadonlyArray<{ formulaId: string; hash: string }>;
  graphNodeHashes: ReadonlyArray<{ formulaId: string; hash: string }>;
}): { rows: HashArchitectureRow[]; inconsistencies: string[] } {
  const inconsistencies: string[] = [];

  const traceByName = new Map(params.traceCalculationHashes.map((item) => [item.formulaId, item.hash]));
  const graphByName = new Map(params.graphNodeHashes.map((item) => [item.formulaId, item.hash]));
  for (const formulaId of traceByName.keys()) {
    const graphHash = graphByName.get(formulaId);
    if (graphHash !== undefined && graphHash !== traceByName.get(formulaId)) {
      inconsistencies.push(
        `formula ${formulaId} has differing trace hash ${traceByName.get(formulaId)} vs graph hash ${graphHash} under the same name`
      );
    }
  }

  const rows: HashArchitectureRow[] = [
    {
      hashName: "manifestHash",
      covers: "Canonical UTF-8 bytes of Data Integrity Manifest.json (all component paths, SHA-256 and sizes; component contract; evidence count).",
      notCovered: "Manifest Signature.sig content and the manifest file itself (manifestExclusions).",
      reproduction: `node -e 'sha256(canonical(manifestObject))' — see verify/cli.js; identical to the value sealed in Data Integrity Manifest.json`,
    },
    {
      hashName: "calculationRootHash",
      covers: "Deterministic calculation trace root: canonical serialisation of the sealed calculation object (totals, per-good allocations, formula trace).",
      notCovered: "Report identity fields (caseId, generatedAt) and evidence file bytes.",
      reproduction: "Recompute the closed-form trace from the register values, then canonical-serialise and SHA-256 (HASH_CANONICAL_RULE 1.0).",
    },
    {
      hashName: "calculationGraphRootHash",
      covers: "Calculation Graph.json root: canonical aggregation of graph node hashes and their dependency edges.",
      notCovered: "Node values rendered in human PDFs (presentation rounding).",
      reproduction: "Aggregate node hashes in the documented topological order, canonical-serialise the node set, SHA-256.",
    },
    {
      hashName: "legalSourceRegistryHash",
      covers: "Definitive legal-source registry content (rulesets and CELEX entries) used by this package.",
      notCovered: "Case-specific data and evidence.",
      reproduction: "SHA-256 over the canonical serialisation of the locked legal-source registry version.",
    },
  ];

  if (params.packageHash) {
    rows.push({
      hashName: "packageHash",
      covers: "The sealed ZIP byte stream (DEFLATE level 9, UNIX platform, pinned directory timestamps).",
      notCovered: "Nothing inside the ZIP is excluded; a single byte change changes the hash.",
      reproduction: "node Supporting_Evidence/verify/cli.js --package <path> reproduces the ZIP hash.",
    });
  }

  return { rows, inconsistencies };
}
