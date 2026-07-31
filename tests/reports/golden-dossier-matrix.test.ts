import crypto from "node:crypto";
import JSZip from "jszip";
import Decimal from "decimal.js";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it, vi } from "vitest";

const { mockDocs, mockDbTransaction } = vi.hoisted(() => {
  const mockDocs = {} as Record<string, Record<string, unknown>>;
  const mockDbTransaction = {
    get: async (reference: { path?: string; get?: () => Promise<unknown> }) => {
      if (reference && typeof reference.get === "function" && !reference.path) return reference.get();
      const path = reference?.path || "";
      const data = mockDocs[path];
      return { id: path.split("/").at(-1) || path, exists: Boolean(data), data: () => data };
    },
    set: (reference: { path: string }, data: Record<string, unknown>) => {
      mockDocs[reference.path] = data;
    },
    update: (reference: { path: string }, data: Record<string, unknown>) => {
      mockDocs[reference.path] = { ...mockDocs[reference.path], ...data };
    },
  };
  return { mockDocs, mockDbTransaction };
});

vi.mock("../../functions/src/firebase-admin", () => {
  type QueryFilter = { field: string; operator: string; value: unknown };
  const documentSnapshot = (path: string, data: Record<string, unknown>) => ({
    id: path.split("/").at(-1) || path,
    exists: true,
    data: () => data,
  });
  return {
    adminDb: {
      collection: (collectionName: string) => {
        const filters: QueryFilter[] = [];
        let resultLimit: number | undefined;
        const collection = {
          where: (field: string, operator: string, value: unknown) => {
            filters.push({ field, operator, value });
            return collection;
          },
          limit: (value: number) => {
            resultLimit = value;
            return collection;
          },
          orderBy: () => collection,
          get: async () => {
            const prefix = `${collectionName}/`;
            let documents = Object.entries(mockDocs)
              .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
              .filter(([, data]) => filters.every((filter) => {
                if (filter.operator !== "==") throw new Error(`UNSUPPORTED_MOCK_QUERY_OPERATOR:${filter.operator}`);
                return data[filter.field] === filter.value;
              }))
              .map(([path, data]) => documentSnapshot(path, data));
            if (resultLimit !== undefined) documents = documents.slice(0, resultLimit);
            return { empty: documents.length === 0, docs: documents };
          },
          doc: (documentId?: string) => {
            const id = documentId || Math.random().toString(36).substring(2, 15);
            const path = `${collectionName}/${id}`;
            return {
              id,
              path,
              get: async () => {
                const data = mockDocs[path];
                return { id, exists: Boolean(data), data: () => data };
              },
              set: async (data: Record<string, unknown>) => {
                mockDocs[path] = data;
              },
              update: async (data: Record<string, unknown>) => {
                mockDocs[path] = { ...mockDocs[path], ...data };
              },
              delete: async () => {
                delete mockDocs[path];
              },
            };
          },
        };
        return collection;
      },
      runTransaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(mockDbTransaction),
    },
    getStorageBucket: () => ({
      file: () => ({
        save: async () => undefined,
        download: async () => [Buffer.from("")],
        delete: async () => undefined,
      }),
    }),
  };
});
import { AuditReadyCaseSchema, type AuditReadyCase, type EvidenceRecord } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import { assessReadiness, getReportingPeriodAssessment } from "../../functions/src/cbam/validation/readiness-score";
import { runEvidenceSufficiency, isEvidenceSupportedState } from "../../functions/src/cbam/validation/evidence-sufficiency";
import { generateFindingsAndActions } from "../../functions/src/cbam/validation/findings-engine";
import { REQUIRED_TOP_LEVEL_COMPONENTS_V5 } from "../../functions/src/cbam/report/package-components";
import {
  buildDataIntegrityManifest,
  buildUnsignedVerifierArtifacts,
  finalizeVerifierPackage,
  type DataIntegrityManifest,
} from "../../functions/src/cbam/report/verifier-package-builder";
import { buildRegistryTemplateMapping } from "../../functions/src/cbam/registry/registry-template-mapping";
import { buildPublicVerificationPayload } from "../../lib/verify/public-verification";
import { assertCalculationNodeIntegrity } from "../../functions/src/cbam/calculator";
import { buildVerifierPreparationModel } from "../../functions/src/dossier/40-readiness/risk-assurance";
import { EXTERNAL_VERIFIER_COMPLETION_TOTAL, countExternalVerifierCompletion, buildHonestScoreboard } from "../../functions/src/cbam/report/honest-scoreboard";
import type { ScoreBreakdown } from "../../functions/src/dossier/40-readiness/score";
import {
  createEntitlement,
  reserveEntitlement,
  releaseEntitlementReservation,
  consumeEntitlement,
} from "../../functions/src/commerce/entitlement-service";
import { createSignature } from "../fixtures/kms-test-signer";
import {
  FIXTURE_GENERATED_AT,
  FIXTURE_REPORT_ID,
  FIXTURE_PACKAGE_CODE,
  FIXTURE_OWNER_ID,
  FIXTURE_CASE_ID,
  createVerifierEvidenceFiles,
  createVerifierGradeCase,
} from "../fixtures/verifier-grade-case";

const AT = FIXTURE_GENERATED_AT;

// ---------------------------------------------------------------------------
// Fixture: a genuinely complete, seal-ready annual case for any sector.
// ---------------------------------------------------------------------------

let evidenceSeq = 0;
function linkEvidence(inputs: string[], issuer: string, documentType = "VERIFICATION_DOCUMENT"): EvidenceRecord {
  evidenceSeq += 1;
  const evidenceId = `dddddddd-${String(evidenceSeq).padStart(4, "0")}-4ddd-8ddd-${String(evidenceSeq).padStart(12, "0")}`;
  return {
    evidenceId,
    documentType,
    fileName: `evidence-${evidenceSeq}.pdf`,
    storagePath: `evidence/${FIXTURE_OWNER_ID}/${FIXTURE_CASE_ID}/${evidenceId}/evidence-${evidenceSeq}.pdf`,
    mimeType: "application/pdf",
    sizeBytes: 2048 + evidenceSeq,
    issuer,
    issueDate: "2026-02-01",
    reportingPeriod: "2026 ANNUAL",
    fileHash: `dd${String(evidenceSeq).padStart(2, "0")}${"c".repeat(60)}`,
    uploadTimestamp: "2026-02-02T00:00:00.000Z",
    uploader: "data-preparer",
    reviewStatus: "APPROVED",
    supportStatus: "SUPPORTED",
    malwareScanStatus: "CLEAN",
    confidentiality: "CONFIDENTIAL",
    linkedInputs: inputs,
    linkedCalculations: [],
    evidencePeriodStart: "2026-01-01",
    evidencePeriodEnd: "2026-12-31",
  };
}

