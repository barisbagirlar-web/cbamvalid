/**
 * L5→L6 assembler — builds frozen, self-validated DossierModel.
 * Renderers must consume only this object.
 */
import { applicableActStack } from "../01-ruleset/regulations.registry";
import { normalizeCase, type CanonicalCase } from "../10-normalize/normalizeCase";
import { buildCalcGraph, type CalcGraph } from "../20-kernel/graph";
import {
  attributeInstallationToProcesses,
  emptyNonAssociatedFlows,
  type AttributionResult,
} from "../20-kernel/attribution";
import { computeHonestScores, type ScoreBreakdown } from "../40-readiness/score";
import { buildVersionStamp, DOSSIER_SCHEMA_VERSION, type VersionStamp } from "./version-stamp";
import {
  assertDossierModel,
  freezeDossierModel,
  type DossierModel,
  type DossierModelDto,
} from "../00-schema/dossier-model.schema";
import { sha256Brand } from "../00-schema/ids";
import { tco2e } from "../00-schema/units";

export interface AssembleOptions {
  readonly releaseIteration?: number;
  readonly productVersion?: string;
  readonly chapterNonEmpty?: Readonly<Record<string, boolean>>;
  readonly evidenceDimensionScore01?: number;
  readonly signOffsComplete?: boolean;
  readonly verifierReservedComplete?: number;
  readonly verifierReservedTotal?: number;
  readonly hardBlockers?: readonly string[];
}

function quantitiesFromGraph(graph: CalcGraph): DossierModelDto["quantities"] {
  return graph.nodes.map((n) => ({
    value: n.value.toString(),
    unit: n.unit,
    precision: 6,
    sourceNodeId: n.id,
  }));
}

export function assembleDossier(rawInput: unknown, options: AssembleOptions = {}): DossierModel {
  const canonical: CanonicalCase = normalizeCase(rawInput);
  const versions: VersionStamp = buildVersionStamp(
    options.releaseIteration ?? 1,
    options.productVersion
  );

  if (!canonical.originScope.inScope) {
    const scores = computeHonestScores({
      originInScope: false,
      dimensionScores: [],
      signOffsComplete: false,
      verifierReservedComplete: 0,
      verifierReservedTotal: 5,
      hardBlockers: ["ORIGIN_OUT_OF_SCOPE"],
    });
    const dto = assertDossierModel({
      schemaVersion: DOSSIER_SCHEMA_VERSION,
      caseId: canonical.caseId,
      originInScope: false,
      originBlockCode: canonical.originScope.code,
      versions: {
        product: versions.product,
        schema: versions.schema,
        ruleset: { id: versions.ruleset.id, sha256: versions.ruleset.sha256 },
        releaseIteration: versions.releaseIteration,
      },
      scores: {
        operatorReadiness: scores.operatorReadiness,
        verifierReservedCount: scores.verifierReservedCount,
        verifierReservedTotal: scores.verifierReservedTotal,
        dossierCompleteness: scores.dossierCompleteness,
        status: scores.status,
        formula: scores.formula,
        findings: [...scores.findings],
      },
      calculationRootHash: "0".repeat(64),
      quantities: [],
      annexIiSectorsPresent: canonical.goods.some((g) => g.sectorRule.annexII),
      legalCitations: applicableActStack().map((a) => ({
        key: a.key,
        short: a.short,
        role: a.role,
      })),
      nonAssociatedFlows: {
        wasteGasExported: "0",
        heatExported: "0",
        electricityExported: "0",
        nonCbamGoods: "0",
      },
    });

    const emptyGraph: CalcGraph = Object.freeze({
      nodes: Object.freeze([]),
      rootHash: sha256Brand("0".repeat(64)),
    });
    const zero = tco2e(0);
    const attribution: AttributionResult = Object.freeze({
      processes: Object.freeze([]),
      nonAssociated: emptyNonAssociatedFlows(),
      processDirectSum: zero,
      processIndirectSum: zero,
      reconciliationDeltaDirect: zero,
      reconciliationDeltaIndirect: zero,
      reconciled: false,
      simplifiedAllocationFinding: null,
    });

    return freezeDossierModel({
      dto,
      canonical,
      calcGraph: emptyGraph,
      scores,
      attribution,
      versions,
    });
  }

  const attribution = attributeInstallationToProcesses(canonical);
  const calcGraph = buildCalcGraph(canonical);

  const chapters = options.chapterNonEmpty ?? {};
  const evidenceScore = options.evidenceDimensionScore01 ?? 0.35;
  const signOffsComplete =
    options.signOffsComplete ??
    (canonical.signOffs.length >= 3 &&
      canonical.signOffs.every((s) => s.name && s.title && s.signedAt));

  const scores: ScoreBreakdown = computeHonestScores({
    originInScope: true,
    dimensionScores: [
      {
        id: "EVIDENCE",
        weight: 20,
        score01: evidenceScore,
        chapterNonEmpty: chapters.EVIDENCE !== false,
        operatorControllable: true,
      },
      {
        id: "SCOPE_METHODOLOGY",
        weight: 15,
        score01: chapters.SCOPE_METHODOLOGY === false ? 0 : 0.5,
        chapterNonEmpty: chapters.SCOPE_METHODOLOGY !== false,
        operatorControllable: true,
      },
      {
        id: "DATA_QUALITY_UNCERTAINTY",
        weight: 10,
        score01: chapters.DATA_QUALITY_UNCERTAINTY === true ? 0.5 : 0,
        chapterNonEmpty: chapters.DATA_QUALITY_UNCERTAINTY === true,
        operatorControllable: true,
      },
      {
        id: "CALCULATIONS",
        weight: 20,
        score01: 1,
        chapterNonEmpty: true,
        operatorControllable: true,
      },
    ],
    signOffsComplete,
    verifierReservedComplete: options.verifierReservedComplete ?? 0,
    verifierReservedTotal: options.verifierReservedTotal ?? 5,
    hardBlockers: options.hardBlockers ?? [],
  });

  const dto = assertDossierModel({
    schemaVersion: DOSSIER_SCHEMA_VERSION,
    caseId: canonical.caseId,
    originInScope: true,
    originBlockCode: null,
    versions: {
      product: versions.product,
      schema: versions.schema,
      ruleset: { id: versions.ruleset.id, sha256: versions.ruleset.sha256 },
      releaseIteration: versions.releaseIteration,
    },
    scores: {
      operatorReadiness: scores.operatorReadiness,
      verifierReservedCount: scores.verifierReservedCount,
      verifierReservedTotal: scores.verifierReservedTotal,
      dossierCompleteness: scores.dossierCompleteness,
      status: scores.status,
      formula: scores.formula,
      findings: [...scores.findings],
    },
    calculationRootHash: calcGraph.rootHash,
    quantities: quantitiesFromGraph(calcGraph),
    annexIiSectorsPresent: canonical.goods.some((g) => g.sectorRule.annexII),
    legalCitations: applicableActStack().map((a) => ({
      key: a.key,
      short: a.short,
      role: a.role,
    })),
    nonAssociatedFlows: {
      wasteGasExported: attribution.nonAssociated.wasteGasExportedTco2e.toString(),
      heatExported: attribution.nonAssociated.heatExportedTco2e.toString(),
      electricityExported: attribution.nonAssociated.electricityExportedTco2e.toString(),
      nonCbamGoods: attribution.nonAssociated.nonCbamGoodsTco2e.toString(),
    },
  });

  return freezeDossierModel({
    dto,
    canonical,
    calcGraph,
    scores,
    attribution,
    versions,
  });
}
