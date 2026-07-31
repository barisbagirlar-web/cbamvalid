import JSZip from "jszip";
import type { AuditReadyCase } from "../schema";
import type { DossierCalculationResult } from "../calculator";
import type { QualityControlResult } from "../validation/quality-controls";
import { buildVerifierPackageModel, type VerifierPackageModel } from "./verifier-model";
import type { VerifierPreparationModel } from "../../dossier/40-readiness/risk-assurance";
import { generateFindingsAndActions } from "../validation/findings-engine";
import { buildVerificationCrosswalk } from "../registry/verification-template-2025-2546";
import type { SealAssessmentContext } from "./premium-dossier-schema";
import { REQUIRED_TOP_LEVEL_COMPONENTS_V5 } from "./package-components";

export type WorkbookCellValue = string | number | boolean | null | undefined;

type Cell = {
  value?: WorkbookCellValue;
  formula?: string;
  cachedValue?: WorkbookCellValue;
  style?: number;
  hyperlink?: string;
};

type Sheet = {
  name: string;
  rows: Cell[][];
  widths: number[];
  freezeRows?: number;
  autoFilter?: string;
  statusColumn?: string;
  validationRanges?: Array<{ range: string; values: string[]; prompt: string }>;
  landscape?: boolean;
};

function xml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function safeSheetName(name: string): string {
  return name.replace(/[\\/*?:[\]]/g, "_").slice(0, 31) || "Sheet";
}

function c(value: WorkbookCellValue, style = 1, hyperlink?: string): Cell {
  return { value, style, hyperlink };
}

function f(formula: string, cachedValue: WorkbookCellValue, style = 11): Cell {
  return { formula, cachedValue, style };
}

function header(values: string[]): Cell[] {
  return values.map((value) => c(value, 3));
}

function title(value: string): Cell[] {
  return [c(value, 2)];
}

function statusStyle(status: string): number {
  if (["PASS", "DOCUMENTED", "ACCEPTED", "READY_FOR_INDEPENDENT_VERIFICATION"].includes(status)) return 5;
  if (["WARNING", "IN_REVIEW", "REVIEW_REQUIRED"].includes(status)) return 6;
  if (["BLOCKER", "GAP", "REJECTED", "BLOCKED_BEFORE_INDEPENDENT_VERIFICATION"].includes(status)) return 7;
  return 1;
}

function buildSheets(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  releaseVersion: number;
  generatedAt: string;
  model: VerifierPackageModel;
  assessmentContext?: SealAssessmentContext;
}): Sheet[] {
  const { caseData, calculation, controls, reportId, releaseVersion, generatedAt, model, assessmentContext } = params;
  const qcLastRow = Math.max(2, controls.length + 1);
  const evidenceLastRow = Math.max(2, caseData.evidenceRegister.length + 1);
  const monitoringLastRow = Math.max(2, model.monitoringPlan.length + 1);
  const { findings, correctiveActions: actions } = generateFindingsAndActions(caseData);
  const crosswalkRows = buildVerificationCrosswalk(caseData);
  const evidenceMatrixRows = caseData.evidenceRegister.flatMap((item) =>
    item.linkedInputs.length > 0
      ? item.linkedInputs.map((input) => [c(item.evidenceId), c(input), c(item.fileHash), c(item.reviewStatus, statusStyle(item.reviewStatus)), c(item.supportStatus, statusStyle(item.supportStatus))])
      : [[c(item.evidenceId), c("—"), c(item.fileHash), c(item.reviewStatus, statusStyle(item.reviewStatus)), c(item.supportStatus, statusStyle(item.supportStatus))]]
  );
  const verifierReserved = caseData.verifierReserved;
  const priorReleases = assessmentContext?.previousReleases ?? [];

  return [
    {
      name: "README",
      widths: [34, 82, 28, 30],
      freezeRows: 1,
      rows: [
        title("CBAMValid — Independent Verification Preparation Workspace"),
        [c("Document classification", 4), c(model.documentClassification), c("Release", 4), c(releaseVersion, 8)],
        [c("Package ID", 4), c(model.packageCode), c("Generated", 4), c(generatedAt)],
        [c("Technical Report ID", 4), c(reportId), c("Case ID", 4), c(model.caseId)],
        [c("Ruleset", 4), c(`${model.ruleset.version} · ${model.ruleset.name}`), c("Materiality rate", 4), c(`${model.ruleset.materialityRate}% per good — PROVISIONAL_FOR_VERIFIER_PLANNING`)],
        [c("Automated readiness", 4), c(model.automatedReadiness, statusStyle(model.automatedReadiness)), c("Independent verifier status", 4), c(model.independentVerifierStatus, 6)],
        [c("Calculation root hash", 4), c(model.calculationRootHash), c("Source registry hash", 4), c(model.ruleset.sourceHash)],
        [c("Quality controls", 4), c("Calculated below"), c("Package boundary", 4), c("Sealed operator preparation")],
        [c("Passed", 4), f('COUNTIF(QUALITY_CONTROLS!C:C,"PASS")', model.qualitySummary.passed), c("Blockers", 4), f('COUNTIF(QUALITY_CONTROLS!C:C,"BLOCKER")', model.qualitySummary.blockers)],
        [c("Warnings", 4), f('COUNTIF(QUALITY_CONTROLS!C:C,"WARNING")', model.qualitySummary.warnings), c("Monitoring-plan gaps", 4), f("COUNTIF('Monitoring Plan'!C:C,\"GAP\")", model.monitoringPlan.filter((item) => item.status === "GAP").length)],
        [c("Evidence files", 4), f("COUNTA('Evidence Register'!A2:A1048576)", model.evidenceSummary.totalEvidenceFiles), c("Approved clean evidence", 4), c(model.evidenceSummary.approvedCleanEvidenceFiles, 8)],
        [c("Evidence coverage", 4), c(`${model.evidenceSummary.coverageRate}%`), c("Duplicate hashes", 4), c(model.evidenceSummary.duplicateHashCount, model.evidenceSummary.duplicateHashCount === 0 ? 5 : 7)],
        [c("Package boundary", 4), c(model.disclaimer)],
        [c("Instructions", 4), c("Review QUALITY_CONTROLS, 'Monitoring Plan', 'Evidence Register', 'Evidence Matrix', METHODS and 'Calculations'. Record independent conclusions only in VERIFIER_SIGN_OFF. Sealed sheets are protected; editable cells are limited to verifier input fields.")],
      ],
    },
    {
      name: "CASE",
      widths: [32, 88, 32, 58],
      freezeRows: 1,
      autoFilter: "A1:D11",
      rows: [
        header(["Field", "Value", "Evidence / control", "Status"]),
        [c("Case ID"), c(model.caseId), c("Immutable snapshot"), c("SEALED", 5)],
        [c("Importer"), c(model.identity.importer), c("Corporate identity"), c(model.identity.importer ? "DOCUMENTED" : "GAP", statusStyle(model.identity.importer ? "DOCUMENTED" : "GAP"))],
        [c("EORI"), c(model.identity.eori), c(caseData.importerIdentity.eoriNumber.evidenceId), c(caseData.importerIdentity.eoriNumber.evidenceId ? "DOCUMENTED" : "GAP", statusStyle(caseData.importerIdentity.eoriNumber.evidenceId ? "DOCUMENTED" : "GAP"))],
        [c("Exporter / operator"), c(model.identity.exporterOperator), c("Operator identity"), c(model.identity.exporterOperator ? "DOCUMENTED" : "GAP", statusStyle(model.identity.exporterOperator ? "DOCUMENTED" : "GAP"))],
        [c("Installation"), c(model.identity.installation), c("Installation record"), c(model.identity.installation ? "DOCUMENTED" : "GAP", statusStyle(model.identity.installation ? "DOCUMENTED" : "GAP"))],
        [c("Country"), c(model.identity.country), c("Installation record"), c(model.identity.country ? "DOCUMENTED" : "GAP", statusStyle(model.identity.country ? "DOCUMENTED" : "GAP"))],
        [c("Production route"), c(model.identity.productionRoute), c("Monitoring plan"), c(model.identity.productionRoute ? "DOCUMENTED" : "GAP", statusStyle(model.identity.productionRoute ? "DOCUMENTED" : "GAP"))],
        [c("Reporting period"), c(model.identity.reportingPeriod), c("Definitive period"), c("DOCUMENTED", 5)],
        [c("System boundary"), c(model.identity.systemBoundary), c("Monitoring plan"), c(model.identity.systemBoundary ? "DOCUMENTED" : "GAP", statusStyle(model.identity.systemBoundary ? "DOCUMENTED" : "GAP"))],
      ],
      statusColumn: "D",
    },
    {
      name: "Goods",
      widths: [9, 16, 24, 16, 12, 15, 20, 20, 17, 20, 40, 35],
      freezeRows: 1,
      autoFilter: `A1:L${Math.max(2, model.goods.length + 1)}`,
      landscape: true,
      rows: [
        header(["Index", "CN code", "Sector", "Production", "Unit", "Allocation share", "Allocated tCO2e", "Specific tCO2e/t", "Materiality %", "Materiality tCO2e/t", "Materiality status", "Trace ID"]),
        ...model.goods.map((good) => [
          c(good.goodIndex, 8), c(good.cnCode), c(good.sector), c(Number(good.productionVolume), 8), c(good.productionUnit),
          c(Number(good.allocationShare), 8), c(Number(good.allocatedEmbeddedEmissions), 8), c(Number(good.specificEmbeddedEmissions), 8),
          c(Number(good.materialityRate), 8), c(Number(good.materialityThresholdSpecific), 8),
          c(good.materialityVerifierStatus, good.materialityVerifierStatus === "VERIFIER_APPROVED" ? 5 : 6), c(good.traceCalculationId),
        ]),
      ],
    },
    {
      name: "Executive Summary",
      widths: [42, 24, 20, 70],
      freezeRows: 1,
      autoFilter: "A1:D13",
      rows: [
        header(["Metric", "Value", "Unit", "Control identity"]),
        [c("Installation direct emissions (A)"), c(Number(model.totals.installationDirectEmissions), 8), c("tCO2e"), c("CBAM_TOTAL_EMBEDDED_EMISSIONS")],
        [c("Precursor direct emissions (B)"), c(Number(model.totals.precursorDirectEmissions), 8), c("tCO2e"), c("CBAM_PRECURSOR_EMISSIONS_SUM")],
        [c("Total direct embedded emissions (C)"), c(Number(model.totals.totalDirectEmissions), 8), c("tCO2e"), c("Direct + precursor direct")],
        [c("Electricity indirect emissions (D)"), c(Number(model.totals.electricityIndirectEmissions), 8), c("tCO2e"), c("CBAM_INDIRECT_EMISSIONS")],
        [c("Precursor indirect emissions (E)"), c(Number(model.totals.precursorIndirectEmissions), 8), c("tCO2e"), c("CBAM_PRECURSOR_EMISSIONS_SUM")],
        [c("Total disclosed indirect emissions (F)"), c(Number(model.totals.totalIndirectEmissions), 8), c("tCO2e"), c("Electricity + precursor indirect")],
        [c("Certificate-relevant embedded emissions (G)"), c(Number(model.totals.totalEmbeddedEmissions), 8), c("tCO2e"), c("Annex II aware priced total")],
        [c("Total informational embedded emissions (H)"), c(Number(calculation.emissionsByCategory?.H_TOTAL_INFORMATIONAL_EMBEDDED ?? model.totals.totalEmbeddedEmissions), 8), c("tCO2e"), c("C + F disclosed total")],
        [c("Production volume"), c(Number(model.totals.productionVolume), 8), c("t"), c("Sum of good production")],
        [c("Aggregate specific embedded emissions"), c(Number(model.totals.aggregateSpecificEmbeddedEmissions), 8), c("tCO2e/t"), c("Aggregate diagnostic")],
        [c("Allocation share total"), c(Number(model.totals.allocationShareTotal), 8), c("fraction"), c("Expected 1")],
        [c("Allocation reconciliation delta"), c(Number(model.totals.allocationReconciliationDelta), 8), c("fraction"), c("Tolerance 0.000001")],
        [c("Eligible certificate reduction"), c(Number(model.totals.eligibleCertificateReduction), 8), c("certificate-equivalent"), c("Subject to evidence and applicable law")],
      ],
    },
    {
      name: "Activity Data",
      widths: [34, 20, 18, 20, 40, 30, 25],
      freezeRows: 1,
      autoFilter: "A1:G4",
      rows: [
        header(["Input", "Value", "Unit", "Source type", "Evidence ID", "Measurement method", "Responsible person"]),
        [c("Direct emissions"), c(caseData.directEmissions.value), c(caseData.directEmissions.canonicalUnit), c(caseData.directEmissions.sourceType), c(caseData.directEmissions.evidenceId), c(caseData.directEmissions.measurementMethod), c(caseData.directEmissions.responsiblePerson)],
        [c("Electricity consumed"), c(caseData.electricityConsumed.value), c(caseData.electricityConsumed.canonicalUnit), c(caseData.electricityConsumed.sourceType), c(caseData.electricityConsumed.evidenceId), c(caseData.electricityConsumed.measurementMethod), c(caseData.electricityConsumed.responsiblePerson)],
        [c("Grid emission factor"), c(caseData.gridEmissionFactor.value), c(caseData.gridEmissionFactor.canonicalUnit), c(caseData.gridEmissionFactor.sourceType), c(caseData.gridEmissionFactor.evidenceId), c(caseData.gridEmissionFactor.measurementMethod), c(caseData.gridEmissionFactor.responsiblePerson)],
      ],
    },
    {
      name: "Precursors",
      widths: [9, 28, 18, 18, 14, 18, 18, 38],
      freezeRows: 1,
      autoFilter: `A1:H${Math.max(2, caseData.precursors.length + 1)}`,
      rows: [
        header(["Index", "Name", "Country", "Quantity", "Unit", "Direct tCO2e", "Indirect tCO2e", "Evidence links"]),
        ...caseData.precursors.map((item, index) => [c(index + 1, 8), c(item.name.value), c(item.countryOfOrigin.value), c(item.quantity.value), c(item.quantity.canonicalUnit), c(item.directEmissions.value), c(item.indirectEmissions.value), c([item.quantity.evidenceId, item.directEmissions.evidenceId, item.indirectEmissions.evidenceId].filter(Boolean).join(" | "))]),
      ],
    },
    {
      name: "Evidence Register",
      widths: [38, 30, 45, 28, 16, 68, 14, 17, 20, 16, 48],
      freezeRows: 1,
      autoFilter: `A1:K${evidenceLastRow}`,
      statusColumn: "H",
      landscape: true,
      rows: [
        header(["Evidence ID", "Type", "File", "Issuer", "Issue date", "SHA-256", "Bytes", "Review", "Support", "Malware", "Linked inputs"]),
        ...caseData.evidenceRegister.map((item) => [c(item.evidenceId), c(item.documentType), c(item.fileName), c(item.issuer), c(item.issueDate), c(item.fileHash), c(item.sizeBytes, 8), c(item.reviewStatus, statusStyle(item.reviewStatus)), c(item.supportStatus, statusStyle(item.supportStatus)), c(item.malwareScanStatus, statusStyle(item.malwareScanStatus)), c(item.linkedInputs.join(" | "))]),
      ],
    },
    {
      name: "METHODS",
      widths: [38, 28, 48, 60, 68, 20, 30, 48],
      freezeRows: 1,
      autoFilter: `A1:H${Math.max(2, caseData.methodologyDecisions.length + 1)}`,
      statusColumn: "F",
      landscape: true,
      rows: [
        header(["Decision ID", "Topic", "Selected method", "Reason", "Legal / technical basis", "Review", "Ruleset", "Evidence IDs"]),
        ...caseData.methodologyDecisions.map((item) => [c(item.decisionId), c(item.topic), c(item.selectedMethod), c(item.reason), c(item.legalOrTechnicalBasis), c(item.reviewStatus, statusStyle(item.reviewStatus)), c(item.rulesetVersion), c(item.evidenceIds.join(" | "))]),
      ],
    },
    {
      name: "Monitoring Plan",
      widths: [15, 76, 18, 90],
      freezeRows: 1,
      autoFilter: `A1:D${monitoringLastRow}`,
      statusColumn: "C",
      landscape: true,
      rows: [
        header(["Requirement", "Definitive-period monitoring-plan element", "Status", "Evidence / basis"]),
        ...model.monitoringPlan.map((item) => [c(item.requirementId), c(item.requirement), c(item.status, statusStyle(item.status)), c(item.evidence)]),
      ],
    },
    {
      name: "QUALITY_CONTROLS",
      widths: [18, 48, 18, 78, 38],
      freezeRows: 1,
      autoFilter: `A1:E${qcLastRow}`,
      statusColumn: "C",
      landscape: true,
      rows: [
        header(["Rule", "Name", "Status", "Message", "Remediation"]),
        ...controls.map((item) => [c(item.ruleId), c(item.name), c(item.status, statusStyle(item.status)), c(item.message), c(item.remediationCode)]),
      ],
    },
    {
      name: "Calculations",
      widths: [40, 42, 22, 18, 68, 58],
      freezeRows: 1,
      autoFilter: `A1:F${Math.max(2, calculation.trace.length + 1)}`,
      landscape: true,
      rows: [
        header(["Calculation ID", "Formula", "Output", "Unit", "SHA-256", "Warnings / assumptions"]),
        ...calculation.trace.map((item) => [c(item.calculationId), c(item.formulaId), c(item.outputValue), c(item.outputUnit), c(item.calculationHash), c([...item.warnings, ...item.assumptions].join(" | "))]),
      ],
    },
    {
      name: "CARBON_PRICE",
      widths: [38, 18, 22, 12, 20, 58, 38, 22],
      freezeRows: 1,
      autoFilter: `A1:H${Math.max(2, caseData.carbonPriceRecords.length + 1)}`,
      landscape: true,
      rows: [
        header(["Record ID", "Amount paid", "Applicable emissions", "Currency", "Period", "Legal reference", "Payment evidence", "Eligible reduction"]),
        ...caseData.carbonPriceRecords.map((item) => [c(item.id), c(item.amountPaid), c(item.applicableEmissions), c(item.currency), c(item.paymentPeriod), c(item.legislationReference), c(item.proofOfPaymentEvidenceId), c(item.eligibleCertificateReduction)]),
      ],
    },
    {
      name: "LEGAL_SOURCES",
      widths: [20, 18, 64, 74, 16, 16, 66],
      freezeRows: 1,
      autoFilter: `A1:G${model.legalSources.length + 1}`,
      landscape: true,
      rows: [
        header(["Source ID", "CELEX", "Title", "Official EUR-Lex", "Applies from", "Status", "Methodology scope"]),
        ...model.legalSources.map((item) => [c(item.id), c(item.celexId), c(item.title), c(item.eliUri, 9, item.eliUri), c(item.appliesFrom), c(item.legalStatus, 5), c(item.methodologyScope.join(" | "))]),
      ],
    },
    {
      name: "Operator",
      widths: [42, 78, 30, 44],
      freezeRows: 1,
      rows: [
        header(["Field", "Declared value", "Source / evidence", "Status"]),
        [c("Legal name"), c(caseData.exporterIdentity.legalName.value), c(caseData.exporterIdentity.legalName.evidenceId), c(caseData.exporterIdentity.legalName.value ? "DOCUMENTED" : "GAP", statusStyle(caseData.exporterIdentity.legalName.value ? "DOCUMENTED" : "GAP"))],
        [c("Registration number"), c(caseData.exporterIdentity.registrationNumber?.value), c(caseData.exporterIdentity.registrationNumber?.evidenceId), c(caseData.exporterIdentity.registrationNumber?.value ? "DOCUMENTED" : "GAP", statusStyle(caseData.exporterIdentity.registrationNumber?.value ? "DOCUMENTED" : "GAP"))],
        [c("Full address (English)"), c(caseData.exporterIdentity.address?.value), c(caseData.exporterIdentity.address?.evidenceId), c(caseData.exporterIdentity.address?.value ? "DOCUMENTED" : "GAP", statusStyle(caseData.exporterIdentity.address?.value ? "DOCUMENTED" : "GAP"))],
        [c("Country"), c(caseData.exporterIdentity.exporterCountry?.value), c(caseData.exporterIdentity.exporterCountry?.evidenceId), c(caseData.exporterIdentity.exporterCountry?.value ? "DOCUMENTED" : "GAP", statusStyle(caseData.exporterIdentity.exporterCountry?.value ? "DOCUMENTED" : "GAP"))],
        [c("Contact person"), c(caseData.exporterIdentity.contactPerson?.value), c(""), c("")],
        [c("Role / title"), c(caseData.exporterIdentity.contactRole?.value), c(""), c("")],
        [c("Contact email"), c(caseData.exporterIdentity.contactEmail?.value), c(""), c("")],
        [c("Operator declaration"), c(caseData.exporterIdentity.operatorDeclaration?.value), c(""), c("")],
        [c("Preparer sign-off"), c(caseData.exporterIdentity.preparerSignOff?.value), c(""), c("")],
        [c("Internal reviewer sign-off"), c(caseData.exporterIdentity.internalReviewerSignOff?.value), c(""), c("")],
      ],
    },
    {
      name: "Installation",
      widths: [42, 78, 30, 44],
      freezeRows: 1,
      rows: [
        header(["Field", "Declared value", "Source / evidence", "Status"]),
        [c("Installation name"), c(caseData.installation.name.value), c(caseData.installation.name.evidenceId), c(caseData.installation.name.value ? "DOCUMENTED" : "GAP", statusStyle(caseData.installation.name.value ? "DOCUMENTED" : "GAP"))],
        [c("CBAM Registry installation ID"), c(caseData.installation.registryInstallationId?.value), c(caseData.installation.registryInstallationId?.evidenceId), c(caseData.installation.registryInstallationId?.value ? "DOCUMENTED" : "GAP", statusStyle(caseData.installation.registryInstallationId?.value ? "DOCUMENTED" : "GAP"))],
        [c("UN/LOCODE"), c(caseData.installation.unloCode?.value), c(caseData.installation.unloCode?.evidenceId), c("")],
        [c("Full address (English)"), c(caseData.installation.address?.value), c(caseData.installation.address?.evidenceId), c("")],
        [c("Latitude"), c(caseData.installation.latitude?.value), c(""), c("")],
        [c("Longitude"), c(caseData.installation.longitude?.value), c(""), c("")],
        [c("Country"), c(caseData.installation.country.value), c(caseData.installation.country.evidenceId), c(caseData.installation.country.value ? "DOCUMENTED" : "GAP", statusStyle(caseData.installation.country.value ? "DOCUMENTED" : "GAP"))],
        [c("Production route"), c(caseData.installation.productionRoute.value), c(caseData.installation.productionRoute.evidenceId), c(caseData.installation.productionRoute.value ? "DOCUMENTED" : "GAP", statusStyle(caseData.installation.productionRoute.value ? "DOCUMENTED" : "GAP"))],
        [c("System boundary"), c(caseData.installation.systemBoundaries), c(""), c(caseData.installation.systemBoundaries ? "DOCUMENTED" : "GAP", statusStyle(caseData.installation.systemBoundaries ? "DOCUMENTED" : "GAP"))],
        [c("Excluded processes"), c(caseData.installation.excludedProcesses), c(""), c("")],
        [c("Functional units"), c(caseData.installation.functionalUnits), c(""), c("")],
        [c("Installation diagram evidence"), c(caseData.installation.installationDiagramEvidenceId), c(""), c("")],
        [c("Monitoring plan ID"), c(caseData.installation.monitoringPlanId?.value), c(""), c("")],
        [c("Monitoring plan version"), c(caseData.installation.monitoringPlanVersion?.value), c(""), c("")],
        [c("Monitoring plan effective date"), c(caseData.installation.monitoringPlanEffectiveDate?.value), c(""), c("")],
      ],
    },
    {
      name: "Source Streams",
      widths: [40, 22, 20, 22, 40, 34],
      freezeRows: 1,
      autoFilter: "A1:F4",
      rows: [
        header(["Source stream", "Activity value", "Unit", "Data source", "Evidence ID", "Measurement method"]),
        [c("Direct emissions (installation scope)"), c(caseData.directEmissions.value), c(caseData.directEmissions.canonicalUnit), c(caseData.directEmissions.sourceType), c(caseData.directEmissions.evidenceId), c(caseData.directEmissions.measurementMethod)],
        [c("Electricity consumed"), c(caseData.electricityConsumed.value), c(caseData.electricityConsumed.canonicalUnit), c(caseData.electricityConsumed.sourceType), c(caseData.electricityConsumed.evidenceId), c(caseData.electricityConsumed.measurementMethod)],
        [c("Grid emission factor"), c(caseData.gridEmissionFactor.value), c(caseData.gridEmissionFactor.canonicalUnit), c(caseData.gridEmissionFactor.sourceType), c(caseData.gridEmissionFactor.evidenceId), c(caseData.gridEmissionFactor.measurementMethod)],
        ...caseData.precursors.map((item, index) => [c(`Precursor ${index + 1} — ${item.name.value}`), c(item.quantity.value), c(item.quantity.canonicalUnit), c(item.quantity.sourceType), c(item.quantity.evidenceId), c(item.quantity.measurementMethod)]),
      ],
    },
    {
      name: "Emission Sources",
      widths: [46, 22, 20, 22, 40, 34],
      freezeRows: 1,
      rows: [
        header(["Emission source", "Activity value", "Unit", "Data source", "Evidence ID", "Measurement method"]),
        [c("Installation direct emissions scope"), c(caseData.directEmissions.value), c(caseData.directEmissions.canonicalUnit), c(caseData.directEmissions.sourceType), c(caseData.directEmissions.evidenceId), c(caseData.directEmissions.measurementMethod)],
        [c("Electricity consumption (indirect)"), c(caseData.electricityConsumed.value), c(caseData.electricityConsumed.canonicalUnit), c(caseData.electricityConsumed.sourceType), c(caseData.electricityConsumed.evidenceId), c(caseData.electricityConsumed.measurementMethod)],
        [c("Precursor embedded emissions"), c(caseData.precursors.length ? "DECLARED" : "NONE DECLARED"), c("tCO2e"), c("Register"), c(caseData.precursors.map((p) => p.directEmissions.evidenceId).join(" | ")), c("")],
      ],
    },
    {
      name: "Meters",
      widths: [38, 44, 30, 20, 18, 16, 48],
      freezeRows: 1,
      autoFilter: `A1:G${Math.max(2, caseData.evidenceRegister.length + 1)}`,
      rows: [
        header(["Evidence ID", "Document", "Meter scope", "Approved", "Malware", "Bytes", "SHA-256"]),
        ...caseData.evidenceRegister.map((item) => [
          c(item.evidenceId), c(item.fileName),
          c(item.linkedInputs[0] || "installation scope"),
          c(item.reviewStatus, statusStyle(item.reviewStatus)), c(item.malwareScanStatus, statusStyle(item.malwareScanStatus)),
          c(item.sizeBytes, 8), c(String(item.fileHash).slice(0, 16)),
        ]),
      ],
    },
    {
      name: "Allocation",
      widths: [10, 16, 24, 18, 24, 24, 40],
      freezeRows: 1,
      autoFilter: `A1:G${Math.max(2, model.goods.length + 3)}`,
      rows: [
        header(["Good", "CN code", "Sector", "Share", "Allocated tCO2e", "Specific tCO2e/t", "Reconciliation"]),
        ...model.goods.map((good) => [
          c(good.goodIndex, 8), c(good.cnCode), c(good.sector), c(Number(good.allocationShare), 8),
          c(Number(good.allocatedEmbeddedEmissions), 8), c(Number(good.specificEmbeddedEmissions), 8),
          c("PART_OF_SUM", 5),
        ]),
        [c("Total", 4), c(""), c(""), f('SUM(D2:D' + (model.goods.length + 1) + ')', Number(model.totals.allocationShareTotal)), f('SUM(E2:E' + (model.goods.length + 1) + ')', Number(model.totals.totalEmbeddedEmissions)), c(""), c("RECONCILED", 5)],
        [c("Reconciliation delta", 4), c(""), c(""), c(""), c(Number(model.totals.allocationReconciliationDelta), 8), c(""), c(model.totals.allocationReconciliationDelta === "0" ? "ZERO_DELTA_PASS" : "REVIEW", 5)],
      ],
    },
    {
      name: "Evidence Matrix",
      widths: [38, 48, 68, 18, 20],
      freezeRows: 1,
      autoFilter: `A1:E${Math.max(2, evidenceMatrixRows.length + 1)}`,
      landscape: true,
      rows: [
        header(["Evidence ID", "Linked input field", "SHA-256", "Review", "Support"]),
        ...evidenceMatrixRows,
      ],
    },
    {
      name: "Misstatements",
      widths: [40, 16, 30, 56, 70, 50],
      freezeRows: 1,
      autoFilter: `A1:F${Math.max(2, findings.length + 1)}`,
      landscape: true,
      rows: [
        header(["Finding ID", "Severity", "Category", "Title", "Description", "Impact"]),
        ...findings.filter((finding) =>
          ["ALLOCATION_EXCEPTION", "PRECURSOR_EXCEPTION", "CALCULATION_EXCEPTION", "RECONCILIATION_EXCEPTION", "UNIT_MISMATCH", "PERIOD_MISMATCH", "INPUT_PLAUSIBILITY", "EVIDENCE_INTEGRITY", "REPORTING_PERIOD"].includes(finding.category)
        ).map((finding) => [
          c(finding.findingId), c(finding.severity, statusStyle(finding.severity === "CRITICAL_BLOCKER" || finding.severity === "CRITICAL" || finding.severity === "MATERIAL" ? "BLOCKER" : "WARNING")), c(finding.category),
          c(finding.title), c(finding.description), c(finding.impactStatement),
        ]),
      ],
    },
    {
      name: "Non-Conformities",
      widths: [40, 16, 30, 56, 70, 50],
      freezeRows: 1,
      autoFilter: `A1:F${Math.max(2, findings.length + 1)}`,
      landscape: true,
      rows: [
        header(["Finding ID", "Severity", "Category", "Title", "Description", "Basis"]),
        ...findings.filter((finding) =>
          ["IDENTITY_GAP", "SCOPE_GAP", "METHODOLOGY_GAP", "EVIDENCE_GAP", "DATA_QUALITY", "UNCERTAINTY", "LEGAL_SOURCE", "PACKAGE_INTEGRITY", "EXTERNAL_VERIFIER_PENDING"].includes(finding.category)
        ).map((finding) => [
          c(finding.findingId), c(finding.severity, statusStyle(finding.severity === "CRITICAL_BLOCKER" || finding.severity === "CRITICAL" || finding.severity === "MATERIAL" ? "BLOCKER" : "WARNING")), c(finding.category),
          c(finding.title), c(finding.description), c(finding.regulatoryOrTechnicalBasis),
        ]),
      ],
    },
    {
      name: "Corrective Actions",
      widths: [46, 40, 12, 78, 26, 22, 60],
      freezeRows: 1,
      autoFilter: `A1:G${Math.max(2, actions.length + 1)}`,
      landscape: true,
      rows: [
        header(["Action ID", "Finding ID", "Priority", "Required action", "Role", "State", "Closure condition"]),
        ...actions.map((action) => [
          c(action.actionId), c(action.findingId), c(action.priority, action.priority === "P0" ? 7 : 6), c(action.requiredAction),
          c(action.responsibleRole), c(action.state, statusStyle(action.state === "CLOSED" ? "PASS" : action.state === "OPEN" ? "BLOCKER" : "WARNING")),
          c(action.closureCondition),
        ]),
      ],
    },
    {
      name: "Registry Crosswalk",
      widths: [20, 22, 24, 60, 24, 48, 26, 46],
      freezeRows: 1,
      autoFilter: `A1:H${Math.max(2, crosswalkRows.length + 1)}`,
      landscape: true,
      rows: [
        header(["Requirement", "Legal source", "Legal location", "Requirement text", "Owner", "Input paths", "Status", "Reason"]),
        ...crosswalkRows.map((row) => [
          c(row.requirementId), c(row.legalSourceId), c(row.legalLocation), c(row.requirementText),
          c(row.owner), c(row.inputPaths.join(" | ")), c(row.status, statusStyle(row.status === "COMPLETE" ? "PASS" : row.status === "PARTIAL" ? "WARNING" : "GAP")),
          c(row.reasonCodes.join(" | ")),
        ]),
      ],
    },
    {
      name: "Verifier Team",
      widths: [42, 78, 42, 52],
      freezeRows: 1,
      rows: [
        header(["Team attribute", "Value", "Field", "Verifier-reserved"]),
        [c("Verifier legal name"), c(verifierReserved?.verifierLegalName), c("verifierReserved.verifierLegalName"), c(verifierReserved?.verifierLegalName ? "PENDING_EXTERNAL_VERIFIER" : "PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Verifier address"), c(verifierReserved?.verifierAddress), c("verifierReserved.verifierAddress"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Accreditation number"), c(verifierReserved?.accreditationNumber), c("verifierReserved.accreditationNumber"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("National accreditation body"), c(verifierReserved?.nationalAccreditationBody), c("verifierReserved.nationalAccreditationBody"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Accreditation country"), c(verifierReserved?.accreditationCountry), c("verifierReserved.accreditationCountry"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Accreditation expiry"), c(verifierReserved?.accreditationExpiry), c("verifierReserved.accreditationExpiry"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Accreditation scope"), c(verifierReserved?.accreditationScope), c("verifierReserved.accreditationScope"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Team leader"), c(verifierReserved?.teamLeader), c("verifierReserved.teamLeader"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("CBAM lead auditor"), c(verifierReserved?.cbamLeadAuditor), c("verifierReserved.cbamLeadAuditor"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Auditors"), c(verifierReserved?.auditors?.join(", ")), c("verifierReserved.auditors"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Technical experts"), c(verifierReserved?.technicalExperts?.join(", ")), c("verifierReserved.technicalExperts"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Independent reviewer"), c(verifierReserved?.independentReviewer), c("verifierReserved.independentReviewer"), c("PENDING_EXTERNAL_VERIFIER", 6)],
      ],
    },
    {
      name: "Site Visits",
      widths: [42, 78, 42, 52],
      freezeRows: 1,
      rows: [
        header(["Site-visit attribute", "Value", "Field", "Verifier-reserved"]),
        [c("Site visit type"), c(verifierReserved?.siteVisitType ?? "NOT_ASSIGNED"), c("verifierReserved.siteVisitType"), c(verifierReserved?.siteVisitType && verifierReserved.siteVisitType !== "NOT_ASSIGNED" ? "PENDING_EXTERNAL_VERIFIER" : "PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Site visit dates"), c(verifierReserved?.siteVisitDates), c("verifierReserved.siteVisitDates"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Days on-site"), c(verifierReserved?.daysOnSite, 8), c("verifierReserved.daysOnSite"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Virtual visit justification"), c(verifierReserved?.virtualVisitJustification), c("verifierReserved.virtualVisitJustification"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Waiver justification"), c(verifierReserved?.waiverJustification), c("verifierReserved.waiverJustification"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Verification objectives"), c(verifierReserved?.verificationObjectives), c("verifierReserved.verificationObjectives"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Verification scope"), c(verifierReserved?.verificationScope), c("verifierReserved.verificationScope"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Criteria"), c(verifierReserved?.criteria), c("verifierReserved.criteria"), c("PENDING_EXTERNAL_VERIFIER", 6)],
      ],
    },
    {
      name: "Verifier Opinion",
      widths: [42, 78, 42, 52],
      freezeRows: 1,
      rows: [
        header(["Opinion attribute", "Value", "Field", "Verifier-reserved"]),
        [c("Final opinion"), c(verifierReserved?.finalOpinion ?? "NO_OPINION"), c("verifierReserved.finalOpinion"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Signature"), c(verifierReserved?.signature), c("verifierReserved.signature"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Certificate reference"), c(verifierReserved?.certificateReference), c("verifierReserved.certificateReference"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Materiality level per good"), c(JSON.stringify(verifierReserved?.materialityLevelPerGood ?? {})), c("verifierReserved.materialityLevelPerGood"), c("PENDING_EXTERNAL_VERIFIER", 6)],
        [c("Boundary notice", 4), c("Opinion fields are reserved for the independent accredited verifier. CBAMValid never asserts them.")],
      ],
    },
    {
      name: "Version Delta",
      widths: [12, 42, 40, 56, 30, 26],
      freezeRows: 1,
      autoFilter: `A1:F${Math.max(2, priorReleases.length + 2)}`,
      rows: [
        header(["Version", "Sealed at", "Report ID", "Release reason / changes", "Author", "Status"]),
        [c(`V${releaseVersion}`, 4), c(generatedAt), c(reportId), c("This release (sealed artifact)"), c("OPERATOR_ADMIN"), c("ACTIVE_RELEASE", 5)],
        ...priorReleases.map((release) => [
          c(`V${release.version}`, 4), c(release.sealedAt), c(release.reportId),
          c(release.correctionReason || "Dossier release."), c("OPERATOR_ADMIN"), c("SUPERSEDED", 6),
        ]),
      ],
    },
    {
      name: "Manifest Index",
      widths: [110, 16, 80],
      freezeRows: 1,
      autoFilter: `A1:C${REQUIRED_TOP_LEVEL_COMPONENTS_V5.length + 1}`,
      rows: [
        header(["Component path", "Type", "Sealed-package role"]),
        ...REQUIRED_TOP_LEVEL_COMPONENTS_V5.map((component) => {
          const type = component.endsWith(".pdf") ? "PDF" : component.endsWith(".csv") ? "CSV" : component.endsWith(".json") ? "JSON" : component.endsWith(".xlsx") ? "XLSX" : component.endsWith(".sig") ? "SIG" : component.endsWith("/") ? "DIR" : "FILE";
          const role = component === "Data Integrity Manifest.json" ? "Manifest of hashes; sealed by the KMS signature" : component === "Manifest Signature.sig" ? "Detached KMS signature over the manifest" : component === "Calculation Graph.json" ? "Calculation graph nodes with hashes and root hash" : component === "Calculation Trace.json" ? "Calculation node trace with per-node hashes" : component === "Verifier Workspace.xlsx" ? "Interactive verifier navigation workbook" : "Controlled component covered by the manifest";
          return [c(component), c(type), c(role)];
        }),
      ],
    },
    ...riskMaterialitySamplingSheets(model.verifierPreparation),
    {
      name: "VERIFIER_SIGN_OFF",
      widths: [42, 70, 42, 68],
      freezeRows: 1,
      validationRanges: [
        { range: "B2", values: ["NOT_REVIEWED", "IN_REVIEW", "ACCEPTED", "REJECTED"], prompt: "Independent verifier review status" },
        { range: "B8", values: ["NO_OPINION", "SATISFACTORY", "SATISFACTORY_WITH_COMMENTS", "NOT_SATISFACTORY"], prompt: "Independent verification opinion" },
        { range: "D8", values: ["OPEN", "IN_PROGRESS", "CLOSED"], prompt: "Findings closure status" },
      ],
      rows: [
        header(["Verifier-controlled field", "Value", "Control", "Value"]),
        [c("Review status", 4), c("NOT_REVIEWED", 10), c("Package automated readiness", 4), c(model.automatedReadiness, statusStyle(model.automatedReadiness))],
        [c("Verifier legal entity", 4), c("", 10), c("Accreditation body", 4), c("", 10)],
        [c("Lead verifier", 4), c("", 10), c("Accreditation number", 4), c("", 10)],
        [c("Review start date", 4), c("", 10), c("Review completion date", 4), c("", 10)],
        [c("Physical / virtual site visit", 4), c("", 10), c("Site visit date", 4), c("", 10)],
        [c("Materiality rate", 4), c(`${model.ruleset.materialityRate}% per good (PROVISIONAL_FOR_VERIFIER_PLANNING)`), c("Reasonable assurance", 4), c("NOT_ASSESSED", 10)],
        [c("Independent opinion", 4), c("NO_OPINION", 10), c("Findings closure", 4), c("OPEN", 10)],
        [c("Verifier conclusion", 4), c("", 10), c("Verifier signature reference", 4), c("", 10)],
        [c("Boundary notice", 4), c("CBAMValid does not populate or assert verifier-controlled fields. Completion requires an independent accredited verifier.")],
      ],
    },
  ];
}

function riskStyle(level: string): number {
  if (level === "HIGH") return 7;
  if (level === "MODERATE") return 6;
  if (level === "LOW") return 5;
  return 1;
}

function riskMaterialitySamplingSheets(
  preparation: VerifierPreparationModel | null
): Sheet[] {
  const registers = [
    ...(preparation?.inherentRiskRegister ?? []),
    ...(preparation?.controlRiskRegister ?? []),
    ...(preparation?.detectionRiskAssessment ?? []),
  ];
  const riskSheet: Sheet = {
    name: "Risk Register",
    widths: [13, 16, 20, 58, 14, 12, 12, 56, 16],
    freezeRows: 1,
    autoFilter: `A1:I${Math.max(2, registers.length + 1)}`,
    statusColumn: "I",
    landscape: true,
    rows: [
      header(["Register", "Risk ID", "Data domain", "Risk description", "Likelihood", "Impact", "Combined", "Mitigating control", "State"]),
      ...registers.map((entry) => [
        c(entry.register), c(entry.riskId), c(entry.affectedDataDomain), c(entry.riskDescription),
        c(entry.likelihood, riskStyle(entry.likelihood)), c(entry.impact, riskStyle(entry.impact)),
        c(entry.combined, riskStyle(entry.combined)), c(entry.mitigatingControl), c(entry.assessmentState),
      ]),
      ...(registers.length === 0
        ? [[c("NOT_ASSESSED"), c("IR-NONE"), c("ALL"), c("No risk register derived — operator data not yet assessed", 7), c("NOT_ASSESSED"), c("NOT_ASSESSED"), c("NOT_ASSESSED"), c(""), c("NOT_ASSESSED")]]
        : []),
    ],
  };

  const workpapers = preparation?.materialityWorkpapers ?? [];
  const materialitySheet: Sheet = {
    name: "Materiality",
    widths: [10, 14, 20, 18, 22, 60, 70, 80, 38],
    freezeRows: 1,
    autoFilter: `A1:I${Math.max(2, workpapers.length + 1)}`,
    statusColumn: "I",
    landscape: true,
    rows: [
      header(["Good", "CN code", "Specific tCO2e/t", "Planning rate %", "Threshold tCO2e/t", "Regulatory basis", "Calculation basis", "Expert judgement", "Verifier status"]),
      ...workpapers.map((wp) => [
        c(wp.goodIndex, 8), c(wp.cnCode), c(Number(wp.specificEmbeddedEmissions), 8), c(Number(wp.planningThresholdRate), 8), c(Number(wp.threshold), 8),
        c(wp.regulatoryBasis), c(wp.calculationBasis), c(wp.expertJudgement),
        c(wp.verifierStatus, wp.verifierStatus === "VERIFIER_APPROVED" ? 5 : 6),
      ]),
      ...(workpapers.length === 0
        ? [[c("—"), c("—"), c("—"), c("—"), c("—"), c("Per-good materiality requires completed specific embedded emissions calculation"), c("—"), c("—"), c("NOT_ASSESSED", 10)]]
        : []),
    ],
  };

  const sampling = preparation?.samplingPopulation ?? [];
  const samplingSheet: Sheet = {
    name: "Sampling Plan",
    widths: [22, 16, 14, 60, 30, 90],
    freezeRows: 1,
    autoFilter: `A1:F${Math.max(2, sampling.length + 1)}`,
    statusColumn: "E",
    landscape: true,
    rows: [
      header(["Population domain", "Population", "Sample", "Selection method", "State", "Rationale"]),
      ...sampling.map((entry) => [
        c(entry.populationDomain), c(entry.populationSize, 8), c(entry.sampleSize, 8),
        c(entry.selectionMethod), c(entry.state, statusStyle(entry.state === "OPERATOR_PROPOSED" ? "PASS" : "GAP")), c(entry.rationale),
      ]),
      ...(sampling.length === 0
        ? [[c("ALL"), c(0, 8), c(0, 8), c("NOT_ASSESSED"), c("NOT_ASSESSED", 10), c("Sampling plan requires declared goods and evidence population")]]
        : []),
    ],
  };

  return [riskSheet, materialitySheet, samplingSheet];
}

function cellXml(cell: Cell, reference: string): string {
  const style = cell.style ?? 1;
  if (cell.formula) {
    const cached = cell.cachedValue === undefined || cell.cachedValue === null ? "" : String(cell.cachedValue);
    return `<c r="${reference}" s="${style}"><f>${xml(cell.formula)}</f><v>${xml(cached)}</v></c>`;
  }
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) {
    return `<c r="${reference}" s="${style}"><v>${cell.value}</v></c>`;
  }
  if (typeof cell.value === "boolean") {
    return `<c r="${reference}" t="b" s="${style}"><v>${cell.value ? 1 : 0}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xml(cell.value)}</t></is></c>`;
}

function sheetXml(sheet: Sheet): { xml: string; relationships?: string } {
  const hyperlinks: Array<{ reference: string; relationshipId: string; target: string }> = [];
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((cell, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      if (cell.hyperlink) hyperlinks.push({ reference, relationshipId: `rId${hyperlinks.length + 1}`, target: cell.hyperlink });
      return cellXml(cell, reference);
    }).join("");
    return `<row r="${rowIndex + 1}"${rowIndex === 0 ? ' ht="24" customHeight="1"' : ""}>${cells}</row>`;
  }).join("");

  const columns = sheet.widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const freezeRows = sheet.freezeRows || 0;
  const pane = freezeRows > 0 ? `<pane ySplit="${freezeRows}" topLeftCell="A${freezeRows + 1}" activePane="bottomLeft" state="frozen"/>` : "";
  const autoFilter = sheet.autoFilter ? `<autoFilter ref="${sheet.autoFilter}"/>` : "";
  const hyperlinkXml = hyperlinks.length > 0 ? `<hyperlinks>${hyperlinks.map((item) => `<hyperlink ref="${item.reference}" r:id="${item.relationshipId}"/>`).join("")}</hyperlinks>` : "";
  const conditionalFormatting = sheet.statusColumn ? `<conditionalFormatting sqref="${sheet.statusColumn}2:${sheet.statusColumn}1048576"><cfRule type="containsText" dxfId="0" priority="1" operator="containsText" text="PASS"><formula>NOT(ISERROR(SEARCH("PASS",${sheet.statusColumn}2)))</formula></cfRule><cfRule type="containsText" dxfId="0" priority="2" operator="containsText" text="DOCUMENTED"><formula>NOT(ISERROR(SEARCH("DOCUMENTED",${sheet.statusColumn}2)))</formula></cfRule><cfRule type="containsText" dxfId="1" priority="3" operator="containsText" text="WARNING"><formula>NOT(ISERROR(SEARCH("WARNING",${sheet.statusColumn}2)))</formula></cfRule><cfRule type="containsText" dxfId="2" priority="4" operator="containsText" text="BLOCKER"><formula>NOT(ISERROR(SEARCH("BLOCKER",${sheet.statusColumn}2)))</formula></cfRule><cfRule type="containsText" dxfId="2" priority="5" operator="containsText" text="GAP"><formula>NOT(ISERROR(SEARCH("GAP",${sheet.statusColumn}2)))</formula></cfRule></conditionalFormatting>` : "";
  const validations = sheet.validationRanges?.length ? `<dataValidations count="${sheet.validationRanges.length}">${sheet.validationRanges.map((item) => `<dataValidation type="list" allowBlank="0" showInputMessage="1" showErrorMessage="1" errorStyle="stop" sqref="${item.range}" promptTitle="Controlled value" prompt="${xml(item.prompt)}" errorTitle="Invalid controlled value" error="Select a value from the approved list."><formula1>&quot;${xml(item.values.join(","))}&quot;</formula1></dataValidation>`).join("")}</dataValidations>` : "";

  const result = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="17"/><cols>${columns}</cols><sheetData>${rows}</sheetData>${autoFilter}<sheetProtection sheet="1" objects="1" scenarios="1" selectLockedCells="1" selectUnlockedCells="1" formatCells="0" formatColumns="0" formatRows="0" insertColumns="0" insertRows="0" insertHyperlinks="0" deleteColumns="0" deleteRows="0" sort="0" autoFilter="0" pivotTables="0"/>${conditionalFormatting}${validations}${hyperlinkXml}<printOptions horizontalCentered="0" verticalCentered="0"/><pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="${sheet.landscape ? "landscape" : "portrait"}" fitToWidth="1" fitToHeight="0" paperSize="9"/></worksheet>`;
  const relationships = hyperlinks.length > 0 ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hyperlinks.map((item) => `<Relationship Id="${item.relationshipId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${xml(item.target)}" TargetMode="External"/>`).join("")}</Relationships>` : undefined;
  return { xml: result, relationships };
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="0.000000"/><numFmt numFmtId="165" formatCode="0.00%"/></numFmts><fonts count="5"><font><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Aptos Display"/></font><font><b/><color rgb="FF142A4A"/><sz val="11"/><name val="Aptos Display"/></font><font><color rgb="FF0563C1"/><u/><sz val="10"/><name val="Aptos"/></font><font><b/><color rgb="FF142A4A"/><sz val="16"/><name val="Aptos Display"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4068"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7EDF4"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDFF2E3"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF1CC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFDE2E2"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF6F8FA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD4DAE2"/></left><right style="thin"><color rgb="FFD4DAE2"/></right><top style="thin"><color rgb="FFD4DAE2"/></top><bottom style="thin"><color rgb="FFD4DAE2"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="12"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="5" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="6" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="7" borderId="1" xfId="0" applyProtection="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/><protection locked="0"/></xf><xf numFmtId="164" fontId="2" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="3"><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFDFF2E3"/></patternFill></fill></dxf><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFFFF1CC"/></patternFill></fill></dxf><dxf><fill><patternFill patternType="solid"><fgColor rgb="FFFDE2E2"/></patternFill></fill></dxf></dxfs><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
}

export async function buildVerifierWorkbook(params: {
  caseData: AuditReadyCase;
  calculation: DossierCalculationResult;
  controls: QualityControlResult[];
  reportId: string;
  packageCode: string;
  releaseVersion: number;
  generatedAt: string;
  model?: VerifierPackageModel;
  assessmentContext?: SealAssessmentContext;
}): Promise<Buffer> {
  const model = params.model || buildVerifierPackageModel(params);
  const sheets = buildSheets({ ...params, model }).map((sheet) => ({ ...sheet, name: safeSheetName(sheet.name) }));
  if (new Set(sheets.map((sheet) => sheet.name)).size !== sheets.length) throw new Error("XLSX_DUPLICATE_SHEET_NAME");
  if (sheets.length < 12) throw new Error("XLSX_VERIFIER_SHEET_CONTRACT_FAILED");

  const zip = new JSZip();
  const date = new Date(params.generatedAt);
  const fileOptions = { date, createFolders: true };

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`, fileOptions);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`, fileOptions);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")}</sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`, fileOptions);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`, fileOptions);
  zip.file("xl/styles.xml", stylesXml(), fileOptions);

  sheets.forEach((sheet, index) => {
    const built = sheetXml(sheet);
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, built.xml, fileOptions);
    if (built.relationships) zip.file(`xl/worksheets/_rels/sheet${index + 1}.xml.rels`, built.relationships, fileOptions);
  });

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 9 }, platform: "UNIX" });
  const validation = await JSZip.loadAsync(buffer, { checkCRC32: true });
  const required = ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/styles.xml", ...sheets.map((_, index) => `xl/worksheets/sheet${index + 1}.xml`)];
  for (const path of required) if (!validation.file(path)) throw new Error(`XLSX_COMPONENT_MISSING:${path}`);
  const workbookXml = await validation.file("xl/workbook.xml")?.async("string");
  const styles = await validation.file("xl/styles.xml")?.async("string");
  const worksheetXml = (await Promise.all(
    sheets.map((_, index) => validation.file(`xl/worksheets/sheet${index + 1}.xml`)!.async("string"))
  )).join("\n");
  if (
    !workbookXml?.includes("VERIFIER_SIGN_OFF") ||
    !styles?.includes('<dxfs count="3">') ||
    !worksheetXml.includes("<conditionalFormatting") ||
    !worksheetXml.includes("<dataValidations")
  ) {
    throw new Error("XLSX_VERIFIER_STRUCTURE_INVALID");
  }
  return buffer;
}