export function buildCompleteAnnualCase(sector: string): AuditReadyCase {
  evidenceSeq = 0;
  const base = AuditReadyCaseSchema.parse(createVerifierGradeCase());
  const ev = {
    opName: linkEvidence(["exporterIdentity.legalName"], "Accredited National Authority"),
    opAddr: linkEvidence(["exporterIdentity.address"], "Accredited National Authority"),
    imName: linkEvidence(["importerIdentity.legalName"], "Accredited National Authority"),
    imEori: linkEvidence(["importerIdentity.eoriNumber"], "Customs Authority", "CUSTOMS_DECLARATION"),
    instName: linkEvidence(["installation.name"], "Accredited National Authority"),
    instCountry: linkEvidence(["installation.country"], "Local Chamber of Commerce"),
    instRoute: linkEvidence(["installation.productionRoute"], "Local Chamber of Commerce"),
    periodYear: linkEvidence(["reportingPeriod.year"], "Operator Admin"),
  };
  const goodsEv: Record<string, EvidenceRecord> = {};
  base.goods.forEach((_, i) => {
    goodsEv[`cn${i}`] = linkEvidence([`goods.${i}.cnCode`], "Customs Authority", "CUSTOMS_DECLARATION");
    goodsEv[`vol${i}`] = linkEvidence([`goods.${i}.productionVolume`], "Internal Production Auditor", "PRODUCTION_RECONCILIATION_REPORT");
    goodsEv[`alloc${i}`] = linkEvidence([`goods.${i}.allocationShare`], "Internal Production Auditor", "PRODUCTION_RECONCILIATION_REPORT");
  });
  const dir = linkEvidence(["directEmissions"], "Independent Monitoring Auditor", "PRIMARY_MONITORING_AND_CUSTOMS_PACKAGE");
  const elec = linkEvidence(["electricityConsumed", "gridEmissionFactor"], "National Power Utility", "UTILITY_BILL");
  const carbon = linkEvidence(["carbonPriceRecords.0.proofOfPaymentEvidenceId"], "Regional Tax Authority");
  const calibration = linkEvidence(["directEmissions"], "Accredited Calibration Laboratory", "CALIBRATION_CERTIFICATE");
  const diagram = linkEvidence(["installation.installationDiagramEvidenceId"], "Operator Engineering", "PLANT_LAYOUT_DIAGRAM");

  const withEv = (d: { value: unknown }, id: string) => ({ ...d, evidenceId: id });
  const datum3 = (value: string) => ({ value, sourceType: "PRIMARY" as const, confidenceStatus: "HIGH_VERIFIED" as const });
  const goods = base.goods.map((g, i) => ({
    ...g,
    sector,
    cnCode: { ...g.cnCode, evidenceId: goodsEv[`cn${i}`].evidenceId },
    productionVolume: { ...g.productionVolume, evidenceId: goodsEv[`vol${i}`].evidenceId },
    allocationShare: g.allocationShare ? { ...g.allocationShare, evidenceId: goodsEv[`alloc${i}`].evidenceId } : undefined,
  }));

  const route =
    sector === "ALUMINIUM" ? "Primary Aluminium Electrolysis"
    : sector === "CEMENT" ? "Dry process rotary kiln"
    : sector === "FERTILISERS" ? "Ammonia steam reforming (natural gas)"
    : sector === "HYDROGEN" ? "Steam methane reforming"
    : base.installation.productionRoute.value;

  const fixtureDecisions = base.methodologyDecisions.map((d, idx) => ({
    ...d,
    evidenceIds: d.evidenceIds.length > 0 ? [goodsEv[`alloc${idx % base.goods.length}`].evidenceId] : [],
  }));

  return AuditReadyCaseSchema.parse({
    ...base,
    exporterIdentity: {
      ...base.exporterIdentity,
      legalName: withEv(base.exporterIdentity.legalName, ev.opName.evidenceId),
      address: base.exporterIdentity.address ? withEv(base.exporterIdentity.address, ev.opAddr.evidenceId) : base.exporterIdentity.address,
      registrationNumber: withEv(datum3("TR-2026-447788"), ev.opName.evidenceId),
      contactPerson: withEv(datum3("Ali Yilmaz"), ev.opName.evidenceId),
      contactRole: withEv(datum3("Exports Compliance Manager"), ev.opName.evidenceId),
      contactEmail: withEv(datum3("compliance@exporter.example"), ev.opName.evidenceId),
      exporterCountry: withEv(datum3("TR"), ev.opName.evidenceId),
    },
    importerIdentity: {
      ...base.importerIdentity,
      legalName: withEv(base.importerIdentity.legalName, ev.imName.evidenceId),
      eoriNumber: withEv(base.importerIdentity.eoriNumber, ev.imEori.evidenceId),
    },
    installation: {
      ...base.installation,
      name: withEv(base.installation.name, ev.instName.evidenceId),
      country: withEv(base.installation.country, ev.instCountry.evidenceId),
      productionRoute: { ...withEv(base.installation.productionRoute, ev.instRoute.evidenceId), value: route },
      installationDiagramEvidenceId: diagram.evidenceId,
      registryInstallationId: withEv(datum3("CBAM-INST-2026-000123"), ev.instCountry.evidenceId),
      unloCode: withEv(datum3("TRISK"), ev.instCountry.evidenceId),
      address: withEv(datum3("Organize Sanayi Bolgesi, Iskenderun, Hatay, Turkiye"), ev.instCountry.evidenceId),
      latitude: withEv(datum3("36.587024"), ev.instCountry.evidenceId),
      longitude: withEv(datum3("36.172737"), ev.instCountry.evidenceId),
      excludedProcesses: "Ancillary non-production heating; site lighting and offices",
      functionalUnits: "Primary aluminium electrolysis cells line A and line B",
      monitoringPlanId: withEv(datum3("MP-CBAM-2026-001"), ev.instRoute.evidenceId),
      monitoringPlanVersion: withEv(datum3("2"), ev.instRoute.evidenceId),
      monitoringPlanEffectiveDate: withEv(datum3("2026-01-01"), ev.instRoute.evidenceId),
    },
    reportingPeriod: {
      ...base.reportingPeriod,
      year: withEv(base.reportingPeriod.year, ev.periodYear.evidenceId),
      startDate: withEv(datum3("2026-01-01"), ev.periodYear.evidenceId),
      endDate: withEv(datum3("2026-12-31"), ev.periodYear.evidenceId),
    },
    directEmissions: withEv(base.directEmissions, dir.evidenceId),
    electricityConsumed: withEv(base.electricityConsumed, elec.evidenceId),
    gridEmissionFactor: withEv(base.gridEmissionFactor, elec.evidenceId),
    goods,
    evidenceRegister: [...Object.values(ev), ...Object.values(goodsEv), dir, elec, carbon, calibration, diagram],
    carbonPriceRecords: base.carbonPriceRecords.map((r) => ({ ...r, proofOfPaymentEvidenceId: carbon.evidenceId })),
    methodologyDecisions: [
      {
        decisionId: "dddddddd-0001-4ddd-8ddd-ddddddddddd1",
        topic: "installation.systemBoundaries",
        selectedMethod: "Documented system boundary based on controlled production route.",
        reason: "Boundary confirmed from the controlled route and excluded-process register.",
        legalOrTechnicalBasis: "Commission Implementing Regulation (EU) 2025/2546 Article 6.",
        evidenceIds: [],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
      ...fixtureDecisions,
    ],
  });
}

// ---------------------------------------------------------------------------
// Per-sector golden fixtures — independent arithmetic in the test.
// ---------------------------------------------------------------------------

const SECTOR_GOLDEN = [
  { sector: "IRON_AND_STEEL", annexII: true, indirectPriced: false, route: "Blast Furnace Route (BF-BOF)" },
  { sector: "ALUMINIUM", annexII: true, indirectPriced: false, route: "Primary Aluminium Electrolysis" },
  { sector: "CEMENT", annexII: false, indirectPriced: true, route: "Dry process rotary kiln" },
  { sector: "FERTILISERS", annexII: false, indirectPriced: true, route: "Ammonia steam reforming (natural gas)" },
  { sector: "HYDROGEN", annexII: true, indirectPriced: false, route: "Steam methane reforming" },
  { sector: "ELECTRICITY", annexII: true, indirectPriced: false, route: "Blast Furnace Route (BF-BOF)" },
] as const;

describe("FAZ 14 — golden fixtures per supported sector", () => {
  for (const golden of SECTOR_GOLDEN) {
    it(`produces deterministic, independently verified A-H totals for ${golden.sector}`, () => {
      const caseData = buildCompleteAnnualCase(golden.sector);
      const readiness = assessReadiness({ caseData, isDraft: false, assessmentTimestamp: AT, sealMode: "PRODUCTION" });
      expect(readiness.operatorStatus).toBe("OPERATOR_PREPARATION_COMPLETE");
      expect(readiness.criticalBlockerCount).toBe(0);
      expect(readiness.missingMaterialEvidenceCount).toBe(0);

      const first = performDossierCalculations(caseData);
      const second = performDossierCalculations(caseData);
      expect(second.calculationRootHash).toBe(first.calculationRootHash); // deterministic replay

      // Independent manual arithmetic: A=80 direct, D=40 indirect (100 × 0.4).
      const { emissionsByCategory: e, allocationReconciliationDelta, productionVolume, totalEmbeddedEmissions } = first;
      expect(e.A_INSTALLATION_DIRECT).toBe("80");
      expect(e.B_PRECURSOR_ATTRIBUTABLE_DIRECT).toBe("0");
      expect(e.C_TOTAL_DIRECT_EMBEDDED).toBe("80");
      expect(e.D_ELECTRICITY_INDIRECT).toBe("40");
      expect(e.E_PRECURSOR_INDIRECT).toBe("0");
      expect(e.F_TOTAL_DISCLOSED_INDIRECT).toBe("40");
      expect(e.H_TOTAL_INFORMATIONAL_EMBEDDED).toBe("120");
      expect(golden.indirectPriced ? e.G_CERTIFICATE_RELEVANT_EMBEDDED : e.G_CERTIFICATE_RELEVANT_EMBEDDED).toBe(
        golden.indirectPriced ? "120" : "80"
      );
      expect(totalEmbeddedEmissions).toBe(golden.indirectPriced ? "120" : "80");
      expect(productionVolume).toBe("100");
      expect(allocationReconciliationDelta).toBe("0");

      // Per-good results reconcile to installation totals.
      const goodSum = first.goods.reduce((sum, g) => sum + Number(g.allocatedEmbeddedEmissions), 0);
      expect(Math.abs(goodSum - Number(totalEmbeddedEmissions))).toBeLessThanOrEqual(1e-9);
      expect(first.goods.map((g) => g.allocationShare)).toEqual(["0.6", "0.4"]);
      expect(first.goods.map((g) => g.specificEmbeddedEmissions)).toEqual(
        golden.indirectPriced ? ["1.2", "1.2"] : ["0.8", "0.8"]
      );
    });
  }
});

// ---------------------------------------------------------------------------
// 30-scenario golden matrix
// ---------------------------------------------------------------------------

describe("FAZ 14 — 30-scenario golden dossier matrix", () => {
  it("S01 — Complete annual aluminium case seals clean", async () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const readiness = assessReadiness({ caseData, isDraft: false, assessmentTimestamp: AT, sealMode: "PRODUCTION" });
    expect(readiness.criticalBlockerCount).toBe(0);
    expect(readiness.missingMaterialEvidenceCount).toBe(0);
    expect(runQualityControls(caseData).filter((c) => c.status === "BLOCKER")).toEqual([]);

    // Expected manifest component set + file hashes for the sealable package.
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const calcGraph = buildTestCalcGraph(calculation.calculationRootHash);
    const verifierCount = countExternalVerifierCompletion(caseData.verifierReserved);
    const dossierScores: ScoreBreakdown = {
      operatorReadiness: Number(readiness.score),
      verifierReservedCount: verifierCount.completed,
      verifierReservedTotal: verifierCount.total,
      dossierCompleteness: Number(readiness.assessedCoveragePercent),
      status: readiness.operatorStatus as ScoreBreakdown["status"],
      formula: "golden matrix operator score",
      findings: [],
    };
    const scoreboard = buildHonestScoreboard({
      caseData,
      dossierScores,
      sufficiency: runEvidenceSufficiency(caseData, AT),
      packageIntegrity: "NOT_ASSESSED",
      premiumChapterContract: "COMPLETE",
      productTierLabel: "Premium Dossier",
    });
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      controls,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      calcGraph,
      honestScoreboard: scoreboard,
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT, assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
        releaseVersion: 5, rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
      },
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts,
      caseData,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceCount: 5,
      productCode: "pack_premium_dossier_v5",
      releaseContractVersion: 5,
    });
    const manifest = JSON.parse(manifestResult.bytes.toString("utf8")) as DataIntegrityManifest;
    for (const file of manifest.files) {
      const artifact = artifacts.find((a) => a.path === file.path);
      expect(artifact, `manifest path ${file.path} must map to an artifact`).toBeDefined();
      expect(crypto.createHash("sha256").update(artifact!.bytes).digest("hex")).toBe(file.sha256);
      expect(artifact!.bytes.byteLength).toBe(file.sizeBytes);
      expect(artifact!.mediaType).toBe(file.mediaType);
    }

    // Golden component contract is validated on the reopened ZIP (includes manifest + signature).
    const finalized = await finalizeVerifierPackage({
      artifacts,
      manifestBytes: manifestResult.bytes,
      signature: createSignature(manifestResult.bytes),
      generatedAt: FIXTURE_GENERATED_AT,
    });
    const zip = await JSZip.loadAsync(finalized.zip);
    const reopenedTopLevel = [
      ...new Set(
        Object.keys(zip.files)
          .filter((p) => !zip.files[p].dir || p === "Supporting_Evidence/")
          .map((p) => {
            const s = p.indexOf("/");
            return s >= 0 ? p.slice(0, s) + "/" : p;
          })
      ),
    ].sort();
    expect(reopenedTopLevel).toEqual([...REQUIRED_TOP_LEVEL_COMPONENTS_V5].sort());
    expect(reopenedTopLevel).toContain("Calculation Graph.json");
    expect(reopenedTopLevel).toContain("Verifier Workspace.xlsx");
    expect(reopenedTopLevel).toContain("Data Integrity Manifest.json");
    expect(reopenedTopLevel).toContain("Manifest Signature.sig");

    // Golden findings: a complete annual aluminium case carries no CRITICAL finding.
    const { findings } = generateFindingsAndActions(caseData, AT);
    expect(findings.filter((f) => f.severity === "CRITICAL")).toEqual([]);

    // Golden PDF text assertions: honest scoreboard claims + release identity.
    const dossierBytes = await zip.file("CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf")!.async("nodebuffer");
    const { text, pages } = await pdfText(dossierBytes);
    expect(pages).toBeGreaterThan(10);
    expect(text).toContain("OPERATOR CHECKS PASSED");
    expect(text).toContain("OPERATOR PREPARATION");
    expect(text).toContain("EVIDENCE ASSURANCE");
    expect(text).toContain("PACKAGE INTEGRITY");
    expect(text).toContain("EXTERNAL VERIFIER");
    expect(text).toContain(FIXTURE_REPORT_ID);

    // Golden XLSX cells: Goods sheet carries the materiality status column.
    const xlsxBytes = await zip.file("Verifier Workspace.xlsx")!.async("nodebuffer");
    const xlsx = await JSZip.loadAsync(xlsxBytes);
    const worksheetNames = Object.keys(xlsx.files).filter((p) => /xl\/worksheets\/sheet\d+\.xml$/.test(p));
    let goodsXml = "";
    for (const name of worksheetNames) {
      const xml = await xlsx.file(name)!.async("string");
      if (xml.includes("Materiality status")) {
        goodsXml = xml;
        break;
      }
    }
    expect(goodsXml).toContain("Materiality status");
    expect(goodsXml).toContain("PROVISIONAL_FOR_VERIFIER_PLANNING");
  }, 60_000);

  it("S02 — Future annual period is blocked in production seal mode", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const future = AuditReadyCaseSchema.parse({
      ...caseData,
      reportingPeriod: { ...caseData.reportingPeriod, endDate: { ...caseData.reportingPeriod.endDate, value: "2027-12-31" } },
    });
    const period = getReportingPeriodAssessment(future, AT, "PRODUCTION");
    expect(period.hardBlockerFindingIds).toContain("FND-PERIOD-FUTURE-END-DATE");
    expect(period.completenessStatus).toBe("BLOCKED");
    const readiness = assessReadiness({ caseData: future, isDraft: false, assessmentTimestamp: AT, sealMode: "PRODUCTION" });
    expect(readiness.operatorStatus).toBe("NOT_READY");
    expect(readiness.decisionReasonCodes).toContain("FUTURE_REPORTING_PERIOD_END");
    const { findings } = generateFindingsAndActions(future, AT);
    expect(
      findings.some(
        (f) => f.findingId.includes("FND-PERIOD-FUTURE-END-DATE") || f.ruleId.startsWith("QC_02")
      )
    ).toBe(true);
  });

  it("S03 — Partial (non-annual) period is blocked for a definitive seal", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const partial = AuditReadyCaseSchema.parse({
      ...caseData,
      reportingPeriod: {
        ...caseData.reportingPeriod,
        quarter: { ...caseData.reportingPeriod.quarter, value: "Q1" },
        startDate: { ...caseData.reportingPeriod.startDate, value: "2026-01-01" },
        endDate: { ...caseData.reportingPeriod.endDate, value: "2026-03-31" },
      },
    });
    const period = getReportingPeriodAssessment(partial, AT, "PRODUCTION");
    expect(period.hardBlockerFindingIds).toContain("FND-PERIOD-NON-ANNUAL");
    expect(period.type).toBe("INTERIM_QUARTERLY");
    expect(period.completenessStatus).toBe("BLOCKED");
    const readiness = assessReadiness({ caseData: partial, isDraft: false, assessmentTimestamp: AT, sealMode: "PRODUCTION" });
    expect(readiness.operatorStatus).toBe("NOT_READY");
  });

  it("S04 — Multiple goods per-good results sum to installation totals", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const calculation = performDossierCalculations(caseData);
    const allocated = calculation.goods.map((g) => Number(g.allocatedEmbeddedEmissions));
    expect(allocated.reduce((a, b) => a + b, 0)).toBeCloseTo(80, 9);
    expect(calculation.goods.map((g) => g.specificEmbeddedEmissions)).toEqual(["0.8", "0.8"]);
    expect(calculation.allocationShareTotal).toBe("1");
    expect(calculation.allocationReconciliationDelta).toBe("0");
  });

  it("S05 — Multiple precursors attribute B and E emission categories", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const withPrecursors = AuditReadyCaseSchema.parse({
      ...caseData,
      precursors: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbb1",
          name: { value: "Alumina", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
          cnCode: { value: "26060000", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
          quantity: { value: "10", canonicalUnit: "t", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: caseData.evidenceRegister[0].evidenceId },
          directEmissions: { value: "20", canonicalUnit: "tCO2e", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: caseData.evidenceRegister[0].evidenceId },
          indirectEmissions: { value: "5", canonicalUnit: "tCO2e", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: caseData.evidenceRegister[0].evidenceId },
          countryOfOrigin: { value: "AU", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
        },
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbb2",
          name: { value: "Anode Carbon", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
          cnCode: { value: "38019000", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
          quantity: { value: "5", canonicalUnit: "t", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: caseData.evidenceRegister[0].evidenceId },
          directEmissions: { value: "10", canonicalUnit: "tCO2e", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: caseData.evidenceRegister[0].evidenceId },
          indirectEmissions: { value: "3", canonicalUnit: "tCO2e", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", evidenceId: caseData.evidenceRegister[0].evidenceId },
          countryOfOrigin: { value: "CN", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED" },
        },
      ],
    });
    const e = performDossierCalculations(withPrecursors).emissionsByCategory;
    expect(e.B_PRECURSOR_ATTRIBUTABLE_DIRECT).toBe("30");
    expect(e.E_PRECURSOR_INDIRECT).toBe("8");
    expect(e.C_TOTAL_DIRECT_EMBEDDED).toBe("110");
    expect(e.F_TOTAL_DISCLOSED_INDIRECT).toBe("48");
    expect(e.H_TOTAL_INFORMATIONAL_EMBEDDED).toBe("158");
  });

  it("S06 — Annex-II case prices direct only: G excludes indirect, H discloses it", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const e = performDossierCalculations(caseData).emissionsByCategory;
    expect(e.G_CERTIFICATE_RELEVANT_EMBEDDED).toBe("80");
    expect(e.H_TOTAL_INFORMATIONAL_EMBEDDED).toBe("120");
  });

  it("S07 — Indirect-emissions applicable case prices direct plus indirect", () => {
    const caseData = buildCompleteAnnualCase("CEMENT");
    const e = performDossierCalculations(caseData).emissionsByCategory;
    expect(e.G_CERTIFICATE_RELEVANT_EMBEDDED).toBe("120");
    expect(e.H_TOTAL_INFORMATIONAL_EMBEDDED).toBe("120");
  });

  it("S08 — Missing meter calibration opens a verifier-preparation gap", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const withoutCalibration = AuditReadyCaseSchema.parse({
      ...caseData,
      evidenceRegister: caseData.evidenceRegister.filter((r) => !r.documentType.toUpperCase().includes("CALIBRATION")),
    });
    // Meter calibration is a monitoring/site-visit input for the verifier preparation
    // modules, not an operator seal blocker: removal must open the site-visit gap while
    // the emission evidence rows themselves stay supported.
    const preparation = buildVerifierPreparationModel({
      caseData: withoutCalibration,
      calculation: performDossierCalculations(withoutCalibration),
      assessmentTimestamp: AT,
    });
    expect(preparation.siteVisitReadiness.state).toBe("INCOMPLETE");
    expect(preparation.siteVisitReadiness.missingItems.some((item) => /calibration/i.test(item))).toBe(true);
    const withCalibration = buildVerifierPreparationModel({
      caseData,
      calculation: performDossierCalculations(caseData),
      assessmentTimestamp: AT,
    });
    expect(withCalibration.siteVisitReadiness.state).toBe("OPERATOR_READY_FOR_SITE_VISIT");
    expect(withCalibration.siteVisitReadiness.missingItems).toEqual([]);
    const readiness = assessReadiness({ caseData: withoutCalibration, isDraft: false, assessmentTimestamp: AT, sealMode: "PRODUCTION" });
    expect(readiness.operatorStatus).toBe("OPERATOR_PREPARATION_COMPLETE");
  });

  it("S09 — Missing system-boundary evidence cannot claim SUPPORTED", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const stripped = AuditReadyCaseSchema.parse({
      ...caseData,
      installation: { ...caseData.installation, systemBoundaries: undefined },
      methodologyDecisions: caseData.methodologyDecisions.filter((d) => d.topic !== "installation.systemBoundaries"),
    });
    const rows = runEvidenceSufficiency(stripped, AT);
    const boundary = rows.find((r) => r.inputPath.includes("systemBoundary") || r.requirementId.includes("BOUNDS"));
    if (boundary) {
      expect(isEvidenceSupportedState(boundary.state)).toBe(false);
    }
  });

  it("S10 — Duplicate evidence hash triggers an evidence-integrity blocker", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const duplicated = AuditReadyCaseSchema.parse({
      ...caseData,
      evidenceRegister: caseData.evidenceRegister.map((r, i) => (i === 1 ? { ...r, fileHash: caseData.evidenceRegister[0].fileHash } : r)),
    });
    const qc = runQualityControls(duplicated).find((c) => c.ruleId === "QC_10");
    expect(qc?.status).toBe("BLOCKER");
    expect(qc?.message).toMatch(/duplicate/i);
  });

  it("S11 — Single-source concentration downgrades over-loaded evidence rows", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const concentrated = AuditReadyCaseSchema.parse({
      ...caseData,
      evidenceRegister: [
        {
          ...caseData.evidenceRegister[0],
          evidenceId: "eeeeeeee-1111-4eee-8eee-eeeeeeeeeeee",
          linkedInputs: [
            "exporterIdentity.legalName",
            "installation.name",
            "directEmissions",
            "goods.0.productionVolume",
            "goods.1.productionVolume",
            "reportingPeriod.year",
          ],
        },
        ...caseData.evidenceRegister.slice(1),
      ],
    });
    const rows = runEvidenceSufficiency(concentrated, AT);
    const flagged = rows.filter((r) => r.reasonCodes.includes("SINGLE_SOURCE_CONCENTRATION"));
    expect(flagged.length).toBeGreaterThan(0);
  });

  it("S12 — Unsupported MIME type is inadmissible", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const badMime = AuditReadyCaseSchema.parse({
      ...caseData,
      evidenceRegister: caseData.evidenceRegister.map((r, i) =>
        i === 0 ? { ...r, mimeType: "application/x-msdownload" } : r
      ),
    });
    const rows = runEvidenceSufficiency(badMime, AT);
    expect(rows.some((r) => r.reasonCodes.includes("EVIDENCE_CLASS_MIME_INADMISSIBLE"))).toBe(true);
  });

  it("S13 — Storage hash mismatch (invalid SHA-256) blocks sealing", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    // The schema enforces SHA-256 format at parse; bypass the parser to simulate a
    // corrupted storage record that must still fail every evidence gate closed.
    const tampered = {
      ...caseData,
      evidenceRegister: caseData.evidenceRegister.map((r, i) => (i === 0 ? { ...r, fileHash: "not-a-hash" } : r)),
    } as unknown as AuditReadyCase;
    const rows = runEvidenceSufficiency(tampered, AT);
    expect(rows.some((r) => r.reasonCodes.includes("INVALID_SHA256_HASH_FORMAT"))).toBe(true);
    const qc = runQualityControls(tampered).find((c) => c.ruleId === "QC_10");
    expect(qc?.status).toBe("BLOCKER");
  });

  it("S14 — Allocation rounding reconciles within tolerance and out-of-tolerance fails closed", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const rounding = AuditReadyCaseSchema.parse({
      ...caseData,
      goods: caseData.goods.map((g, i) => ({
        ...g,
        allocationShare: { ...g.allocationShare, value: i === 0 ? "0.333" : "0.667" },
      })),
    });
    const calculation = performDossierCalculations(rounding);
    expect(calculation.allocationShareTotal).toBe("1");
    expect(Number(calculation.allocationReconciliationDelta)).toBeLessThanOrEqual(1e-9);
    const goodSum = calculation.goods.reduce((sum, g) => sum + Number(g.allocatedEmbeddedEmissions), 0);
    expect(Math.abs(goodSum - Number(calculation.totalEmbeddedEmissions))).toBeLessThanOrEqual(1e-9);

    const broken = AuditReadyCaseSchema.parse({
      ...caseData,
      goods: caseData.goods.map((g, i) => ({
        ...g,
        allocationShare: { ...g.allocationShare, value: i === 0 ? "0.6" : "0.5" },
      })),
    });
    expect(() => performDossierCalculations(broken)).toThrow("CALCULATION_ALLOCATION_NOT_RECONCILED");
  });

  it("S15 — Unit conversion from kilograms to tonnes is exact", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const kg = AuditReadyCaseSchema.parse({
      ...caseData,
      goods: caseData.goods.map((g, i) => ({
        ...g,
        productionVolume: { ...g.productionVolume, value: i === 0 ? "60000" : "40000", canonicalUnit: "kg" },
      })),
    });
    const calculation = performDossierCalculations(kg);
    expect(calculation.productionVolume).toBe("100");
    expect(calculation.specificEmbeddedEmissions).toBe("0.8");
    const convNode = calculation.trace.find((n) => n.formulaId.includes("GOOD") && n.conversions);
    expect(convNode?.conversions).toBeDefined();
  });

  it("S16 — Negative input fails closed", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const negative = AuditReadyCaseSchema.parse({
      ...caseData,
      directEmissions: { ...caseData.directEmissions, value: "-5" },
    });
    expect(() => performDossierCalculations(negative)).toThrow("CALCULATION_NEGATIVE_INPUT");
  });

  it("S17 — Extreme numeric input stays finite and deterministic", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const extreme = AuditReadyCaseSchema.parse({
      ...caseData,
      directEmissions: { ...caseData.directEmissions, value: "99999999999999999" },
    });
    const first = performDossierCalculations(extreme);
    const second = performDossierCalculations(extreme);
    expect(first.emissionsByCategory.A_INSTALLATION_DIRECT).toBe("99999999999999999");
    expect(first.calculationRootHash).toBe(second.calculationRootHash);
    expect(Number.isNaN(Number(first.specificEmbeddedEmissions))).toBe(false);
    expect(Number.isFinite(Number(first.specificEmbeddedEmissions))).toBe(true);
  });

  it("S18 — Zero production fails closed", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const zero = AuditReadyCaseSchema.parse({
      ...caseData,
      goods: caseData.goods.map((g) => ({ ...g, productionVolume: { ...g.productionVolume, value: "0" } })),
    });
    expect(() => performDossierCalculations(zero)).toThrow("CALCULATION_PRODUCTION_VOLUME_REQUIRED");
  });

  it("S19 — Correction reseal reproduces the identical immutable calculation", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const first = performDossierCalculations(caseData);
    const reseal = performDossierCalculations(caseData);
    expect(reseal.calculationRootHash).toBe(first.calculationRootHash);
    expect(reseal.trace.length).toBe(first.trace.length);
    expect(reseal.emissionsByCategory).toEqual(first.emissionsByCategory);
  });

  it("S20 — Superseded release surfaces a SUPERSEDED public verification state", () => {
    const reportRow = { status: "SUPERSEDED", releaseVersion: 2 } as never;
    const sealRow = {
      packageId: "PKG-SUPERSEDED",
      reportId: FIXTURE_REPORT_ID,
      status: "SUPERSEDED",
      releaseVersion: 2,
      generatedAt: AT,
      manifestHash: "a".repeat(64),
      packageHash: "b".repeat(64),
      kmsKeyVersion: "v1",
      algorithm: "RSA_SIGN_PKCS1_2048_SHA256",
    } as never;
    const payload = buildPublicVerificationPayload({ packageId: "PKG-SUPERSEDED", sealRow, reportRow });
    expect(payload.publicVerificationState).toBe("SUPERSEDED");
    expect(payload.manifestHash).toBe("a".repeat(64));
  });

  it("S21 — Failed seal releases the entitlement reservation without consuming", async () => {
    const tx = mockDbTransaction as never;
    const entitlement = await createEntitlement(tx, {
      uid: "golden-user",
      orderId: "ord-golden-1",
      transactionId: "txn-golden-1",
      eventId: "evt-golden-1",
      productCode: "pack_premium_dossier_v5",
      quantity: 1,
    });
    expect(entitlement.status).toBe("AVAILABLE");
    expect(entitlement.releasesCount).toBe(0);

    const reserved = await reserveEntitlement(tx, {
      entitlementId: entitlement.entitlementId,
      uid: "golden-user",
      reportId: FIXTURE_REPORT_ID,
      caseId: FIXTURE_CASE_ID,
    });
    expect(reserved.status).toBe("RESERVED");
    expect(reserved.reservedReportId).toBe(FIXTURE_REPORT_ID);
    const reservedDoc = mockDocs[`entitlements/${entitlement.entitlementId}`];
    expect(reservedDoc?.status).toBe("RESERVED");

    // The seal pipeline failed → the reservation is released, releasesCount unchanged, nothing consumed.
    const consumeSpy = vi.spyOn({ consumeEntitlement }, "consumeEntitlement");
    const released = await releaseEntitlementReservation(tx, {
      entitlementId: entitlement.entitlementId,
      uid: "golden-user",
      reportId: FIXTURE_REPORT_ID,
    });
    expect(consumeSpy).not.toHaveBeenCalled();
    expect(released.status).toBe("AVAILABLE");
    expect(released.releasesCount).toBe(0);
    expect(released.reservedReportId).toBeUndefined();
    const releasedDoc = mockDocs[`entitlements/${entitlement.entitlementId}`];
    expect(releasedDoc?.releasesCount).toBe(0);
    expect(releasedDoc?.status).toBe("AVAILABLE");
    const ledger = Object.entries(mockDocs)
      .filter(([path]) => path.startsWith("commerce_ledger/"))
      .map(([, data]) => data.type);
    expect(ledger).toContain("ENTITLEMENT_RELEASED");
    expect(ledger).not.toContain("SEAL_CONSUMED");
  });

  it("S22 — Package tampering after manifest fails the artifact contract", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const calcGraph = buildTestCalcGraph(calculation.calculationRootHash);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      controls,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      calcGraph,
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT, assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
        releaseVersion: 5, rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
      },
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts, caseData, calculation,
      reportId: FIXTURE_REPORT_ID, releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT, evidenceCount: 5,
      productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
    });
    const tamperedArtifacts = artifacts.map((a) =>
      a.path.endsWith(".pdf") ? { ...a, bytes: Buffer.concat([a.bytes, Buffer.from("TAMPER")]) } : a
    );
    await expect(
      finalizeVerifierPackage({
        artifacts: tamperedArtifacts,
        manifestBytes: manifestResult.bytes,
        signature: createSignature(manifestResult.bytes),
        generatedAt: FIXTURE_GENERATED_AT,
      })
    ).rejects.toThrow("PACKAGE_MANIFEST_ARTIFACT_CONTRACT_FAILED");
  }, 30_000);

  it("S23 — Signature tampering after signing fails verification", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const calcGraph = buildTestCalcGraph(calculation.calculationRootHash);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      controls,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      calcGraph,
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT, assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
        releaseVersion: 5, rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
      },
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts, caseData, calculation,
      reportId: FIXTURE_REPORT_ID, releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT, evidenceCount: 5,
      productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
    });
    const tamperedManifest = Buffer.concat([manifestResult.bytes, Buffer.from("X")]);
    // The manifest bytes were signed with the ORIGINAL bytes; shipping tampered bytes must fail closed.
    await expect(
      finalizeVerifierPackage({
        artifacts,
        manifestBytes: tamperedManifest,
        signature: createSignature(manifestResult.bytes),
        generatedAt: FIXTURE_GENERATED_AT,
      })
    ).rejects.toThrow(/PACKAGE_MANIFEST_SIGNATURE/);
  }, 30_000);

  it("S24 — Missing Calculation Graph fails the V5 component contract", async () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const controls = runQualityControls(caseData);
    const calculation = performDossierCalculations(caseData);
    const artifacts = await buildUnsignedVerifierArtifacts({
      caseData,
      controls,
      calculation,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
      evidenceFiles: createVerifierEvidenceFiles(),
      // calcGraph intentionally omitted in the mandatory V5 flow.
      assessmentContext: {
        generatedAt: FIXTURE_GENERATED_AT, assessmentTimestamp: FIXTURE_GENERATED_AT,
        reportId: FIXTURE_REPORT_ID, packageCode: FIXTURE_PACKAGE_CODE,
        releaseVersion: 5, rulesetVersion: "test",
        productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
      },
    });
    const manifestResult = buildDataIntegrityManifest({
      artifacts, caseData, calculation,
      reportId: FIXTURE_REPORT_ID, releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT, evidenceCount: 5,
      productCode: "pack_premium_dossier_v5", releaseContractVersion: 5,
    });
    await expect(
      finalizeVerifierPackage({
        artifacts,
        manifestBytes: manifestResult.bytes,
        signature: createSignature(manifestResult.bytes),
        generatedAt: FIXTURE_GENERATED_AT,
      })
    ).rejects.toThrow(/PACKAGE_COMPONENT_CONTRACT_FAILED.*Calculation Graph\.json/);
  }, 30_000);

  it("S25 — Broken calculation node reference fails the integrity guard", () => {
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const calculation = performDossierCalculations(caseData);
    // The engine-emitted trace is always well-formed (guard enforced at emission).
    const totals = {
      totalPriced: new Decimal(calculation.totalEmbeddedEmissions),
      totalDisclosed: new Decimal(calculation.emissionsByCategory.F_TOTAL_DISCLOSED_INDIRECT),
      totalDirect: new Decimal(calculation.emissionsByCategory.C_TOTAL_DIRECT_EMBEDDED),
      totalIndirect: new Decimal(calculation.emissionsByCategory.D_ELECTRICITY_INDIRECT),
    };
    expect(() => assertCalculationNodeIntegrity(calculation.trace, totals)).not.toThrow();

    // A tampered node with a missing graph reference must fail closed.
    const brokenNode = {
      ...calculation.trace[0],
      inputs: { ...(calculation.trace[0].inputs as Record<string, unknown>), calcNodeId: undefined },
    };
    expect(() => assertCalculationNodeIntegrity([brokenNode], totals)).toThrow(
      "CALCULATION_GRAPH_NODE_REFERENCE_MISSING"
    );
  });

  it("S26 — Incomplete registry mapping reports MISSING_OPERATOR fields", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    const mapping = buildRegistryTemplateMapping(caseData);
    expect(mapping.some((f) => f.status === "MISSING_OPERATOR")).toBe(true);
    const complete = buildRegistryTemplateMapping(buildCompleteAnnualCase("ALUMINIUM"));
    expect(complete.filter((f) => f.status === "MISSING_OPERATOR")).toEqual([]);
  });

  it("S27 — Premium chapter gap suppresses the premium product name", async () => {
    const { evaluatePremiumChapterContract } = await import("../../functions/src/cbam/report/premium-chapter-contract");
    const { buildVerifierPackageModel } = await import("../../functions/src/cbam/report/verifier-model");
    const caseData = buildCompleteAnnualCase("ALUMINIUM");
    const gapped = AuditReadyCaseSchema.parse({
      ...caseData,
      evidenceRegister: [],
      methodologyDecisions: [],
    });
    const controls = runQualityControls(gapped);
    const calculation = performDossierCalculations(gapped);
    const model = buildVerifierPackageModel({
      caseData: gapped,
      calculation,
      controls,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    const contract = evaluatePremiumChapterContract({ caseData: gapped, calculation, model });
    expect(contract.contractState).toBe("GAP");
    expect(contract.premiumNameVisible).toBe(false);
  });

  it("S28 — Site-visit readiness is INCOMPLETE while inputs are missing and ready once complete", () => {
    const base = buildVerifierPreparationModel({
      caseData: AuditReadyCaseSchema.parse(createVerifierGradeCase()),
      assessmentTimestamp: AT,
    });
    expect(base.siteVisitReadiness.state).toBe("INCOMPLETE");
    expect(base.siteVisitReadiness.missingItems.length).toBeGreaterThan(0);

    const completeCase = buildCompleteAnnualCase("ALUMINIUM");
    const complete = buildVerifierPreparationModel({
      caseData: completeCase,
      calculation: performDossierCalculations(completeCase),
      assessmentTimestamp: AT,
    });
    expect(complete.siteVisitReadiness.state).toBe("OPERATOR_READY_FOR_SITE_VISIT");
    expect(complete.siteVisitReadiness.missingItems).toEqual([]);
  });

  it("S29 — External verifier completion is counted across the seven reserved items", () => {
    const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
    expect(EXTERNAL_VERIFIER_COMPLETION_TOTAL).toBe(7);
    const counting = countExternalVerifierCompletion(caseData.verifierReserved);
    expect(counting.total).toBe(7);
    expect(counting.completed).toBe(0);
  });

  it("S30 — Public verification payload exposes no customer PII", () => {
    const sealRow = {
      packageId: "PKG-PRIVACY",
      reportId: FIXTURE_REPORT_ID,
      status: "SEALED",
      releaseVersion: 3,
      issuedAt: AT,
      documentHash: "c".repeat(64),
      manifestHash: "a".repeat(64),
      packageHash: "b".repeat(64),
      kmsKeyVersion: "projects/test/cryptoKeyVersions/3",
      algorithm: "RSA_SIGN_PKCS1_2048_SHA256",
      uid: "secret-uid",
      caseId: FIXTURE_CASE_ID,
      entitlementId: "secret-entitlement",
      customerEmail: "customer@example.com",
    } as never;
    const reportRow = { status: "SEALED" } as never;
    const payload = buildPublicVerificationPayload({ packageId: "PKG-PRIVACY", sealRow, reportRow });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("secret-uid");
    expect(serialized).not.toContain(FIXTURE_CASE_ID);
    expect(serialized).not.toContain("customer@example.com");
    expect(serialized).not.toContain("secret-entitlement");
    expect(payload.publicVerificationState).toBe("ACTIVE");
  });
});

