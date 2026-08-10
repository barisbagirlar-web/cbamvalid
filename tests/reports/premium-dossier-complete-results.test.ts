import { describe, expect, it } from "vitest";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../functions/src/cbam/calculator";
import { runQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import { buildUnsignedVerifierArtifacts } from "../../functions/src/cbam/report/verifier-package-builder";
import { upgradeArtifactsToEnterprise1000 } from "../../functions/src/cbam/report/enterprise-1000-value-layer";
import { createVerifierEvidenceFiles, createVerifierGradeCase, FIXTURE_GENERATED_AT, FIXTURE_REPORT_ID, FIXTURE_PACKAGE_CODE } from "../fixtures/verifier-grade-case";
import * as clientCalendar from "../../lib/cbam/compliance-calendar";
import * as serverCalendar from "../../functions/src/cbam/compliance/compliance-calendar";

const PDF_PATH = "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf";

function buildTestCalcGraph(rootHash: string): {
  rootHash: string;
  nodes: ReadonlyArray<{ id: string; label: string; formula: string; legalBasis: readonly string[]; inputNodes: readonly string[]; inputPaths: readonly { path: string }[]; value: { toString(): string }; unit: string; hash: string }>;
} {
  const node = (id: string, label: string, formula: string, value: string, unit: string, inputs: string[], basis: string[]) => ({
    id, label, formula, legalBasis: basis, inputNodes: inputs,
    inputPaths: inputs.map((i) => ({ path: i })),
    value: { toString: () => value }, unit, hash: "",
  });
  return {
    rootHash,
    nodes: [
      node("CBAM_CALC_ROOT", "Embedded Emissions", "COMBINE", "120", "tCO2e", ["CBAM_DIRECT_80", "CBAM_INDIRECT_40"], ["IR 2025/2547"]),
      node("CBAM_DIRECT_80", "Direct Emissions", "SUM", "80", "tCO2e", ["CBAM_DIRECT_INSTALL_80"], ["IR 2025/2547"]),
      node("CBAM_INDIRECT_40", "Electricity Indirect", "GRID_FACTOR*CONSUMPTION", "40", "tCO2e", ["CBAM_GRID_0.4", "CBAM_CONSUMPTION_100"], ["IR 2025/2547"]),
      node("CBAM_GRID_0.4", "Grid Emission Factor", "FACTOR", "0.4", "tCO2e/MWh", [], ["IR 2025/2547"]),
      node("CBAM_CONSUMPTION_100", "Electricity Consumption", "MEASURE", "100", "MWh", [], ["IR 2025/2547"]),
    ],
  };
}

async function extractDossierPdfText(): Promise<string> {
  const caseData = AuditReadyCaseSchema.parse(createVerifierGradeCase());
  const firstEvId = caseData.evidenceRegister[0].evidenceId;
  const link = (field: { evidenceId?: string }, id = firstEvId) => { field.evidenceId = id; };
  link(caseData.importerIdentity.legalName);
  link(caseData.importerIdentity.eoriNumber);
  link(caseData.importerIdentity.address!);
  link(caseData.exporterIdentity.legalName);
  link(caseData.exporterIdentity.address!);
  link(caseData.installation.name);
  link(caseData.installation.country);
  link(caseData.installation.productionRoute);
  link(caseData.reportingPeriod.year);
  link(caseData.reportingPeriod.quarter);
  link(caseData.goods[0]!.cnCode);
  link(caseData.goods[0]!.allocationShare!);
  link(caseData.goods[1]!.cnCode);
  link(caseData.goods[1]!.allocationShare!);
  caseData.evidenceRegister[0].linkedInputs.push(
    "exporterIdentity.legalName", "exporterIdentity.address",
    "importerIdentity.legalName", "importerIdentity.eoriNumber",
    "installation.name", "installation.country", "installation.productionRoute",
    "reportingPeriod.year", "reportingPeriod.quarter",
    "goods.0.cnCode", "goods.0.allocationShare", "goods.1.cnCode", "goods.1.allocationShare"
  );
  caseData.reportingPeriod.quarter.value = "ANNUAL";
  caseData.reportingPeriod.startDate = { value: "2026-01-01", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
  caseData.reportingPeriod.endDate = { value: "2026-12-31", sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", documentReference: "Ref", measurementMethod: "Method", responsiblePerson: "Person" };
  caseData.evidenceRegister.forEach((e) => { e.reportingPeriod = "2026 ANNUAL"; });

  const controls = runQualityControls(caseData);
  const calculation = performDossierCalculations(caseData);
  const calcGraph = buildTestCalcGraph(calculation.calculationRootHash);
  const unsignedArtifacts = await buildUnsignedVerifierArtifacts({
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
      generatedAt: FIXTURE_GENERATED_AT,
      assessmentTimestamp: FIXTURE_GENERATED_AT,
      reportId: FIXTURE_REPORT_ID,
      packageCode: FIXTURE_PACKAGE_CODE,
      releaseVersion: 5,
      rulesetVersion: "test",
      productCode: "pack_premium_dossier_v5",
      releaseContractVersion: 5,
    },
  });

  // The production pipeline replaces every legacy PDF with the Enterprise 1000
  // document set. Asserting against the pre-upgrade intermediate artifact would
  // prove content that never reaches the sealed package, so apply the same
  // transformation the live seal path applies before reading the PDF.
  const upgraded = upgradeArtifactsToEnterprise1000({
    artifacts: unsignedArtifacts,
    caseData,
    calculation,
    controls,
    reportId: FIXTURE_REPORT_ID,
    packageCode: FIXTURE_PACKAGE_CODE,
    releaseVersion: 5,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  const pdfArtifact = upgraded.artifacts.find((a) => a.path === PDF_PATH);
  expect(pdfArtifact, `main dossier artifact ${PDF_PATH} must exist after enterprise upgrade`).toBeDefined();

  const document = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfArtifact!.bytes),
    disableFontFace: true,
    standardFontDataUrl: "node_modules/pdfjs-dist/standard_fonts/",
  }).promise;
  let text = "";
  for (let page = 1; page <= document.numPages; page += 1) {
    const content = await document.getPage(page).then((p) => p.getTextContent());
    text += content.items.map((item) => ("str" in item ? item.str : "")).join(" ") + "\n";
  }
  return text;
}

describe("premium dossier — complete results in the sealed main report", () => {
  it("renders a report contents section covering the complete result set", async () => {
    const text = (await extractDossierPdfText()).toLowerCase();
    expect(text).toContain("report contents");
    expect(text).toContain("scope and identity");
    expect(text).toContain("goods population");
    expect(text).toContain("calculation summary");
    expect(text).toContain("calculation provenance");
    expect(text).toContain("methodology decisions");
    expect(text).toContain("registry template mapping");
    expect(text).toContain("operator sign-offs");
    expect(text).toContain("verifier handover");
  });

  it("renders scope and identity with the reporting period", async () => {
    const text = (await extractDossierPdfText()).toLowerCase();
    expect(text).toContain("scope and identity");
    expect(text).toContain("importer");
    expect(text).toContain("eori");
    expect(text).toContain("exporter/operator");
    expect(text).toContain("installation");
    expect(text).toContain("reporting period");
    expect(text).toContain("2026-01-01");
    expect(text).toContain("2026-12-31");
  });

  it("renders the calculation summary with emissions metrics and units", async () => {
    const text = (await extractDossierPdfText()).toLowerCase();
    expect(text).toContain("calculation summary");
    expect(text).toContain("installation direct emissions");
    expect(text).toContain("electricity indirect emissions");
    expect(text).toContain("total embedded emissions");
    expect(text).toContain("eligible certificate reduction");
    expect(text).toContain("tco2e/t");
  });

  it("renders calculation provenance with ruleset, engine and root hash", async () => {
    const text = (await extractDossierPdfText()).toLowerCase();
    expect(text).toContain("calculation provenance");
    expect(text).toContain("ruleset");
    expect(text).toContain("engine version");
    expect(text).toContain("calculation root");
    expect(text).toContain("allocation share total");
    expect(text).toContain("allocation reconciliation delta");
  });

  it("renders the scenario analysis section with deterministic +/-10% scenarios", async () => {
    const text = (await extractDossierPdfText()).toLowerCase();
    expect(text).toContain("scenario analysis and materiality simulation");
    expect(text).toContain("grid emission factor -10%");
    expect(text).toContain("grid emission factor +10%");
    expect(text).toContain("production volume -10%");
    expect(text).toContain("production volume +10%");
    expect(text).toContain("% intensity delta");
  });

  it("renders the materiality simulation with per-good 5% proximity", async () => {
    const text = (await extractDossierPdfText()).toLowerCase();
    expect(text).toContain("materiality");
    expect(text).toContain("5% planning threshold");
    expect(text).toContain("grid utilization");
    expect(text).toContain("production utilization");
    expect(text).toContain("proximity");
  });

  it("renders the compliance calendar with the definitive-period deadline", async () => {
    const text = (await extractDossierPdfText()).toLowerCase();
    expect(text).toContain("compliance calendar");
    expect(text).toContain("first annual cbam declaration");
    expect(text).toContain("2027-09-30");
    expect(text).toContain("certificate holding check");
    expect(text).toContain("surplus certificate repurchase window opens");
    expect(text).toContain("calendar boundary");
  });

  it("renders methodology decisions and registry template mapping", async () => {
    const text = (await extractDossierPdfText()).toLowerCase();
    expect(text).toContain("methodology decisions");
    expect(text).toContain("registry template mapping");
    expect(text).toContain("selected method");
    expect(text).toContain("legal / technical basis");
  });

  it("renders operator sign-offs and the verifier handover agenda", async () => {
    const text = (await extractDossierPdfText()).toLowerCase();
    expect(text).toContain("operator sign-offs");
    expect(text).toContain("verifier handover");
    expect(text).toContain("open questions");
    expect(text).toContain("closure conditions");
  });

  it("keeps the server compliance calendar mirror in parity with the client SSOT", () => {
    expect(serverCalendar.CBAM_COMPLIANCE_MILESTONES).toEqual([...clientCalendar.CBAM_COMPLIANCE_MILESTONES]);
    expect(serverCalendar.FIRST_2026_DECLARATION_DEADLINE).toBe(clientCalendar.FIRST_2026_DECLARATION_DEADLINE);
    expect(serverCalendar.getComplianceCalendarState(new Date("2026-08-10T00:00:00Z")).firstDeclarationDeadline)
      .toBe(clientCalendar.getComplianceCalendarState(new Date("2026-08-10T00:00:00Z")).firstDeclarationDeadline);
    const server = serverCalendar.getComplianceCalendarState(new Date("2027-01-15T00:00:00Z"));
    const client = clientCalendar.getComplianceCalendarState(new Date("2027-01-15T00:00:00Z"));
    expect(server.milestones.map((m) => [m.id, m.state])).toEqual(client.milestones.map((m) => [m.id, m.state]));
  });
});
