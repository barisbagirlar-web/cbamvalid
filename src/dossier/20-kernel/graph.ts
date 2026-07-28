/**
 * Pure CalcGraph — node construction + merkle root.
 * NO Date.now(), NO I/O, NO globals.
 */
import { createHash } from "node:crypto";
import { Decimal } from "../00-schema/units";
import {
  sha256Brand,
  NodeIds,
  type CalcNodeId,
  type Sha256,
} from "../00-schema/ids";
import type { RegulationKey } from "../01-ruleset/regulations.registry";
import type { UnitSymbol } from "../00-schema/units";
import type { CanonicalCase } from "../10-normalize/normalizeCase";
import { energyTimesFactor } from "../00-schema/units";
import {
  attributeByShare,
  specificEmbeddedEmissions,
} from "./allocation";
import { fraction } from "../00-schema/units";

export interface InputPath {
  readonly path: string;
}

export interface CalcNode {
  readonly id: CalcNodeId;
  readonly label: string;
  readonly formula: string;
  readonly legalBasis: readonly RegulationKey[];
  readonly inputNodes: readonly CalcNodeId[];
  readonly inputPaths: readonly InputPath[];
  readonly value: Decimal;
  readonly unit: UnitSymbol;
  readonly hash: Sha256;
}

export interface CalcGraph {
  readonly nodes: readonly CalcNode[];
  readonly rootHash: Sha256;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v instanceof Decimal) return v.toString();
    return v;
  });
}

export function hashNodePayload(payload: Omit<CalcNode, "hash">): Sha256 {
  const digest = createHash("sha256").update(canonicalJson(payload), "utf8").digest("hex");
  return sha256Brand(digest);
}

export function makeNode(params: Omit<CalcNode, "hash">): CalcNode {
  const hash = hashNodePayload(params);
  return Object.freeze({ ...params, hash });
}

