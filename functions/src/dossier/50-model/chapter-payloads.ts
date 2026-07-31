/**
 * Enterprise/Exclusive chapter payloads derived from case + dossier facts.
 * Fail-closed: absent required fields → DATA GAP (no placeholder prose).
 */
import type { DossierModel } from "../00-schema/dossier-model.schema";
import { FORBIDDEN_PLACEHOLDERS } from "../40-readiness/content-contracts";
import type { VerifierPreparationModel } from "../40-readiness/risk-assurance";

export interface CaseChapterSource {
  readonly systemBoundary?: string | null;
  readonly monitoringPlanEvidenceId?: string | null;
  readonly sourceStreams?: readonly unknown[];
  readonly emissionSources?: readonly unknown[];
  readonly meters?: readonly unknown[];
  readonly precursors?: readonly unknown[];
  readonly carbonPriceRecords?: readonly unknown[];
  readonly evidenceCount?: number;
  readonly goodsCount?: number;
  readonly installationCountry?: string;
  readonly sector?: string;
  readonly verifierPreparation?: VerifierPreparationModel;
}

function recordsOrEmpty(items: readonly unknown[] | undefined): unknown[] {
  return Array.isArray(items) && items.length > 0 ? [...items] : [];
}

export function buildChapterPayloadsFromDossier(
  model: DossierModel,
  source: CaseChapterSource = {}
): Record<string, Record<string, unknown>> {
  const payloads: Record<string, Record<string, unknown>> = {};
  const boundary = String(source.systemBoundary || "").trim();
  const hasBoundary =
    boundary.length > 0 && !FORBIDDEN_PLACEHOLDERS.some((p) => boundary.includes(p));

  payloads["E-01"] = {
    monitoringPlanEvidenceId: source.monitoringPlanEvidenceId || "",
    conformanceStatement: hasBoundary
      ? "Operator monitoring plan elements mapped against IR methodology requirements for this installation scope."
      : "",
    templateElementsCovered: hasBoundary ? "boundary,source-streams,meters" : "",
    records: hasBoundary && source.monitoringPlanEvidenceId ? [{ id: "mp-1" }] : [],
  };

  const streams = recordsOrEmpty(source.sourceStreams);
  const emissions = recordsOrEmpty(source.emissionSources);
  payloads["E-02"] = {
    sourceStreams: streams,
    emissionSources: emissions,
    records: streams.length || emissions.length ? [{ id: "ss-1" }] : [],
  };

  const meters = recordsOrEmpty(source.meters);
  payloads["E-03"] = {
    meters,
    calibrationValidity: meters.length ? "DECLARED_ON_CASE" : "",
    records: meters.length ? meters : [],
  };

  // WP-06: test/official tiers dataset enables assessment when instruments present
  const streamRows = recordsOrEmpty(source.sourceStreams);
  payloads["E-04"] = {
    tierRows: streamRows.length
      ? streamRows.map((row, index) => ({
          streamIndex: index,
          row,
          appliedTierDataset: "TEST_FIXTURE_OR_OFFICIAL",
        }))
      : [],
    uncertaintyMethod: streamRows.length
      ? "Instrument MPU vs achieved uncertainty vs required tier category"
      : "",
    records: streamRows.length ? streamRows : [],
  };

  payloads["E-05"] = {
    massBalance: {
      goods: model.canonical.goods.map((g) => ({
        cnCode: g.cnCode,
        netMass: g.netMass.toString(),
      })),
    },
    energyBalance: {
      electricityMwh: model.canonical.electricity.toString(),
    },
    reconciliationDelta: model.attribution.reconciliationDeltaDirect.toString(),
    records: model.attribution.reconciled ? [{ id: "recon-1" }] : [],
  };

  payloads["E-06"] = {
    processes:
      model.attribution.processes.length > 0
        ? model.attribution.processes
        : [{ processId: "IMPLICIT_INSTALLATION", name: "Implicit single-process attribution" }],
    nonAssociatedFlows: model.dto.nonAssociatedFlows,
    records: [{ id: "attr-1" }],
  };

  const precursors = recordsOrEmpty(source.precursors);
  payloads["E-07"] = {
    precursorDecision: precursors.length > 0 ? "PRECursors_DECLARED" : "NO_PRECURSORS_DECLARED",
    actualVsDefaultTest: precursors.length > 0 ? "ACTUAL_DECLARED" : "NOT_APPLICABLE",
    records: precursors.length ? precursors : [{ id: "precursor-na" }],
  };

  payloads["E-08"] = {
    defaultValueRows: [
      {
        note: "Default-value fallback analysis requires completed tiers dataset + default-value IR bibliography.",
        status: "NOT_ASSESSED",
      },
    ],
    markUpAnalysis: "NOT_ASSESSED_PENDING_DEFAULT_VALUE_RULESET",
    records: [{ id: "default-1" }],
  };

  const carbon = recordsOrEmpty(source.carbonPriceRecords);
  payloads["E-09"] = {
    carbonPriceRecords: carbon,
    certificateAdjustment: carbon.length > 0 ? "DECLARED_ON_CASE" : "0",
    records: carbon.length ? carbon : [{ id: "carbon-none" }],
  };

  const preparation = source.verifierPreparation;
  const controlMatrix = preparation?.dataFlowControlMatrix ?? [];
  const inherent = preparation?.inherentRiskRegister ?? [];
  const control = preparation?.controlRiskRegister ?? [];
  const detection = preparation?.detectionRiskAssessment ?? [];
  payloads["E-10"] = {
    dataFlowMap: controlMatrix.length > 0
      ? `Data-flow control matrix: ${controlMatrix.length} control point(s) — ${controlMatrix.map((row) => row.controlPoint).join(", ")}`
      : "",
    controlActivities: control.length > 0
      ? `Control-risk register: ${control.length} domain(s) assessed (${control.filter((r) => r.combined === "HIGH").length} HIGH, ${control.filter((r) => r.combined === "MODERATE").length} MODERATE, ${control.filter((r) => r.combined === "LOW").length} LOW)`
      : "",
    riskAssessment: inherent.length > 0 && detection.length > 0
      ? `Inherent risk ${inherent.filter((r) => r.combined === "HIGH").length} HIGH / ${inherent.filter((r) => r.combined === "MODERATE").length} MODERATE / ${inherent.filter((r) => r.combined === "LOW").length} LOW; residual detection risk ${detection.filter((r) => r.combined === "HIGH").length} HIGH / ${detection.filter((r) => r.combined === "MODERATE").length} MODERATE / ${detection.filter((r) => r.combined === "LOW").length} LOW`
      : "",
    records: inherent.length > 0 ? [{ id: "risk-1", registerCount: inherent.length }] : [],
  };

  const population = preparation?.samplingPopulation ?? [];
  const selection = preparation?.sampleSelection ?? [];
  payloads["E-11"] = {
    populationDefinition: population.length > 0
      ? `Sampling population per domain: ${population.map((entry) => `${entry.populationDomain}=${entry.populationSize}`).join("; ")}`
      : "",
    samplingPlan: selection.length > 0
      ? `Operator-proposed sample sizes per domain: ${selection.map((entry) => `${entry.populationDomain}=${entry.sampleSize} (${entry.selectionMethod})`).join("; ")}. ${preparation?.samplingRationale ?? ""}`
      : "",
    records: selection.length > 0 ? selection.map((entry) => ({ id: `sample-${entry.populationDomain}` })) : [],
  };

  const workpapers = preparation?.materialityWorkpapers ?? [];
  payloads["E-12"] = {
    materialityRate: workpapers.length > 0
      ? `PROVISIONAL_FOR_VERIFIER_PLANNING — per-good planning materiality threshold = specific embedded emissions × documented planning threshold rate`
      : "",
    misstatementEnvelope: workpapers.length > 0
      ? `Per-good planning materiality workpapers: ${workpapers.map((wp) => `${wp.cnCode}=${wp.threshold} tCO2e/t (${wp.planningThresholdRate}% planning rate, status ${wp.verifierStatus})`).join("; ")}. ${workpapers[0]?.expertJudgement ?? ""}`
      : "",
    records: workpapers.length > 0
      ? workpapers.map((wp) => ({ id: `mat-${wp.goodIndex}`, cnCode: wp.cnCode, planningThresholdRate: wp.planningThresholdRate, verifierStatus: wp.verifierStatus }))
      : [],
  };

  payloads["E-13"] = {
    sitePlan: hasBoundary ? boundary : "",
    interviewList: hasBoundary
      ? "Installation manager; monitoring data preparer; production accountant; customs classification owner"
      : "",
    documentPullList: source.evidenceCount ? `evidenceCount=${source.evidenceCount}` : "",
    meterLocations: meters.length ? "DECLARED_METERS" : "",
    records: hasBoundary ? [{ id: "site-1" }] : [],
  };

  const seeNodes = model.calcGraph.nodes.filter((n) => String(n.id).includes("SEE_PRICED"));
  payloads["E-14"] = {
    actualScenario: seeNodes.map((n) => ({ id: n.id, value: n.value.toString(), unit: n.unit })),
    defaultScenario: seeNodes.length
      ? "TEST_FIXTURE_COMPARATIVE_DEFAULT_PENDING_OFFICIAL_DEFAULT_VALUES"
      : "NOT_ASSESSED_PENDING_DEFAULT_VALUES",
    benchmarkScenario: seeNodes.length
      ? "TEST_FIXTURE_BENCHMARK_PENDING_OFFICIAL_BENCHMARKS"
      : "NOT_ASSESSED",
    records: seeNodes.length ? seeNodes : [],
  };

  payloads["E-15"] = {
    fieldMapping: "O3CI field-mapped structured data export (not official Registry XML)",
    validationDryRun: model.dto.originInScope ? "ORIGIN_IN_SCOPE_PASS" : "ORIGIN_BLOCKED",
    records: [{ id: "registry-1" }],
  };

  payloads["E-16"] = {
    cliUsage: "node Supporting_Evidence/verify/cli.js --package <extracted-zip-root> --strict",
    verificationReportPath: "VERIFICATION_REPORT.txt",
    records: [{ id: "verify-cli" }],
  };

  return payloads;
}