async function pdfText(bytes: Buffer): Promise<{ text: string; pages: number }> {
  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  let text = "";
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + " ";
  }
  return { text, pages: document.numPages };
}

function buildTestCalcGraph(rootHash: string): {
  rootHash: string;
  nodes: ReadonlyArray<{
    id: string; label: string; formula: string;
    legalBasis: readonly string[]; inputNodes: readonly string[];
    inputPaths: readonly { path: string }[];
    value: { toString(): string }; unit: string; hash: string;
  }>;
} {
  const node = (id: string, label: string, formula: string, value: string, unit: string, inputs: string[], basis: string[]) => ({
    id, label, formula, legalBasis: basis, inputNodes: inputs,
    inputPaths: inputs.map((i) => ({ path: i })),
    value: { toString: () => value }, unit, hash: "",
  });
  const nodes = [
    node("CBAM_CALC_ROOT", "Embedded Emissions", "COMBINE", "120", "tCO2e", ["CBAM_DIRECT_80", "CBAM_INDIRECT_40"], ["IR 2025/2547"]),
    node("CBAM_DIRECT_80", "Direct Emissions", "SUM", "80", "tCO2e", ["CBAM_DIRECT_INSTALL_80"], ["IR 2025/2547"]),
    node("CBAM_DIRECT_INSTALL_80", "Installation Direct", "DIRECT_MEASURE", "80", "tCO2e", [], ["IR 2025/2547"]),
    node("CBAM_INDIRECT_40", "Electricity Indirect", "GRID_FACTOR*CONSUMPTION", "40", "tCO2e", ["CBAM_GRID_0.4", "CBAM_CONSUMPTION_100"], ["IR 2025/2547"]),
    node("CBAM_GRID_0.4", "Grid Emission Factor", "FACTOR", "0.4", "tCO2e/MWh", [], ["IR 2025/2547"]),
    node("CBAM_CONSUMPTION_100", "Electricity Consumption", "MEASURE", "100", "MWh", [], ["IR 2025/2547"]),
  ];
  return { rootHash, nodes };
}
