import { createHash } from "node:crypto";
import type { CalculationTraceNode } from "../schema";
import type { DossierCalculationResult } from "../calculator";
import type { HardenableArtifact } from "./premium-package-hardening";

export type CliVerifiableCalculationGraph = {
  rootHash: string;
  nodes: ReadonlyArray<{
    id: string;
    label: string;
    formula: string;
    legalBasis: readonly string[];
    inputNodes: readonly string[];
    inputPaths: readonly { path: string }[];
    value: { toString(): string };
    unit: string;
    hash: string;
  }>;
};

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Must remain byte-equivalent to Supporting_Evidence/verify/cli.js. */
function cliCanonicalJson(value: unknown): string {
  if (value instanceof Object && value !== null && !Array.isArray(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = (value as Record<string, unknown>)[key];
    }
    return JSON.stringify(sorted);
  }
  return JSON.stringify(value);
}

function formulaDependencies(formulaId: string, allFormulaIds: readonly string[]): string[] {
  const present = (id: string) => allFormulaIds.includes(id);
  const goodFormulaIds = allFormulaIds.filter((id) => /^CBAM_GOOD_EMISSIONS_ALLOCATION_\d+$/.test(id));
  switch (formulaId) {
    case "CBAM_TOTAL_EMBEDDED_EMISSIONS_DISCLOSED":
      return [
        "CBAM_INSTALLATION_DIRECT_EMISSIONS",
        "CBAM_INDIRECT_EMISSIONS",
        "CBAM_PRECURSOR_EMISSIONS_SUM",
      ].filter(present);
    case "CBAM_TOTAL_EMBEDDED_EMISSIONS_PRICED":
      return goodFormulaIds;
    case "CBAM_GOODS_ALLOCATION_RECONCILIATION":
      return [...goodFormulaIds, "CBAM_TOTAL_EMBEDDED_EMISSIONS_PRICED"].filter(present);
    case "CBAM_AGGREGATE_SPECIFIC_EMBEDDED_EMISSIONS":
      return ["CBAM_TOTAL_EMBEDDED_EMISSIONS_PRICED"].filter(present);
    default:
      if (/^CBAM_GOOD_EMISSIONS_ALLOCATION_\d+$/.test(formulaId)) {
        return [
          "CBAM_INSTALLATION_DIRECT_EMISSIONS",
          "CBAM_INDIRECT_EMISSIONS",
          "CBAM_PRECURSOR_EMISSIONS_SUM",
        ].filter(present);
      }
      return [];
  }
}

function traceInputPaths(node: CalculationTraceNode): Array<{ path: string }> {
  const inputs = (node.inputs || {}) as Record<string, unknown>;
  const goodIndex = Number(inputs.goodIndex || 0);
  const paths = new Set<string>();

  for (const key of Object.keys(inputs)) {
    if (
      key === "calcNodeId" ||
      key.endsWith("Unit") ||
      key === "goodIndex" ||
      key === "sector" ||
      key === "annexII" ||
      key === "indirectPriced"
    ) continue;

    if (goodIndex > 0 && ["cnCode", "allocationShare", "productionVolume"].includes(key)) {
      paths.add(`goods.${goodIndex - 1}.${key}`);
    } else if (["electricityConsumed", "gridEmissionFactor", "directEmissions"].includes(key)) {
      paths.add(key);
    } else if (key.startsWith("precursor")) {
      paths.add("precursors[]");
    } else if (key === "records") {
      paths.add("carbonPriceRecords[]");
    } else if (key === "aggregateProductionVolume") {
      paths.add("goods[].productionVolume");
    } else if (key === "allocationShares") {
      paths.add("goods[].allocationShare");
    } else if (key === "allocatedEmbeddedEmissions") {
      paths.add("goods[].allocatedEmbeddedEmissions");
    }
  }

  return [...paths].sort().map((path) => ({ path }));
}

function nodeBody(params: {
  id: string;
  label: string;
  formula: string;
  legalBasis: readonly string[];
  inputNodes: readonly string[];
  inputPaths: readonly { path: string }[];
  value: string;
  unit: string;
}) {
  return {
    id: params.id,
    label: params.label,
    formula: params.formula,
    legalBasis: params.legalBasis,
    inputNodes: params.inputNodes,
    inputPaths: params.inputPaths,
    value: params.value,
    unit: params.unit,
  };
}

/**
 * One-way derivation: Calculation Trace -> Calculation Graph.
 * Graph node hashes and root use the exact algorithm shipped in the offline
 * verifier CLI. The graph therefore cannot drift from Trace and still pass the
 * verifier that customers receive inside the sealed ZIP.
 */