export function merkleRoot(nodes: readonly CalcNode[]): Sha256 {
  const sorted = [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const joined = sorted.map((n) => n.hash).join("|");
  return sha256Brand(createHash("sha256").update(joined, "utf8").digest("hex"));
}

export function buildCalcGraph(canonical: CanonicalCase): CalcGraph {
  if (!canonical.originScope.inScope) {
    throw new Error(
      `CBAM_ORIGIN_OUT_OF_SCOPE:${"code" in canonical.originScope ? canonical.originScope.code : "UNKNOWN"}`
    );
  }

  const nodes: CalcNode[] = [];

  const dir = makeNode({
    id: NodeIds.dirInstallation(),
    label: "Installation direct emissions",
    formula: "E_dir = declared installation direct emissions",
    legalBasis: ["CBAM_BASE", "IR_METHODOLOGY"],
    inputNodes: [],
    inputPaths: [{ path: "directEmissionsTco2e" }],
    value: canonical.directEmissions,
    unit: "tCO2e",
  });
  nodes.push(dir);

  const indComputed = energyTimesFactor(canonical.electricity, canonical.gridFactor);
  const ind = makeNode({
    id: NodeIds.indInstallation(),
    label: "Installation indirect emissions",
    formula: "E_ind = Q_el × EF_grid",
    legalBasis: ["CBAM_BASE", "IR_METHODOLOGY"],
    inputNodes: [],
    inputPaths: [{ path: "electricityMwh" }, { path: "gridFactorTco2ePerMwh" }],
    value: indComputed,
    unit: "tCO2e",
  });
  nodes.push(ind);

  let totalPriced = new Decimal(0);
  let totalDisclosed = new Decimal(0);

  for (const good of canonical.goods) {
    const share =
      good.allocationShare ??
      fraction(
        good.netMass
          .dividedBy(
            canonical.goods.reduce((acc, g) => acc.plus(g.netMass), new Decimal(0))
          )
          .toString()
      );

    const attribution = attributeByShare(
      canonical.directEmissions,
      indComputed,
      share,
      good.netMass
    );
    const see = specificEmbeddedEmissions(attribution, good.sectorRule);

    const eeDirect = makeNode({
      id: NodeIds.goodEeDirect(good.index),
      label: `Good ${good.index} attributed direct`,
      formula: "EE_dir = E_dir × allocationShare",
      legalBasis: good.sectorRule.legalBasis,
      inputNodes: [dir.id],
      inputPaths: [{ path: `goods.${good.index}.allocationShare` }],
      value: attribution.attributedDirect,
      unit: "tCO2e",
    });
    nodes.push(eeDirect);

    const eeIndirect = makeNode({
      id: NodeIds.goodEeIndirect(good.index),
      label: `Good ${good.index} attributed indirect`,
      formula: "EE_ind = E_ind × allocationShare",
      legalBasis: good.sectorRule.legalBasis,
      inputNodes: [ind.id],
      inputPaths: [{ path: `goods.${good.index}.allocationShare` }],
      value: attribution.attributedIndirect,
      unit: "tCO2e",
    });
    nodes.push(eeIndirect);

    const seeDirect = makeNode({
      id: NodeIds.goodSeeDirect(good.index),
      label: `Good ${good.index} SEE direct`,
      formula: "SEE_dir = EE_dir / netMass",
      legalBasis: good.sectorRule.legalBasis,
      inputNodes: [eeDirect.id],
      inputPaths: [{ path: `goods.${good.index}.netMassTonnes` }],
      value: see.seeDirect,
      unit: "tCO2e/t",
    });
    nodes.push(seeDirect);

    const seeIndirect = makeNode({
      id: NodeIds.goodSeeIndirect(good.index),
      label: `Good ${good.index} SEE indirect`,
      formula: "SEE_ind = EE_ind / netMass",
      legalBasis: good.sectorRule.legalBasis,
      inputNodes: [eeIndirect.id],
      inputPaths: [{ path: `goods.${good.index}.netMassTonnes` }],
      value: see.seeIndirect,
      unit: "tCO2e/t",
    });
    nodes.push(seeIndirect);

    const seePriced = makeNode({
      id: NodeIds.goodSeePriced(good.index),
      label: `Good ${good.index} SEE priced`,
      formula: good.sectorRule.indirectPriced
        ? "SEE_priced = SEE_dir + SEE_ind"
        : "SEE_priced = SEE_dir (Annex II — indirect not priced)",
      legalBasis: good.sectorRule.legalBasis,
      inputNodes: good.sectorRule.indirectPriced
        ? [seeDirect.id, seeIndirect.id]
        : [seeDirect.id],
      inputPaths: [],
      value: see.seePriced,
      unit: "tCO2e/t",
    });
    nodes.push(seePriced);

    totalPriced = totalPriced.plus(see.attributedPriced);
    totalDisclosed = totalDisclosed
      .plus(attribution.attributedDirect)
      .plus(attribution.attributedIndirect);
  }

  nodes.push(
    makeNode({
      id: NodeIds.totalPriced(),
      label: "Total priced embedded emissions",
      formula: "Σ attributed priced emissions across goods",
      legalBasis: ["CBAM_BASE", "IR_METHODOLOGY"],
      inputNodes: canonical.goods.map((g) => NodeIds.goodSeePriced(g.index)),
      inputPaths: [],
      value: totalPriced,
      unit: "tCO2e",
    })
  );

  nodes.push(
    makeNode({
      id: NodeIds.totalDisclosed(),
      label: "Total disclosed embedded emissions (direct+indirect)",
      formula: "Σ attributed direct + indirect (disclosure, not always priced)",
      legalBasis: ["CBAM_BASE", "IR_METHODOLOGY"],
      inputNodes: [dir.id, ind.id],
      inputPaths: [],
      value: totalDisclosed,
      unit: "tCO2e",
    })
  );

  // Prove constructor never emits truncated IDs
  for (const n of nodes) {
    if (!/^CBAM\.[A-Z]+(\.[A-Z0-9_]+)*$/.test(n.id)) {
      throw new Error(`Invalid CalcNodeId in graph: ${n.id}`);
    }
  }

  const frozenNodes = Object.freeze(nodes.map((n) => Object.freeze(n)));
  return Object.freeze({
    nodes: frozenNodes,
    rootHash: merkleRoot(frozenNodes),
  });
}

/** Re-derive each node hash from payload and merkle root — shipped verifier path. */
export function recomputeGraphHashes(nodes: readonly CalcNode[]): {
  readonly nodes: readonly CalcNode[];
  readonly rootHash: Sha256;
} {
  const rebuilt = nodes.map((n) => {
    const { hash: _ignored, ...payload } = n;
    void _ignored;
    return makeNode(payload);
  });
  return {
    nodes: Object.freeze(rebuilt),
    rootHash: merkleRoot(rebuilt),
  };
}
