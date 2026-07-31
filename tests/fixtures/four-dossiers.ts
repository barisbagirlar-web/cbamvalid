/**
 * FAZ P0 (F) — Four complete sandbox dossier fixtures.
 *
 * Realistic, seal-ready operator dossiers for four CBAM sectors:
 *   STEEL_IN      — iron & steel, BF-BOF, HBI precursor, carbon price
 *   CEMENT_EG     — clinker + cement, kiln process emissions, mass balance
 *   ALU_CN        — primary aluminium, alumina precursor, large electricity
 *   FERTILISER_TR — ammonia/urea, natural-gas feedstock, direct + indirect
 *
 * Every fixture is fully seeded:
 *   - assessmentTimestamp = 2027-01-31T00:00:00.000Z, reporting 2026-ANNUAL
 *   - all mandatory operator/installation/template fields
 *   - valid UN/LOCODE + 6-decimal coordinates + monitoring-plan metadata
 *   - approved, supported, malware-clean evidence covering every material
 *     input (EORI, CN, production, system boundary, period, grid factor,
 *     direct/indirect, precursor, carbon price), with structured quality
 *     metadata and server review provenance
 *   - accepted methodology decisions (with approval provenance)
 *   - sign-offs, risk/materiality/sampling inputs
 *
 * SSOT compliance notes:
 *   - storagePath is tenant/case-bound (evidence/{ownerId}/{caseId}/...)
 *   - a document supports at most 3 requirement classes (WP-07)
 *   - distinct document count meets the WP-07 diversity threshold
 *   - evidence bytes are deterministic synthetic PDFs; fileHash/sizeBytes are
 *     hydrated from those bytes via buildFourDossierEvidenceFiles.
 */

import type {
  AuditReadyCase,
  EvidenceRecord,
  InputDatum,
} from "../../functions/src/cbam/schema";
import type { EvidenceBinary } from "../../functions/src/cbam/report/verifier-package-builder";
import {
  buildSyntheticEvidencePdf,
  syntheticSha256,
  type SyntheticDocumentSpec,
} from "./synthetic-documents";

export type FourDossierKey = "STEEL_IN" | "CEMENT_EG" | "ALU_CN" | "FERTILISER_TR";

export const FOUR_DOSSIER_KEYS: readonly FourDossierKey[] = [
  "STEEL_IN",
  "CEMENT_EG",
  "ALU_CN",
  "FERTILISER_TR",
];

export const FOUR_DOSSIER_ASSESSMENT_TIMESTAMP = "2027-01-31T00:00:00.000Z";
export const FOUR_DOSSIER_PERIOD = "2026 ANNUAL";
export const FOUR_DOSSIER_RULESET = "EU-CBAM-DEFINITIVE-2026";
export const FOUR_DOSSIER_REVIEWER = "sandbox-internal-reviewer";
export const FOUR_DOSSIER_REVIEWER_NAME = "Sandbox Internal Reviewer";
export const FOUR_DOSSIER_REVIEWER_ROLE = "INTERNAL_REVIEWER";

interface DatumOptions {
  evidenceId?: string;
  canonicalUnit?: string;
  reportingPeriod?: string;
  sourceType?: InputDatum["sourceType"];
  confidenceStatus?: InputDatum["confidenceStatus"];
  responsiblePerson?: string;
  measurementMethod?: string;
  documentReference?: string;
}

function datum(value: string | number, options: DatumOptions = {}): InputDatum {
  return {
    value,
    ...(options.canonicalUnit ? { canonicalUnit: options.canonicalUnit } : {}),
    ...(options.reportingPeriod ? { reportingPeriod: options.reportingPeriod } : {}),
    sourceType: options.sourceType ?? "PRIMARY",
    confidenceStatus: options.confidenceStatus ?? "HIGH_VERIFIED",
    ...(options.evidenceId ? { evidenceId: options.evidenceId } : {}),
    documentReference: options.documentReference ?? "Synthetic controlled record (sandbox fixture)",
    measurementMethod:
      options.measurementMethod ?? "Documented direct measurement with reconciled production ledger",
    responsiblePerson: options.responsiblePerson ?? "Installation monitoring manager",
  };
}

interface EvidenceSpec {
  evidenceId: string;
  documentType: string;
  fileName: string;
  issuer: string;
  issuerCategory: Exclude<NonNullable<EvidenceRecord["issuerCategory"]>, "SECONDARY_SOURCE">;
  documentAuthority: Exclude<NonNullable<EvidenceRecord["documentAuthority"]>, "SECONDARY">;
  officialReference: string;
  issueDate: string;
  pageReference: string;
  qualityGrade: Exclude<NonNullable<EvidenceRecord["qualityGrade"]>, "D" | "E" | "PENDING">;
  reviewerNotes: string;
  linkedInputs: string[];
  accreditationReference?: string;
  sampleValues: Record<string, string>;
}

function evidenceRecord(caseId: string, ownerId: string, spec: EvidenceSpec): EvidenceRecord {
  return {
    evidenceId: spec.evidenceId,
    documentType: spec.documentType,
    fileName: spec.fileName,
    storagePath: `evidence/${ownerId}/${caseId}/${spec.evidenceId}/${spec.fileName}`,
    mimeType: "application/pdf",
    sizeBytes: 0, // hydrated from deterministic PDF bytes in buildFourDossierEvidenceFiles
    issuer: spec.issuer,
    issueDate: spec.issueDate,
    reportingPeriod: FOUR_DOSSIER_PERIOD,
    pageReference: spec.pageReference,
    fileHash: "0".repeat(64), // hydrated
    uploadTimestamp: "2027-01-31T00:00:00.000Z",
    uploader: "sandbox-seeder",
    reviewStatus: "APPROVED",
    supportStatus: "SUPPORTED",
    malwareScanStatus: "CLEAN",
    confidentiality: "CONFIDENTIAL",
    linkedInputs: spec.linkedInputs,
    linkedCalculations: [],
    reviewerNotes: spec.reviewerNotes,
    evidencePeriodStart: "2026-01-01",
    evidencePeriodEnd: "2026-12-31",
    issuerCategory: spec.issuerCategory,
    documentAuthority: spec.documentAuthority,
    qualityGrade: spec.qualityGrade,
    qualityAssessmentBasis: `SERVER_ASSESSED_EXPLICIT_GRADE_${spec.qualityGrade}`,
    qualityAssessedBy: FOUR_DOSSIER_REVIEWER,
    qualityAssessedAt: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
    officialReference: spec.officialReference,
    ...(spec.accreditationReference ? { accreditationReference: spec.accreditationReference } : {}),
  };
}

function acceptedDecision(
  decisionId: string,
  topic: string,
  selectedMethod: string,
  reason: string,
  legalOrTechnicalBasis: string,
  evidenceIds: string[]
): AuditReadyCase["methodologyDecisions"][number] {
  return {
    decisionId,
    topic,
    selectedMethod,
    reason,
    legalOrTechnicalBasis,
    evidenceIds,
    reviewStatus: "ACCEPTED",
    rulesetVersion: FOUR_DOSSIER_RULESET,
    approverName: FOUR_DOSSIER_REVIEWER_NAME,
    approverRole: FOUR_DOSSIER_REVIEWER_ROLE,
    approvedAt: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
  };
}

function signOffs(): AuditReadyCase["operatorSignOffs"] {
  return [
    { role: "OPERATOR_PREPARER", name: "Sandbox Data Preparer", title: "Data Preparer", signedAt: "2027-01-28T10:00:00.000Z" },
    { role: "INTERNAL_REVIEWER", name: FOUR_DOSSIER_REVIEWER_NAME, title: "Internal Reviewer", signedAt: "2027-01-29T10:00:00.000Z" },
    { role: "DATA_OWNER", name: "Sandbox Installation Manager", title: "Installation Manager", signedAt: "2027-01-30T10:00:00.000Z" },
  ];
}