export function buildCliVerifiableCalculationGraph(
  calculation: DossierCalculationResult
): CliVerifiableCalculationGraph {
  const formulaIds = calculation.trace.map((item) => item.formulaId);
  const nodes = calculation.trace.map((item) => {
    const id = item.formulaId;
    const label = item.formulaId
      .replace(/^CBAM_/, "")
      .replaceAll("_", " ")
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
    const body = nodeBody({
      id,
      label,
      formula: item.formulaId,
      legalBasis: [item.officialSource],
      inputNodes: formulaDependencies(item.formulaId, formulaIds),
      inputPaths: traceInputPaths(item),
      value: String(item.outputValue),
      unit: item.outputUnit,
    });
    return {
      ...body,
      value: { toString: () => body.value },
      hash: sha256(Buffer.from(cliCanonicalJson(body), "utf8")),
    };
  });

  const rootHash = sha256(
    Buffer.from(
      [...nodes]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((node) => node.hash)
        .join("|"),
      "utf8"
    )
  );

  return { rootHash, nodes };
}

function serializedNodeBody(node: Record<string, unknown>): Record<string, unknown> {
  const { hash: _hash, ...body } = node;
  return body;
}

/**
 * Cross-artifact + offline-verifier contract gate. Runs before manifest/KMS.
 */
export function assertCliGraphArtifactConsistency(
  artifacts: readonly HardenableArtifact[],
  calculation: DossierCalculationResult
): void {
  const traceArtifact = artifacts.find((item) => item.path === "Calculation Trace.json");
  const graphArtifact = artifacts.find((item) => item.path === "Calculation Graph.json");
  const workbookArtifact = artifacts.find((item) => item.path === "Verifier Workspace.xlsx");
  if (!traceArtifact || !graphArtifact || !workbookArtifact) {
    throw new Error("PREMIUM_PACKAGE_REPRODUCTION_ARTIFACT_MISSING");
  }

  const tracePayload = JSON.parse(traceArtifact.bytes.toString("utf8")) as {
    calculation?: DossierCalculationResult;
  };
  if (!tracePayload.calculation) throw new Error("PREMIUM_PACKAGE_TRACE_PAYLOAD_INVALID");
  if (tracePayload.calculation.calculationRootHash !== calculation.calculationRootHash) {
    throw new Error("PREMIUM_PACKAGE_TRACE_ROOT_MISMATCH");
  }

  const graphPayload = JSON.parse(graphArtifact.bytes.toString("utf8")) as {
    rootHash?: string;
    nodes?: Array<Record<string, unknown> & {
      id?: string;
      value?: string;
      unit?: string;
      hash?: string;
    }>;
  };
  const graphNodes = graphPayload.nodes || [];
  if (graphNodes.length !== calculation.trace.length) {
    throw new Error(
      `PREMIUM_PACKAGE_TRACE_GRAPH_NODE_COUNT_MISMATCH:${graphNodes.length}:${calculation.trace.length}`
    );
  }

  const rebuiltHashes: Array<{ id: string; hash: string }> = [];
  for (const node of graphNodes) {
    const id = String(node.id || "");
    if (!id) throw new Error("PREMIUM_PACKAGE_GRAPH_NODE_ID_MISSING");
    const rebuiltHash = sha256(
      Buffer.from(cliCanonicalJson(serializedNodeBody(node)), "utf8")
    );
    if (String(node.hash || "") !== rebuiltHash) {
      throw new Error(`PREMIUM_PACKAGE_GRAPH_NODE_HASH_MISMATCH:${id}`);
    }
    rebuiltHashes.push({ id, hash: rebuiltHash });
  }

  const rebuiltRoot = sha256(
    Buffer.from(
      rebuiltHashes
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((item) => item.hash)
        .join("|"),
      "utf8"
    )
  );
  if (graphPayload.rootHash !== rebuiltRoot) {
    throw new Error(`PREMIUM_PACKAGE_GRAPH_ROOT_MISMATCH:${String(graphPayload.rootHash)}:${rebuiltRoot}`);
  }

  const graphById = new Map(graphNodes.map((node) => [String(node.id), node]));
  for (const trace of calculation.trace) {
    const graph = graphById.get(trace.formulaId);
    if (!graph) throw new Error(`PREMIUM_PACKAGE_GRAPH_NODE_MISSING:${trace.formulaId}`);
    if (
      String(graph.value) !== String(trace.outputValue) ||
      String(graph.unit) !== String(trace.outputUnit)
    ) {
      throw new Error(`PREMIUM_PACKAGE_TRACE_GRAPH_NODE_MISMATCH:${trace.formulaId}`);
    }
  }
}