function preparationInputs(
  goodRows: Array<{ goodIndex: number; cnCode: string; materialityRate: number }>
): AuditReadyCase["verifierReserved"] {
  return {
    materialityLevelPerGood: Object.fromEntries(
      goodRows.map((row) => [row.cnCode, row.materialityRate])
    ),
    preparationInputs: {
      riskRegister: [
        {
          riskId: "RISK-001",
          riskCategory: "INHERENT",
          description: "Activity data meter drift and unrecorded maintenance windows",
          likelihood: "MEDIUM",
          impact: "MEDIUM",
          mitigation: "Annual calibrated meters and reconciliation against supplier invoices",
        },
        {
          riskId: "RISK-002",
          riskCategory: "CONTROL",
          description: "Manual ledger entry errors during period closure",
          likelihood: "LOW",
          impact: "MEDIUM",
          mitigation: "Dual-entry check and internal reviewer sign-off before sealing",
        },
        {
          riskId: "RISK-003",
          riskCategory: "DETECTION",
          description: "Classification changes for borderline CN codes",
          likelihood: "LOW",
          impact: "HIGH",
          mitigation: "Customs-authority classification confirmation retained on file",
        },
      ],
      materialityWorkpapers: goodRows.map((row) => ({
        goodIndex: row.goodIndex,
        cnCode: row.cnCode,
        basis: "CALCULATION",
        materialityRate: row.materialityRate,
        verifierStatus: "PROVISIONAL_FOR_VERIFIER_PLANNING",
      })),
      samplingPlan: {
        population: "All monthly fuel, meter and production ledger records for the reporting period",
        rationale: "Risk-based selection focusing on highest-share goods and electricity consumption lines",
        sampleSelection: "Monthly strata plus judgmental selection of the largest electricity lines",
        sampleSize: 12,
      },
    },
  };
}

const CUSTOMS_DOC = (cnCodes: string[], eori: string, ref: string, issuer: string): EvidenceSpec => ({
  evidenceId: "",
  documentType: "CUSTOMS_DECLARATION",
  fileName: "customs-declaration-classification-2026.pdf",
  issuer,
  issuerCategory: "CUSTOMS_AUTHORITY",
  documentAuthority: "OFFICIAL",
  officialReference: ref,
  issueDate: "2026-02-15",
  pageReference: "Declaration page 1 and goods schedule lines",
  qualityGrade: "A",
  reviewerNotes: "Verified importer EORI and CN classification against the customs declaration register.",
  linkedInputs: ["importerIdentity.eoriNumber", ...cnCodes.map((_, index) => `goods.${index}.cnCode`)],
  sampleValues: {
    "Declarant EORI": eori,
    "Reporting year": "2026",
    ...Object.fromEntries(cnCodes.map((code, index) => [`Good ${index + 1} CN code`, code])),
  },
});

const REGISTRY_DOC = (ref: string, issuer: string, importerName: string): EvidenceSpec => ({
  evidenceId: "",
  documentType: "COMPANY_REGISTRATION_EXTRACT",
  fileName: "operator-registration-extract-2026.pdf",
  issuer,
  issuerCategory: "GOVERNMENT_AUTHORITY",
  documentAuthority: "OFFICIAL",
  officialReference: ref,
  issueDate: "2026-02-10",
  pageReference: "Registration extract pages 1-2",
  qualityGrade: "A",
  reviewerNotes: "Verified importer/exporter legal identity, address and installation identity against the official registry extract.",
  linkedInputs: [
    "importerIdentity.legalName",
    "importerIdentity.address",
    "exporterIdentity.legalName",
    "exporterIdentity.address",
    "exporterIdentity.registrationNumber",
    "exporterIdentity.exporterCountry",
    "installation.name",
    "installation.address",
    "installation.country",
  ],
  sampleValues: {
    "Importer": importerName,
    "Document": "Company registration extract",
  },
});

const PERIOD_DOC = (ref: string): EvidenceSpec => ({
  evidenceId: "",
  documentType: "PERIOD_CLOSURE_SHEET",
  fileName: "period-closure-sheet-2026.pdf",
  issuer: "Operator internal control (period closure)",
  issuerCategory: "OPERATOR_CONTROLLED",
  documentAuthority: "OPERATOR",
  officialReference: ref,
  issueDate: "2027-01-10",
  pageReference: "Period closure control sheet page 1",
  qualityGrade: "B",
  reviewerNotes: "Signed period closure sheet confirms the definitive annual reporting period 2026-01-01 to 2026-12-31.",
  linkedInputs: [
    "reportingPeriod.year",
    "reportingPeriod.quarter",
    "reportingPeriod.startDate",
    "reportingPeriod.endDate",
  ],
  sampleValues: {
    "Reporting period": "2026-01-01 to 2026-12-31",
    "Period type": "DEFINITIVE_ANNUAL",
  },
});

const GRID_DOC = (ref: string, issuer: string, factor: string, electricityMwh: string): EvidenceSpec => ({
  evidenceId: "",
  documentType: "GRID_EMISSION_FACTOR_PUBLICATION",
  fileName: "grid-emission-factor-2026.pdf",
  issuer,
  issuerCategory: "GRID_OPERATOR",
  documentAuthority: "OFFICIAL",
  officialReference: ref,
  issueDate: "2026-06-30",
  pageReference: "Factor table page 9",
  qualityGrade: "A",
  reviewerNotes: "Official grid emission factor for the reporting year; electricity consumption reconciles to billing meters.",
  linkedInputs: ["gridEmissionFactor", "electricityConsumed"],
  sampleValues: {
    "Grid emission factor (tCO2e/MWh)": factor,
    "Electricity consumed (MWh)": electricityMwh,
  },
});

const INVOICE_DOC = (ref: string, issuer: string, electricityMwh: string): EvidenceSpec => ({
  evidenceId: "",
  documentType: "ELECTRICITY_SUPPLIER_RECORDS",
  fileName: "electricity-invoice-summary-2026.pdf",
  issuer,
  issuerCategory: "REGULATED_UTILITY",
  documentAuthority: "INDEPENDENT",
  officialReference: ref,
  issueDate: "2027-01-15",
  pageReference: "Annual consumption summary sheet",
  qualityGrade: "A",
  reviewerNotes: "Regulated utility annual consumption summary independently corroborates site electricity meters.",
  linkedInputs: ["electricityConsumed"],
  sampleValues: {
    "Annual electricity (MWh)": electricityMwh,
    "Document": "Regulated utility consumption summary",
  },
});

const DIRECT_DOC = (ref: string, tco2e: string): EvidenceSpec => ({
  evidenceId: "",
  documentType: "DIRECT_EMISSIONS_CALCULATION_WORKBOOK",
  fileName: "direct-emissions-workbook-2026.pdf",
  issuer: "Operator internal control (direct emissions)",
  issuerCategory: "OPERATOR_CONTROLLED",
  documentAuthority: "OPERATOR",
  officialReference: ref,
  issueDate: "2026-03-12",
  pageReference: "Workbook control totals and factor sources",
  qualityGrade: "B",
  reviewerNotes: "Direct emissions control total reconciles activity ledger, factors and intermediate calculations.",
  linkedInputs: ["directEmissions"],
  sampleValues: {
    "Direct emissions (tCO2e)": tco2e,
    "Method": "Activity ledger with verified emission factors",
  },
});

const CALIBRATION_DOC = (ref: string, issuer: string): EvidenceSpec => ({
  evidenceId: "",
  documentType: "METER_CALIBRATION_CERTIFICATE",
  fileName: "meter-calibration-certificate-2026.pdf",
  issuer,
  issuerCategory: "ACCREDITED_LAB",
  documentAuthority: "INDEPENDENT",
  officialReference: ref,
  issueDate: "2026-05-20",
  pageReference: "Calibration certificate page 1 and uncertainty statement",
  qualityGrade: "A",
  reviewerNotes: "Accredited laboratory calibration certificates for primary metering support the direct-emissions measurement chain.",
  linkedInputs: ["directEmissions"],
  sampleValues: {
    "Certificate": ref,
    "Meters": "Primary fuel and gas meters, annual calibration",
  },
});

const BOUNDARY_DOC = (ref: string, planId: string, route: string): EvidenceSpec => ({
  evidenceId: "",
  documentType: "MONITORING_PLAN",
  fileName: "monitoring-plan-and-system-boundary-2026.pdf",
  issuer: "Operator internal control (monitoring plan)",
  issuerCategory: "OPERATOR_CONTROLLED",
  documentAuthority: "OPERATOR",
  officialReference: ref,
  issueDate: "2026-01-10",
  pageReference: "Boundary diagram and source stream register",
  qualityGrade: "B",
  reviewerNotes: "Monitoring plan with explicit system boundary, excluded processes and source streams.",
  linkedInputs: [
    "installation.systemBoundaries",
    "installation.monitoringPlanId",
    "installation.monitoringPlanVersion",
    "installation.monitoringPlanEffectiveDate",
    "installation.installationDiagramEvidenceId",
    "installation.excludedProcesses",
    "installation.functionalUnits",
  ],
  sampleValues: {
    "Monitoring plan": planId,
    "Production route": route,
    "Period": "2026 ANNUAL",
  },
});

const PRECURSOR_DOC = (ref: string, issuer: string, precursorName: string, quantityT: string, direct: string, indirect: string, country: string): EvidenceSpec => ({
  evidenceId: "",
  documentType: "SUPPLIER_EMISSIONS_COMMUNICATION",
  fileName: "precursor-supplier-declaration-2026.pdf",
  issuer,
  issuerCategory: "SUPPLIER",
  documentAuthority: "SUPPLIER",
  officialReference: ref,
  issueDate: "2026-04-20",
  pageReference: "Declaration pages 1-3 and supporting energy balance",
  qualityGrade: "C",
  reviewerNotes: "Supplier-furnished embedded emissions for the declared precursor with supporting mass balance.",
  linkedInputs: [
    "precursors.0.name",
    "precursors.0.quantity",
    "precursors.0.directEmissions",
    "precursors.0.indirectEmissions",
    "precursors.0.countryOfOrigin",
  ],
  sampleValues: {
    "Precursor": precursorName,
    "Quantity (t)": quantityT,
    "Direct (tCO2e)": direct,
    "Indirect (tCO2e)": indirect,
    "Country of origin": country,
  },
});

function steelInDossier(): AuditReadyCase {
  const ownerId = "sandbox-steel-in";
  const caseId = "case_steel_in_fixture";

  const EV_CUSTOMS = "10000000-0000-4000-8000-000000000001";
  const EV_REGISTRY = "10000000-0000-4000-8000-000000000002";
  const EV_PRODUCTION = "10000000-0000-4000-8000-000000000003";
  const EV_BOUNDARY = "10000000-0000-4000-8000-000000000004";
  const EV_PERIOD = "10000000-0000-4000-8000-000000000005";
  const EV_GRID = "10000000-0000-4000-8000-000000000006";
  const EV_INVOICES = "10000000-0000-4000-8000-000000000007";
  const EV_DIRECT = "10000000-0000-4000-8000-000000000008";
  const EV_CALIBRATION = "10000000-0000-4000-8000-000000000009";
  const EV_PRECURSOR = "10000000-0000-4000-8000-000000000010";
  const EV_CARBON = "10000000-0000-4000-8000-000000000011";

  const productionSpec: EvidenceSpec = {
    ...({
      evidenceId: "",
      documentType: "PRODUCTION_RECONCILIATION_REPORT",
      fileName: "production-and-allocation-ledger-2026.pdf",
      issuer: "Operator internal control (production ledger)",
      issuerCategory: "OPERATOR_CONTROLLED",
      documentAuthority: "OPERATOR",
      officialReference: "TSW-LEDGER-2026-001",
      issueDate: "2026-03-10",
      pageReference: "Mass balance ledger lines 24-60 and allocation working paper",
      qualityGrade: "B",
      reviewerNotes: "Production volumes and allocation shares (0.49/0.31/0.20) reconcile to exactly 1.00 with the signed ledger.",
      linkedInputs: [
        "goods.0.productionVolume",
        "goods.1.productionVolume",
        "goods.2.productionVolume",
        "goods.0.allocationShare",
        "goods.1.allocationShare",
        "goods.2.allocationShare",
        "installation.productionRoute",
        "installation.unloCode",
        "installation.latitude",
        "installation.longitude",
      ],
      sampleValues: {
        "Good 1 production (t)": "220000",
        "Good 2 production (t)": "140000",
        "Good 3 production (t)": "90000",
        "Allocation shares": "0.49 / 0.31 / 0.20",
        "Production route": "BF-BOF",
      },
    } as EvidenceSpec),
  };

  const customDoc = CUSTOMS_DOC(
    ["72072099", "72083920", "72139110"],
    "DE12345678901234",
    "CBIC-DECL-2026-0001",
    "Indian Customs Authority (CBIC)"
  );
  const registryDoc = REGISTRY_DOC("MCA-REG-2026-0001", "Ministry of Corporate Affairs (India)", "Euronord Steel Import GmbH");
  const periodDoc = PERIOD_DOC("TSW-CLOSURE-2026-001");
  const gridDoc = GRID_DOC("CEA-GEF-2026", "Central Electricity Authority (CEA) India", "0.7067", "550000");
  const invoiceDoc = INVOICE_DOC("JUSL-INV-2026-001", "Jharkhand State Electricity Distribution Company", "550000");
  const directDoc = DIRECT_DOC("TSW-DIRECT-2026-001", "874300");
  const calibrationDoc = CALIBRATION_DOC("NABL-CAL-2026-001", "NABL-Accredited Metrology Laboratory");
  const boundaryDoc = BOUNDARY_DOC("MP-JSP-2026-v3", "MP-JSP-2026-v3", "Blast Furnace Route (BF-BOF)");
  const precursorDoc = PRECURSOR_DOC("HBI-COMM-2026-001", "Verified HBI Supply B.V.", "Hot briquetted iron (HBI)", "96000", "76800", "9600", "TR");
  const carbonDoc: EvidenceSpec = {
    evidenceId: "",
    documentType: "CARBON_PRICE_RECEIPT",
    fileName: "carbon-price-payment-receipt-2026.pdf",
    issuer: "National Carbon Levy Authority",
    issuerCategory: "GOVERNMENT_AUTHORITY",
    documentAuthority: "OFFICIAL",
    officialReference: "NCLA-RCPT-2026-001",
    issueDate: "2026-07-05",
    pageReference: "Assessment notice and payment receipt",
    qualityGrade: "A",
    reviewerNotes: "Official payment receipt covering the assessed emissions; deduction basis matches Art. 9(2) treatment.",
    linkedInputs: ["carbonPriceRecords.0.proofOfPaymentEvidenceId"],
    sampleValues: {
      "Amount paid (EUR)": "1500000",
      "Applicable emissions (tCO2e)": "150000",
      "Reference": "NCLA-RCPT-2026-001",
    },
  };

  const caseData: AuditReadyCase = {
    caseId,
    status: "DRAFT",
    version: 1,
    ownerId,
    importerIdentity: {
      legalName: datum("Euronord Steel Import GmbH", { evidenceId: EV_REGISTRY }),
      eoriNumber: datum("DE12345678901234", { evidenceId: EV_CUSTOMS }),
      address: datum("Hafenstrasse 12, 20457 Hamburg, Germany", { evidenceId: EV_REGISTRY }),
    },
    exporterIdentity: {
      legalName: datum("Tata Steel Integrated Works", { evidenceId: EV_REGISTRY }),
      address: datum("1 Steel Works Road, Jamshedpur 831001, India", { evidenceId: EV_REGISTRY }),
      registrationNumber: datum("IN-REG-44578890", { evidenceId: EV_REGISTRY }),
      contactPerson: datum("Priya Sharma", {}),
      contactRole: datum("Emissions Compliance Manager", {}),
      contactEmail: datum("compliance@tata-steel.in", {}),
      exporterCountry: datum("IN", { evidenceId: EV_REGISTRY }),
      operatorDeclaration: datum("Signed", { evidenceId: EV_REGISTRY }),
      preparerSignOff: datum("Signed", {}),
      internalReviewerSignOff: datum("Signed", {}),
    },
    reportingPeriod: {
      year: datum("2026", { evidenceId: EV_PERIOD }),
      quarter: datum("ANNUAL", { evidenceId: EV_PERIOD }),
      startDate: datum("2026-01-01", { evidenceId: EV_PERIOD }),
      endDate: datum("2026-12-31", { evidenceId: EV_PERIOD }),
    },
    goods: [
      {
        cnCode: datum("72072099", { evidenceId: EV_CUSTOMS }),
        sector: "IRON_AND_STEEL",
        productionVolume: datum("220000", { canonicalUnit: "t", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
        shipmentRecords: datum("Non-alloy steel semi-finished products, 2026 annual production", { evidenceId: EV_PRODUCTION }),
        allocationShare: datum("0.49", { canonicalUnit: "fraction", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
      },
      {
        cnCode: datum("72083920", { evidenceId: EV_CUSTOMS }),
        sector: "IRON_AND_STEEL",
        productionVolume: datum("140000", { canonicalUnit: "t", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
        shipmentRecords: datum("Flat-rolled non-alloy steel, 2026 annual production", { evidenceId: EV_PRODUCTION }),
        allocationShare: datum("0.31", { canonicalUnit: "fraction", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
      },
      {
        cnCode: datum("72139110", { evidenceId: EV_CUSTOMS }),
        sector: "IRON_AND_STEEL",
        productionVolume: datum("90000", { canonicalUnit: "t", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
        shipmentRecords: datum("Hot-rolled bars and rods, 2026 annual production", { evidenceId: EV_PRODUCTION }),
        allocationShare: datum("0.20", { canonicalUnit: "fraction", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
      },
    ],
    installation: {
      name: datum("Jamshedpur Integrated Steel Plant", { evidenceId: EV_REGISTRY }),
      registryInstallationId: datum("IN-CBAM-INST-2001", { evidenceId: EV_REGISTRY }),
      unloCode: datum("INJAM", { evidenceId: EV_PRODUCTION }),
      address: datum("1 Steel Works Road, Jamshedpur, Jharkhand 831001, India", { evidenceId: EV_REGISTRY }),
      latitude: datum("22.793450", { evidenceId: EV_PRODUCTION }),
      longitude: datum("86.200000", { evidenceId: EV_PRODUCTION }),
      country: datum("IN", { evidenceId: EV_REGISTRY }),
      productionRoute: datum("Blast Furnace Route (BF-BOF)", { evidenceId: EV_PRODUCTION }),
      systemBoundaries:
        "Boundary includes coke preparation, sinter plant, blast furnace, basic oxygen furnace, casting and finishing operations. Excludes downstream rolling mills and on-site power export.",
      excludedProcesses: "Downstream rolling mills and exported by-product power",
      functionalUnits: "t of semi-finished, flat-rolled and bar/rod steel",
      installationDiagramEvidenceId: EV_BOUNDARY,
      monitoringPlanId: datum("MP-JSP-2026-v3", { evidenceId: EV_BOUNDARY }),
      monitoringPlanVersion: datum("v3", { evidenceId: EV_BOUNDARY }),
      monitoringPlanEffectiveDate: datum("2026-01-01", { evidenceId: EV_BOUNDARY }),
    },
    directEmissions: datum("874300", { canonicalUnit: "tCO2e", evidenceId: EV_DIRECT, reportingPeriod: "2026 ANNUAL", measurementMethod: "Fuel activity ledger, laboratory NCV values and EFTA-verified emission factors", responsiblePerson: "Installation emissions manager" }),
    electricityConsumed: datum("550000", { canonicalUnit: "MWh", evidenceId: EV_GRID, reportingPeriod: "2026 ANNUAL", measurementMethod: "Billing meters reconciled to supplier invoices", responsiblePerson: "Energy manager" }),
    gridEmissionFactor: datum("0.7067", { canonicalUnit: "tCO2e/MWh", evidenceId: EV_GRID, reportingPeriod: "2026 ANNUAL", measurementMethod: "Official grid operator publication for the reporting year", responsiblePerson: "Energy manager" }),
    precursors: [
      {
        name: datum("Hot briquetted iron (HBI)", { evidenceId: EV_PRECURSOR, reportingPeriod: "2026 ANNUAL" }),
        quantity: datum("96000", { canonicalUnit: "t", evidenceId: EV_PRECURSOR, reportingPeriod: "2026 ANNUAL" }),
        directEmissions: datum("76800", { canonicalUnit: "tCO2e", evidenceId: EV_PRECURSOR, reportingPeriod: "2026 ANNUAL" }),
        indirectEmissions: datum("9600", { canonicalUnit: "tCO2e", evidenceId: EV_PRECURSOR, reportingPeriod: "2026 ANNUAL" }),
        countryOfOrigin: datum("TR", { evidenceId: EV_PRECURSOR }),
      },
    ],
    carbonPriceRecords: [
      {
        id: "50000000-0000-4000-8000-000000000001",
        amountPaid: "1500000",
        applicableEmissions: "150000",
        currency: "EUR",
        paymentPeriod: "2026",
        legislationReference: "Regulation (EU) 2023/956, Art. 9(2) carbon price deduction; national carbon levy settlement",
        proofOfPaymentEvidenceId: EV_CARBON,
        rebateInformation: "No rebate claimed for the reporting period",
        eligibleCertificateReduction: "1500000",
      },
    ],
    evidenceRegister: [
      evidenceRecord(caseId, ownerId, { ...customDoc, evidenceId: EV_CUSTOMS }),
      evidenceRecord(caseId, ownerId, { ...registryDoc, evidenceId: EV_REGISTRY }),
      evidenceRecord(caseId, ownerId, { ...productionSpec, evidenceId: EV_PRODUCTION }),
      evidenceRecord(caseId, ownerId, { ...boundaryDoc, evidenceId: EV_BOUNDARY }),
      evidenceRecord(caseId, ownerId, { ...periodDoc, evidenceId: EV_PERIOD }),
      evidenceRecord(caseId, ownerId, { ...gridDoc, evidenceId: EV_GRID }),
      evidenceRecord(caseId, ownerId, { ...invoiceDoc, evidenceId: EV_INVOICES }),
      evidenceRecord(caseId, ownerId, { ...directDoc, evidenceId: EV_DIRECT }),
      evidenceRecord(caseId, ownerId, { ...calibrationDoc, evidenceId: EV_CALIBRATION }),
      evidenceRecord(caseId, ownerId, { ...precursorDoc, evidenceId: EV_PRECURSOR }),
      evidenceRecord(caseId, ownerId, { ...carbonDoc, evidenceId: EV_CARBON }),
    ],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [
      acceptedDecision(
        "60000000-0000-4000-8000-000000000001",
        "GOODS_EMISSIONS_ALLOCATION",
        "Allocate installation emissions by documented product mass shares (0.49 / 0.31 / 0.20)",
        "The three goods are produced in the same controlled period and the reconciled production ledger provides complete mass shares summing to one.",
        "Commission Implementing Regulation (EU) 2025/2547 allocation provisions; supported by the reconciled production ledger.",
        [EV_PRODUCTION]
      ),
      acceptedDecision(
        "60000000-0000-4000-8000-000000000002",
        "SYSTEM_BOUNDARY",
        "System boundary per installation monitoring plan MP-JSP-2026-v3 and process map",
        "The controlled boundary statement matches the monitoring plan and excludes downstream rolling mills and power export.",
        "Regulation (EU) 2023/956 Annex IV; Commission Implementing Regulation (EU) 2025/2547 monitoring-plan requirements.",
        [EV_BOUNDARY]
      ),
    ],
    verifierReserved: preparationInputs([
      { goodIndex: 0, cnCode: "72072099", materialityRate: 0.49 },
      { goodIndex: 1, cnCode: "72083920", materialityRate: 0.31 },
      { goodIndex: 2, cnCode: "72139110", materialityRate: 0.2 },
    ]),
    operatorSignOffs: signOffs(),
    auditEvents: [
      {
        eventId: "70000000-0000-4000-8000-000000000001",
        timestamp: "2027-01-31T00:00:00.000Z",
        actor: "sandbox-seeder",
        action: "FIXTURE_SEEDED",
      },
    ],
  };
  return caseData;
}

function cementEgDossier(): AuditReadyCase {
  const ownerId = "sandbox-cement-eg";
  const caseId = "case_cement_eg_fixture";

  const EV_CUSTOMS = "11000000-0000-4000-8000-000000000001";
  const EV_REGISTRY = "11000000-0000-4000-8000-000000000002";
  const EV_PRODUCTION = "11000000-0000-4000-8000-000000000003";
  const EV_BOUNDARY = "11000000-0000-4000-8000-000000000004";
  const EV_PERIOD = "11000000-0000-4000-8000-000000000005";
  const EV_GRID = "11000000-0000-4000-8000-000000000006";
  const EV_INVOICES = "11000000-0000-4000-8000-000000000007";
  const EV_DIRECT = "11000000-0000-4000-8000-000000000008";
  const EV_CALIBRATION = "11000000-0000-4000-8000-000000000009";

  const productionSpec: EvidenceSpec = {
    evidenceId: "",
    documentType: "PRODUCTION_RECONCILIATION_REPORT",
    fileName: "mass-balance-and-allocation-ledger-2026.pdf",
    issuer: "Operator internal control (production ledger)",
    issuerCategory: "OPERATOR_CONTROLLED",
    documentAuthority: "OPERATOR",
    officialReference: "SCZ-LEDGER-2026-001",
    issueDate: "2026-03-14",
    pageReference: "Kiln mass balance and product ledger lines 8-40",
    qualityGrade: "B",
    reviewerNotes: "Clinker and cement mass balance reconciles; allocation shares sum to exactly 1.00.",
    linkedInputs: [
      "goods.0.productionVolume",
      "goods.1.productionVolume",
      "goods.0.allocationShare",
      "goods.1.allocationShare",
      "installation.productionRoute",
      "installation.unloCode",
      "installation.latitude",
      "installation.longitude",
    ],
    sampleValues: {
      "Clinker (t)": "500000",
      "Cement (t)": "400000",
      "Allocation shares": "0.55 / 0.45",
      "Route": "Dry rotary kiln with precalciner",
    },
  };

  const caseData: AuditReadyCase = {
    caseId,
    status: "DRAFT",
    version: 1,
    ownerId,
    importerIdentity: {
      legalName: datum("SuezMed Cement Import B.V.", { evidenceId: EV_REGISTRY }),
      eoriNumber: datum("NL98765432101", { evidenceId: EV_CUSTOMS }),
      address: datum("Havenkade 4, 3011 Rotterdam, Netherlands", { evidenceId: EV_REGISTRY }),
    },
    exporterIdentity: {
      legalName: datum("Suez Cement Integrated Works", { evidenceId: EV_REGISTRY }),
      address: datum("Km 78 Cairo-Suez Road, Suez Governorate, Egypt", { evidenceId: EV_REGISTRY }),
      registrationNumber: datum("EG-REG-77881234", { evidenceId: EV_REGISTRY }),
      contactPerson: datum("Karim Hassan"),
      contactEmail: datum("compliance@suezcement.eg"),
      exporterCountry: datum("EG", { evidenceId: EV_REGISTRY }),
      operatorDeclaration: datum("Signed", { evidenceId: EV_REGISTRY }),
      preparerSignOff: datum("Signed", {}),
      internalReviewerSignOff: datum("Signed", {}),
    },
    reportingPeriod: {
      year: datum("2026", { evidenceId: EV_PERIOD }),
      quarter: datum("ANNUAL", { evidenceId: EV_PERIOD }),
      startDate: datum("2026-01-01", { evidenceId: EV_PERIOD }),
      endDate: datum("2026-12-31", { evidenceId: EV_PERIOD }),
    },
    goods: [
      {
        cnCode: datum("25071000", { evidenceId: EV_CUSTOMS }),
        sector: "CEMENT",
        productionVolume: datum("500000", { canonicalUnit: "t", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
        shipmentRecords: datum("Portland cement clinker, 2026 annual production", { evidenceId: EV_PRODUCTION }),
        allocationShare: datum("0.55", { canonicalUnit: "fraction", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
      },
      {
        cnCode: datum("25232900", { evidenceId: EV_CUSTOMS }),
        sector: "CEMENT",
        productionVolume: datum("400000", { canonicalUnit: "t", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
        shipmentRecords: datum("Other portland cement, 2026 annual production", { evidenceId: EV_PRODUCTION }),
        allocationShare: datum("0.45", { canonicalUnit: "fraction", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
      },
    ],
    installation: {
      name: datum("Suez Cement Integrated Works", { evidenceId: EV_REGISTRY }),
      registryInstallationId: datum("EG-CBAM-INST-3001", { evidenceId: EV_REGISTRY }),
      unloCode: datum("EGSUZ", { evidenceId: EV_PRODUCTION }),
      address: datum("Km 78 Cairo-Suez Road, Suez, Egypt", { evidenceId: EV_REGISTRY }),
      latitude: datum("29.966831", { evidenceId: EV_PRODUCTION }),
      longitude: datum("32.549797", { evidenceId: EV_PRODUCTION }),
      country: datum("EG", { evidenceId: EV_REGISTRY }),
      productionRoute: datum("Dry rotary kiln process with preheater and precalciner", { evidenceId: EV_PRODUCTION }),
      systemBoundaries:
        "Boundary includes raw-material preparation, preheater, precalciner, rotary kiln, clinker cooling and cement grinding. Excludes quarry extraction outside the controlled site.",
      excludedProcesses: "Quarry extraction outside the controlled site and cement distribution terminals",
      functionalUnits: "t of clinker and t of finished cement",
      installationDiagramEvidenceId: EV_BOUNDARY,
      monitoringPlanId: datum("MP-SCZ-2026-v2", { evidenceId: EV_BOUNDARY }),
      monitoringPlanVersion: datum("v2", { evidenceId: EV_BOUNDARY }),
      monitoringPlanEffectiveDate: datum("2026-01-01", { evidenceId: EV_BOUNDARY }),
    },
    directEmissions: datum("950000", { canonicalUnit: "tCO2e", evidenceId: EV_DIRECT, reportingPeriod: "2026 ANNUAL", measurementMethod: "Kiln fuel ledger, calcination factors and continuous kiln gas measurement", responsiblePerson: "Kiln process engineer" }),
    electricityConsumed: datum("120000", { canonicalUnit: "MWh", evidenceId: EV_GRID, reportingPeriod: "2026 ANNUAL", measurementMethod: "Site billing meters reconciled to grid operator invoices", responsiblePerson: "Energy manager" }),
    gridEmissionFactor: datum("0.5531", { canonicalUnit: "tCO2e/MWh", evidenceId: EV_GRID, reportingPeriod: "2026 ANNUAL", measurementMethod: "Official grid operator factor publication for the reporting year", responsiblePerson: "Energy manager" }),
    precursors: [],
    carbonPriceRecords: [],
    evidenceRegister: [
      evidenceRecord(caseId, ownerId, { ...CUSTOMS_DOC(["25071000", "25232900"], "NL98765432101", "ECA-DECL-2026-0001", "Egyptian Customs Authority"), evidenceId: EV_CUSTOMS }),
      evidenceRecord(caseId, ownerId, { ...REGISTRY_DOC("EGC-REG-2026-0001", "Egyptian General Authority for Investment", "SuezMed Cement Import B.V."), evidenceId: EV_REGISTRY }),
      evidenceRecord(caseId, ownerId, { ...productionSpec, evidenceId: EV_PRODUCTION }),
      evidenceRecord(caseId, ownerId, { ...BOUNDARY_DOC("MP-SCZ-2026-v2", "MP-SCZ-2026-v2", "Dry rotary kiln with precalciner"), evidenceId: EV_BOUNDARY }),
      evidenceRecord(caseId, ownerId, { ...PERIOD_DOC("SCZ-CLOSURE-2026-001"), evidenceId: EV_PERIOD }),
      evidenceRecord(caseId, ownerId, { ...GRID_DOC("EETC-GEF-2026", "Egyptian Electricity Transmission Company", "0.5531", "120000"), evidenceId: EV_GRID }),
      evidenceRecord(caseId, ownerId, { ...INVOICE_DOC("EETC-INV-2026-001", "Egyptian Electricity Transmission Company", "120000"), evidenceId: EV_INVOICES }),
      evidenceRecord(caseId, ownerId, { ...DIRECT_DOC("SCZ-DIRECT-2026-001", "950000"), evidenceId: EV_DIRECT }),
      evidenceRecord(caseId, ownerId, { ...CALIBRATION_DOC("EGAC-CAL-2026-001", "EGAC-Accredited Calibration Laboratory"), evidenceId: EV_CALIBRATION }),
    ],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [
      acceptedDecision(
        "61000000-0000-4000-8000-000000000001",
        "PRECURSOR_SCOPE",
        "No qualifying precursor goods are declared for the clinker and cement production route",
        "The controlled route consumes raw meal and fuels only; no separate precursor goods require an additional embedded-emissions line.",
        "Regulation (EU) 2023/956 Annex IV precursor rules; supported by the kiln mass balance.",
        [EV_PRODUCTION]
      ),
      acceptedDecision(
        "61000000-0000-4000-8000-000000000002",
        "GOODS_EMISSIONS_ALLOCATION",
        "Allocate installation emissions by documented product mass shares (0.55 / 0.45)",
        "Clinker and cement share the same kiln boundary; the reconciled product ledger provides complete mass shares summing to one.",
        "Commission Implementing Regulation (EU) 2025/2547 allocation provisions; supported by the mass balance ledger.",
        [EV_PRODUCTION]
      ),
      acceptedDecision(
        "61000000-0000-4000-8000-000000000003",
        "SYSTEM_BOUNDARY",
        "System boundary per installation monitoring plan MP-SCZ-2026-v2 and process map",
        "The boundary excludes quarry extraction and distribution terminals; all kiln source streams are inside the boundary.",
        "Regulation (EU) 2023/956 Annex IV; monitoring-plan requirements.",
        [EV_BOUNDARY]
      ),
    ],
    verifierReserved: preparationInputs([
      { goodIndex: 0, cnCode: "25071000", materialityRate: 0.55 },
      { goodIndex: 1, cnCode: "25232900", materialityRate: 0.45 },
    ]),
    operatorSignOffs: signOffs(),
    auditEvents: [
      {
        eventId: "71000000-0000-4000-8000-000000000001",
        timestamp: "2027-01-31T00:00:00.000Z",
        actor: "sandbox-seeder",
        action: "FIXTURE_SEEDED",
      },
    ],
  };
  return caseData;
}

function aluCnDossier(): AuditReadyCase {
  const ownerId = "sandbox-alu-cn";
  const caseId = "case_alu_cn_fixture";

  const EV_CUSTOMS = "12000000-0000-4000-8000-000000000001";
  const EV_REGISTRY = "12000000-0000-4000-8000-000000000002";
  const EV_PRODUCTION = "12000000-0000-4000-8000-000000000003";
  const EV_BOUNDARY = "12000000-0000-4000-8000-000000000004";
  const EV_PERIOD = "12000000-0000-4000-8000-000000000005";
  const EV_GRID = "12000000-0000-4000-8000-000000000006";
  const EV_INVOICES = "12000000-0000-4000-8000-000000000007";
  const EV_DIRECT = "12000000-0000-4000-8000-000000000008";
  const EV_CALIBRATION = "12000000-0000-4000-8000-000000000009";
  const EV_PRECURSOR = "12000000-0000-4000-8000-000000000010";

  const productionSpec: EvidenceSpec = {
    evidenceId: "",
    documentType: "PRODUCTION_RECONCILIATION_REPORT",
    fileName: "smelter-production-ledger-2026.pdf",
    issuer: "Operator internal control (production ledger)",
    issuerCategory: "OPERATOR_CONTROLLED",
    documentAuthority: "OPERATOR",
    officialReference: "XJA-LEDGER-2026-001",
    issueDate: "2026-03-20",
    pageReference: "Potline production ledger and dispatch reconciliation",
    qualityGrade: "B",
    reviewerNotes: "Primary aluminium production reconciles potline metal output, inventory and dispatch.",
    linkedInputs: [
      "goods.0.productionVolume",
      "goods.0.allocationShare",
      "installation.productionRoute",
      "installation.unloCode",
      "installation.latitude",
      "installation.longitude",
    ],
    sampleValues: {
      "Primary aluminium (t)": "600000",
      "Route": "Prebake anode electrolysis",
    },
  };

  const caseData: AuditReadyCase = {
    caseId,
    status: "DRAFT",
    version: 1,
    ownerId,
    importerIdentity: {
      legalName: datum("Nordic Aluminium Import AB", { evidenceId: EV_REGISTRY }),
      eoriNumber: datum("SE555123456789", { evidenceId: EV_CUSTOMS }),
      address: datum("Industrigatan 8, 111 34 Stockholm, Sweden", { evidenceId: EV_REGISTRY }),
    },
    exporterIdentity: {
      legalName: datum("Xinjiang Aluminium Co. Ltd", { evidenceId: EV_REGISTRY }),
      address: datum("Aluminium Road 1, Urumqi, Xinjiang, China", { evidenceId: EV_REGISTRY }),
      registrationNumber: datum("CN-REG-88990012", { evidenceId: EV_REGISTRY }),
      contactPerson: datum("Li Wei"),
      contactEmail: datum("compliance@xj-aluminium.cn"),
      exporterCountry: datum("CN", { evidenceId: EV_REGISTRY }),
      operatorDeclaration: datum("Signed", { evidenceId: EV_REGISTRY }),
      preparerSignOff: datum("Signed", {}),
      internalReviewerSignOff: datum("Signed", {}),
    },
    reportingPeriod: {
      year: datum("2026", { evidenceId: EV_PERIOD }),
      quarter: datum("ANNUAL", { evidenceId: EV_PERIOD }),
      startDate: datum("2026-01-01", { evidenceId: EV_PERIOD }),
      endDate: datum("2026-12-31", { evidenceId: EV_PERIOD }),
    },
    goods: [
      {
        cnCode: datum("76011010", { evidenceId: EV_CUSTOMS }),
        sector: "ALUMINIUM",
        productionVolume: datum("600000", { canonicalUnit: "t", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
        allocationShare: datum("1", { canonicalUnit: "fraction", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
        shipmentRecords: datum("Unwrought primary aluminium, 2026 annual production", { evidenceId: EV_PRODUCTION }),
      },
    ],
    installation: {
      name: datum("Urumqi Primary Aluminium Smelter", { evidenceId: EV_REGISTRY }),
      registryInstallationId: datum("CN-CBAM-INST-4001", { evidenceId: EV_REGISTRY }),
      unloCode: datum("CNURC", { evidenceId: EV_PRODUCTION }),
      address: datum("Aluminium Road 1, Urumqi, Xinjiang, China", { evidenceId: EV_REGISTRY }),
      latitude: datum("43.825592", { evidenceId: EV_PRODUCTION }),
      longitude: datum("87.616848", { evidenceId: EV_PRODUCTION }),
      country: datum("CN", { evidenceId: EV_REGISTRY }),
      productionRoute: datum("Prebake anode electrolysis (Hall-Heroult)", { evidenceId: EV_PRODUCTION }),
      systemBoundaries:
        "Boundary includes anode production, potlines, casting and internal power-plant share. Annex II certificate-relevant result covers direct emissions only; indirect electricity is separately disclosed.",
      excludedProcesses: "Bauxite mining and alumina refining outside the smelter boundary",
      functionalUnits: "t of unwrought primary aluminium",
      installationDiagramEvidenceId: EV_BOUNDARY,
      monitoringPlanId: datum("MP-XJA-2026-v1", { evidenceId: EV_BOUNDARY }),
      monitoringPlanVersion: datum("v1", { evidenceId: EV_BOUNDARY }),
      monitoringPlanEffectiveDate: datum("2026-01-01", { evidenceId: EV_BOUNDARY }),
    },
    directEmissions: datum("1200000", { canonicalUnit: "tCO2e", evidenceId: EV_DIRECT, reportingPeriod: "2026 ANNUAL", measurementMethod: "Anode consumption, PFC-specific emissions measurement and meter records", responsiblePerson: "Smelter emissions engineer" }),
    electricityConsumed: datum("9000000", { canonicalUnit: "MWh", evidenceId: EV_GRID, reportingPeriod: "2026 ANNUAL", measurementMethod: "High-voltage billing meters reconciled to grid operator statements", responsiblePerson: "Electrical systems manager" }),
    gridEmissionFactor: datum("0.6201", { canonicalUnit: "tCO2e/MWh", evidenceId: EV_GRID, reportingPeriod: "2026 ANNUAL", measurementMethod: "Official national grid factor publication for the reporting year", responsiblePerson: "Electrical systems manager" }),
    precursors: [
      {
        name: datum("Calcined alumina (Al2O3)", { evidenceId: EV_PRECURSOR, reportingPeriod: "2026 ANNUAL" }),
        quantity: datum("1200000", { canonicalUnit: "t", evidenceId: EV_PRECURSOR, reportingPeriod: "2026 ANNUAL" }),
        directEmissions: datum("240000", { canonicalUnit: "tCO2e", evidenceId: EV_PRECURSOR, reportingPeriod: "2026 ANNUAL" }),
        indirectEmissions: datum("480000", { canonicalUnit: "tCO2e", evidenceId: EV_PRECURSOR, reportingPeriod: "2026 ANNUAL" }),
        countryOfOrigin: datum("CN", { evidenceId: EV_PRECURSOR }),
      },
    ],
    carbonPriceRecords: [],
    evidenceRegister: [
      evidenceRecord(caseId, ownerId, { ...CUSTOMS_DOC(["76011010"], "SE555123456789", "CCA-DECL-2026-0001", "China Customs Authority"), evidenceId: EV_CUSTOMS }),
      evidenceRecord(caseId, ownerId, { ...REGISTRY_DOC("SAMR-REG-2026-0001", "State Administration for Market Regulation (China)", "Nordic Aluminium Import AB"), evidenceId: EV_REGISTRY }),
      evidenceRecord(caseId, ownerId, { ...productionSpec, evidenceId: EV_PRODUCTION }),
      evidenceRecord(caseId, ownerId, { ...BOUNDARY_DOC("MP-XJA-2026-v1", "MP-XJA-2026-v1", "Prebake anode electrolysis"), evidenceId: EV_BOUNDARY }),
      evidenceRecord(caseId, ownerId, { ...PERIOD_DOC("XJA-CLOSURE-2026-001"), evidenceId: EV_PERIOD }),
      evidenceRecord(caseId, ownerId, { ...GRID_DOC("NEA-GEF-2026", "National Energy Administration (NEA) China", "0.6201", "9000000"), evidenceId: EV_GRID }),
      evidenceRecord(caseId, ownerId, { ...INVOICE_DOC("NXPG-INV-2026-001", "Xinjiang Provincial Power Grid", "9000000"), evidenceId: EV_INVOICES }),
      evidenceRecord(caseId, ownerId, { ...DIRECT_DOC("XJA-DIRECT-2026-001", "1200000"), evidenceId: EV_DIRECT }),
      evidenceRecord(caseId, ownerId, { ...CALIBRATION_DOC("CNAS-CAL-2026-001", "CNAS-Accredited Metrology Laboratory"), evidenceId: EV_CALIBRATION }),
      evidenceRecord(caseId, ownerId, { ...PRECURSOR_DOC("SXA-COMM-2026-001", "Shanxi Alumina Refinery", "Calcined alumina (Al2O3)", "1200000", "240000", "480000", "CN"), evidenceId: EV_PRECURSOR }),
    ],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [
      acceptedDecision(
        "62000000-0000-4000-8000-000000000001",
        "DIRECT_ONLY_CERTIFICATE_BASIS",
        "Annex II certificate-relevant embedded emissions cover direct emissions only; indirect electricity is disclosed separately",
        "For Annex II treatment, the certificate-relevant result excludes electricity-based indirect emissions in line with the definitive ruleset.",
        "Regulation (EU) 2023/956 Annex II; Commission Implementing Regulation (EU) 2025/2547.",
        [EV_BOUNDARY]
      ),
      acceptedDecision(
        "62000000-0000-4000-8000-000000000002",
        "SYSTEM_BOUNDARY",
        "System boundary per installation monitoring plan MP-XJA-2026-v1 and process map",
        "Bauxite mining and alumina refining are outside the smelter boundary; precursor alumina enters as a declared precursor.",
        "Regulation (EU) 2023/956 Annex IV; monitoring-plan requirements.",
        [EV_BOUNDARY]
      ),
      acceptedDecision(
        "62000000-0000-4000-8000-000000000003",
        "GOODS_EMISSIONS_ALLOCATION",
        "Single declared good receives the full installation allocation (100% mass share)",
        "The smelter produces a single CN-coded good in the reporting period; the production ledger confirms the full-share allocation and reconciliation to 1.00.",
        "Commission Implementing Regulation (EU) 2025/2547 allocation provisions; supported by the reconciled production ledger.",
        [EV_PRODUCTION]
      ),
    ],
    verifierReserved: preparationInputs([
      { goodIndex: 0, cnCode: "76011010", materialityRate: 1.0 },
    ]),
    operatorSignOffs: signOffs(),
    auditEvents: [
      {
        eventId: "72000000-0000-4000-8000-000000000001",
        timestamp: "2027-01-31T00:00:00.000Z",
        actor: "sandbox-seeder",
        action: "FIXTURE_SEEDED",
      },
    ],
  };
  return caseData;
}

function fertiliserTrDossier(): AuditReadyCase {
  const ownerId = "sandbox-fertiliser-tr";
  const caseId = "case_fertiliser_tr_fixture";

  const EV_CUSTOMS = "13000000-0000-4000-8000-000000000001";
  const EV_REGISTRY = "13000000-0000-4000-8000-000000000002";
  const EV_PRODUCTION = "13000000-0000-4000-8000-000000000003";
  const EV_BOUNDARY = "13000000-0000-4000-8000-000000000004";
  const EV_PERIOD = "13000000-0000-4000-8000-000000000005";
  const EV_GRID = "13000000-0000-4000-8000-000000000006";
  const EV_INVOICES = "13000000-0000-4000-8000-000000000007";
  const EV_DIRECT = "13000000-0000-4000-8000-000000000008";
  const EV_CALIBRATION = "13000000-0000-4000-8000-000000000009";

  const productionSpec: EvidenceSpec = {
    evidenceId: "",
    documentType: "PRODUCTION_RECONCILIATION_REPORT",
    fileName: "ammonia-urea-production-ledger-2026.pdf",
    issuer: "Operator internal control (production ledger)",
    issuerCategory: "OPERATOR_CONTROLLED",
    documentAuthority: "OPERATOR",
    officialReference: "GFW-LEDGER-2026-001",
    issueDate: "2026-03-25",
    pageReference: "Ammonia/urea production ledger and mass balance",
    qualityGrade: "B",
    reviewerNotes: "Ammonia and urea production reconciles with the reformed-natural-gas mass balance; allocation shares sum to 1.00.",
    linkedInputs: [
      "goods.0.productionVolume",
      "goods.1.productionVolume",
      "goods.0.allocationShare",
      "goods.1.allocationShare",
      "installation.productionRoute",
      "installation.unloCode",
      "installation.latitude",
      "installation.longitude",
    ],
    sampleValues: {
      "Ammonia (t)": "300000",
      "Urea (t)": "400000",
      "Allocation shares": "0.35 / 0.65",
      "Route": "SMR to ammonia; urea via CO2 stripping",
    },
  };

  const caseData: AuditReadyCase = {
    caseId,
    status: "DRAFT",
    version: 1,
    ownerId,
    importerIdentity: {
      legalName: datum("AgroNord Import GmbH", { evidenceId: EV_REGISTRY }),
      eoriNumber: datum("DE87654321098", { evidenceId: EV_CUSTOMS }),
      address: datum("Hafenallee 22, 20457 Hamburg, Germany", { evidenceId: EV_REGISTRY }),
    },
    exporterIdentity: {
      legalName: datum("Gemlik Fertiliser Works A.S.", { evidenceId: EV_REGISTRY }),
      address: datum("Organize Sanayi Bölgesi, Gemlik, Bursa, Turkiye", { evidenceId: EV_REGISTRY }),
      registrationNumber: datum("TR-REG-55667788", { evidenceId: EV_REGISTRY }),
      contactPerson: datum("Zeynep Kaya"),
      contactEmail: datum("compliance@gemlikgubre.com.tr"),
      exporterCountry: datum("TR", { evidenceId: EV_REGISTRY }),
      operatorDeclaration: datum("Signed", { evidenceId: EV_REGISTRY }),
      preparerSignOff: datum("Signed", {}),
      internalReviewerSignOff: datum("Signed", {}),
    },
    reportingPeriod: {
      year: datum("2026", { evidenceId: EV_PERIOD }),
      quarter: datum("ANNUAL", { evidenceId: EV_PERIOD }),
      startDate: datum("2026-01-01", { evidenceId: EV_PERIOD }),
      endDate: datum("2026-12-31", { evidenceId: EV_PERIOD }),
    },
    goods: [
      {
        cnCode: datum("28141000", { evidenceId: EV_CUSTOMS }),
        sector: "FERTILISERS",
        productionVolume: datum("300000", { canonicalUnit: "t", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
        shipmentRecords: datum("Anhydrous ammonia, 2026 annual production", { evidenceId: EV_PRODUCTION }),
        allocationShare: datum("0.35", { canonicalUnit: "fraction", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
      },
      {
        cnCode: datum("31021000", { evidenceId: EV_CUSTOMS }),
        sector: "FERTILISERS",
        productionVolume: datum("400000", { canonicalUnit: "t", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
        shipmentRecords: datum("Urea, whether or not in aqueous solution, 2026 annual production", { evidenceId: EV_PRODUCTION }),
        allocationShare: datum("0.65", { canonicalUnit: "fraction", evidenceId: EV_PRODUCTION, reportingPeriod: "2026 ANNUAL" }),
      },
    ],
    installation: {
      name: datum("Gemlik Fertiliser Works A.S.", { evidenceId: EV_REGISTRY }),
      registryInstallationId: datum("TR-CBAM-INST-5001", { evidenceId: EV_REGISTRY }),
      unloCode: datum("TRGEM", { evidenceId: EV_PRODUCTION }),
      address: datum("Organize Sanayi Bölgesi, Gemlik, Bursa, Turkiye", { evidenceId: EV_REGISTRY }),
      latitude: datum("40.430330", { evidenceId: EV_PRODUCTION }),
      longitude: datum("29.135500", { evidenceId: EV_PRODUCTION }),
      country: datum("TR", { evidenceId: EV_REGISTRY }),
      productionRoute: datum("Steam methane reforming to ammonia; urea via carbon dioxide stripping", { evidenceId: EV_PRODUCTION }),
      systemBoundaries:
        "Boundary includes natural-gas feedstock reception, desulphurisation, steam methane reforming, shift conversion, CO2 removal, ammonia synthesis and urea synthesis. Natural gas is a feedstock, not a product.",
      excludedProcesses: "Downstream packaging and distribution depots",
      functionalUnits: "t of anhydrous ammonia and t of urea",
      installationDiagramEvidenceId: EV_BOUNDARY,
      monitoringPlanId: datum("MP-GFW-2026-v1", { evidenceId: EV_BOUNDARY }),
      monitoringPlanVersion: datum("v1", { evidenceId: EV_BOUNDARY }),
      monitoringPlanEffectiveDate: datum("2026-01-01", { evidenceId: EV_BOUNDARY }),
    },
    directEmissions: datum("780000", { canonicalUnit: "tCO2e", evidenceId: EV_DIRECT, reportingPeriod: "2026 ANNUAL", measurementMethod: "Reformer fuel ledger, natural-gas metering and process-emission factors", responsiblePerson: "Process emissions engineer" }),
    electricityConsumed: datum("280000", { canonicalUnit: "MWh", evidenceId: EV_GRID, reportingPeriod: "2026 ANNUAL", measurementMethod: "Site billing meters reconciled to national grid operator statements", responsiblePerson: "Energy manager" }),
    gridEmissionFactor: datum("0.4344", { canonicalUnit: "tCO2e/MWh", evidenceId: EV_GRID, reportingPeriod: "2026 ANNUAL", measurementMethod: "Official national grid factor publication for the reporting year", responsiblePerson: "Energy manager" }),
    precursors: [],
    carbonPriceRecords: [],
    evidenceRegister: [
      evidenceRecord(caseId, ownerId, { ...CUSTOMS_DOC(["28141000", "31021000"], "DE87654321098", "TCA-DECL-2026-0001", "Turkish Customs Administration"), evidenceId: EV_CUSTOMS }),
      evidenceRecord(caseId, ownerId, { ...REGISTRY_DOC("TRTIC-REG-2026-0001", "Turkish Trade Registry Gazette", "AgroNord Import GmbH"), evidenceId: EV_REGISTRY }),
      evidenceRecord(caseId, ownerId, { ...productionSpec, evidenceId: EV_PRODUCTION }),
      evidenceRecord(caseId, ownerId, { ...BOUNDARY_DOC("MP-GFW-2026-v1", "MP-GFW-2026-v1", "Steam methane reforming; urea via CO2 stripping"), evidenceId: EV_BOUNDARY }),
      evidenceRecord(caseId, ownerId, { ...PERIOD_DOC("GFW-CLOSURE-2026-001"), evidenceId: EV_PERIOD }),
      evidenceRecord(caseId, ownerId, { ...GRID_DOC("TEIAS-GEF-2026", "Turkish Electricity Transmission Corporation (TEIAS)", "0.4344", "280000"), evidenceId: EV_GRID }),
      evidenceRecord(caseId, ownerId, { ...INVOICE_DOC("TEIAS-INV-2026-001", "Turkish Electricity Transmission Corporation (TEIAS)", "280000"), evidenceId: EV_INVOICES }),
      evidenceRecord(caseId, ownerId, { ...DIRECT_DOC("GFW-DIRECT-2026-001", "780000"), evidenceId: EV_DIRECT }),
      evidenceRecord(caseId, ownerId, { ...CALIBRATION_DOC("TURKAK-CAL-2026-001", "TURKAK-Accredited Calibration Laboratory"), evidenceId: EV_CALIBRATION }),
    ],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [
      acceptedDecision(
        "63000000-0000-4000-8000-000000000001",
        "PRECURSOR_SCOPE",
        "No separate precursor goods are declared; natural gas enters as feedstock inside the boundary",
        "Natural gas is consumed as feedstock and fuel within the controlled boundary, not declared as a separate precursor good.",
        "Regulation (EU) 2023/956 Annex IV precursor rules; supported by the reformer mass balance.",
        [EV_PRODUCTION]
      ),
      acceptedDecision(
        "63000000-0000-4000-8000-000000000002",
        "GOODS_EMISSIONS_ALLOCATION",
        "Allocate installation emissions by documented product mass shares (0.35 / 0.65)",
        "Ammonia and urea share the same reforming boundary; the reconciled product ledger provides complete mass shares summing to one.",
        "Commission Implementing Regulation (EU) 2025/2547 allocation provisions; supported by the production ledger.",
        [EV_PRODUCTION]
      ),
      acceptedDecision(
        "63000000-0000-4000-8000-000000000003",
        "SYSTEM_BOUNDARY",
        "System boundary per installation monitoring plan MP-GFW-2026-v1 and process map",
        "The boundary includes reforming and synthesis units and excludes downstream packaging and distribution depots.",
        "Regulation (EU) 2023/956 Annex IV; monitoring-plan requirements.",
        [EV_BOUNDARY]
      ),
    ],
    verifierReserved: preparationInputs([
      { goodIndex: 0, cnCode: "28141000", materialityRate: 0.35 },
      { goodIndex: 1, cnCode: "31021000", materialityRate: 0.65 },
    ]),
    operatorSignOffs: signOffs(),
    auditEvents: [
      {
        eventId: "73000000-0000-4000-8000-000000000001",
        timestamp: "2027-01-31T00:00:00.000Z",
        actor: "sandbox-seeder",
        action: "FIXTURE_SEEDED",
      },
    ],
  };
  return caseData;
}

const DOSSIER_BUILDERS: Record<FourDossierKey, () => AuditReadyCase> = {
  STEEL_IN: steelInDossier,
  CEMENT_EG: cementEgDossier,
  ALU_CN: aluCnDossier,
  FERTILISER_TR: fertiliserTrDossier,
};

export function createFourDossierCase(key: FourDossierKey): AuditReadyCase {
  return DOSSIER_BUILDERS[key]();
}

export function fourDossierCaseId(key: FourDossierKey): string {
  return DOSSIER_BUILDERS[key]().caseId ?? "";
}

/**
 * Deterministic synthetic PDF evidence for every evidence record in a dossier.
 * Hydrates fileHash/sizeBytes from the generated bytes and returns the bytes in
 * the order of evidenceRegister so the verifier package can embed them.
 */
export async function buildFourDossierEvidenceFiles(
  caseData: AuditReadyCase
): Promise<EvidenceBinary[]> {
  const files: EvidenceBinary[] = [];
  for (const record of caseData.evidenceRegister) {
    const spec = syntheticSpecForRecord(caseData, record);
    const bytes = await buildSyntheticEvidencePdf(spec);
    record.fileHash = syntheticSha256(bytes);
    record.sizeBytes = bytes.byteLength;
    files.push({ evidenceId: record.evidenceId, fileName: record.fileName, bytes });
  }
  return files;
}

export function syntheticSpecForRecord(
  caseData: AuditReadyCase,
  record: EvidenceRecord
): SyntheticDocumentSpec {
  return {
    title: record.fileName.replace(/\.pdf$/i, "").replace(/-/g, " "),
    documentType: record.documentType,
    issuer: record.issuer,
    issuerCategory: record.issuerCategory ?? "OPERATOR_CONTROLLED",
    documentAuthority: record.documentAuthority ?? "OPERATOR",
    officialReference: record.officialReference ?? record.fileName,
    reference: record.fileName,
    issueDate: record.issueDate,
    reportingPeriod: record.reportingPeriod || FOUR_DOSSIER_PERIOD,
    caseId: caseData.caseId ?? "",
    supportedInputPaths: record.linkedInputs,
    sampleValues: {
      "Document type": record.documentType,
      "Quality grade": record.qualityGrade ?? "PENDING",
      ...(record.linkedInputs.length > 0
        ? { "Supported inputs": record.linkedInputs.join(", ") }
        : {}),
    },
    periodCovered: `${record.evidencePeriodStart ?? "2026-01-01"} to ${record.evidencePeriodEnd ?? "2026-12-31"}`,
  };
}
