import { createHash } from "node:crypto";
import type { AuditReadyCase } from "../../functions/src/cbam/schema";
import type { EvidenceBinary } from "../../functions/src/cbam/report/verifier-package-builder";

export const FIXTURE_OWNER_ID = "verifier-grade-user";
export const FIXTURE_CASE_ID = "case_verifier_grade_fixture";

export const EVIDENCE_1_ID = "11111111-1111-4111-8111-222222222222";
export const EVIDENCE_2_ID = "11111111-1111-4111-8111-333333333333";
export const EVIDENCE_3_ID = "11111111-1111-4111-8111-444444444444";
export const FIXTURE_EVIDENCE_ID = "11111111-1111-4111-8111-555555555555";

export const FIXTURE_GENERATED_AT = "2027-01-15T12:00:00.000Z";
export const FIXTURE_REPORT_ID = `report_${"a".repeat(64)}`;

export const FIXTURE_EVIDENCE_BYTES = Buffer.from(
  "CBAMValid verifier-grade fixture evidence: monitored production, emissions, electricity, customs classification and allocation records.",
  "utf8"
);
export const FIXTURE_EVIDENCE_HASH = createHash("sha256")
  .update(FIXTURE_EVIDENCE_BYTES)
  .digest("hex");

export const EVIDENCE_1_BYTES = Buffer.from(
  "Customs classification and declaration records showing EORI NL123456789AB and CBAM CN codes.",
  "utf8"
);
export const EVIDENCE_1_HASH = createHash("sha256").update(EVIDENCE_1_BYTES).digest("hex");

export const EVIDENCE_2_BYTES = Buffer.from(
  "Electricity utility billing invoice for 100 MWh and grid emission factor reference value of 0.4 tCO2e/MWh.",
  "utf8"
);
export const EVIDENCE_2_HASH = createHash("sha256").update(EVIDENCE_2_BYTES).digest("hex");

export const EVIDENCE_3_BYTES = Buffer.from(
  "Reconciled production ledger for iron & steel goods (60t at 0.6 share, 40t at 0.4 share).",
  "utf8"
);
export const EVIDENCE_3_HASH = createHash("sha256").update(EVIDENCE_3_BYTES).digest("hex");

function datum(
  value: string,
  canonicalUnit?: string,
  evidenceId: string | undefined = FIXTURE_EVIDENCE_ID
) {
  return {
    value,
    ...(canonicalUnit ? { canonicalUnit } : {}),
    sourceType: "PRIMARY" as const,
    confidenceStatus: "HIGH_VERIFIED" as const,
    ...(evidenceId ? { evidenceId } : {}),
    documentReference: "Verified monitoring package, controlled record V1",
    measurementMethod: "Documented direct measurement and reconciled production ledger",
    responsiblePerson: "Installation monitoring manager",
  };
}

export function createVerifierGradeCase(): AuditReadyCase {
  return {
    caseId: FIXTURE_CASE_ID,
    status: "DRAFT",
    version: 1,
    ownerId: FIXTURE_OWNER_ID,
    importerIdentity: {
      legalName: datum("CBAMValid Importer B.V.", undefined, undefined),
      eoriNumber: datum("NL123456789AB", undefined, EVIDENCE_1_ID),
      address: datum("Rotterdam, Netherlands", undefined, undefined),
    },
    exporterIdentity: {
      legalName: datum("Verified Steel Operator GmbH", undefined, undefined),
      address: datum("Duisburg, Germany", undefined, undefined),
    },
    reportingPeriod: {
      year: datum("2026", undefined, undefined),
      quarter: datum("Q1", undefined, undefined),
    },
    goods: [
      {
        cnCode: datum("72011011", undefined, EVIDENCE_1_ID),
        sector: "IRON_AND_STEEL",
        productionVolume: datum("60", "t", EVIDENCE_3_ID),
        shipmentRecords: datum("60", "t", undefined),
        allocationShare: datum("0.6", "fraction", EVIDENCE_3_ID),
      },
      {
        cnCode: datum("72011019", undefined, EVIDENCE_1_ID),
        sector: "IRON_AND_STEEL",
        productionVolume: datum("40", "t", EVIDENCE_3_ID),
        shipmentRecords: datum("40", "t", undefined),
        allocationShare: datum("0.4", "fraction", EVIDENCE_3_ID),
      },
    ],
    installation: {
      name: datum("Verified Integrated Steel Installation", undefined, undefined),
      unloCode: datum("DEDUI", undefined, undefined),
      country: datum("DE", undefined, undefined),
      productionRoute: datum("Blast Furnace Route (BF-BOF)", undefined, undefined),
      systemBoundaries:
        "Coke preparation, sinter plant, blast furnace, basic oxygen furnace, casting and finishing operations within the controlled installation boundary.",
    },
    directEmissions: datum("80", "tCO2e", FIXTURE_EVIDENCE_ID),
    electricityConsumed: datum("100", "MWh", EVIDENCE_2_ID),
    gridEmissionFactor: datum("0.4", "tCO2e/MWh", EVIDENCE_2_ID),
    precursors: [],
    carbonPriceRecords: [],
    evidenceRegister: [
      {
        evidenceId: EVIDENCE_1_ID,
        documentType: "CUSTOMS_DECLARATION",
        fileName: "customs-declaration-classification.txt",
        storagePath: `evidence/${FIXTURE_OWNER_ID}/${FIXTURE_CASE_ID}/${EVIDENCE_1_ID}/customs-declaration-classification.txt`,
        mimeType: "text/plain",
        sizeBytes: EVIDENCE_1_BYTES.byteLength,
        issuer: "Customs Authority",
        issueDate: "2026-03-31",
        reportingPeriod: "2026-Q1",
        pageReference: "Page 1 of declaration",
        fileHash: EVIDENCE_1_HASH,
        uploadTimestamp: "2026-04-01T00:00:00.000Z",
        uploader: FIXTURE_OWNER_ID,
        reviewStatus: "APPROVED",
        supportStatus: "SUPPORTED",
        malwareScanStatus: "CLEAN",
        confidentiality: "CONFIDENTIAL",
        linkedInputs: [
          "importerIdentity.eoriNumber",
          "goods.0.cnCode",
          "goods.1.cnCode",
        ],
        linkedCalculations: [],
        reviewerNotes: "Verified customs classification and importer EORI records.",
      },
      {
        evidenceId: EVIDENCE_2_ID,
        documentType: "UTILITY_BILL",
        fileName: "electricity-utility-invoice.txt",
        storagePath: `evidence/${FIXTURE_OWNER_ID}/${FIXTURE_CASE_ID}/${EVIDENCE_2_ID}/electricity-utility-invoice.txt`,
        mimeType: "text/plain",
        sizeBytes: EVIDENCE_2_BYTES.byteLength,
        issuer: "National Power Utility",
        issueDate: "2026-03-31",
        reportingPeriod: "2026-Q1",
        pageReference: "Billing line items 1-4",
        fileHash: EVIDENCE_2_HASH,
        uploadTimestamp: "2026-04-01T00:00:00.000Z",
        uploader: FIXTURE_OWNER_ID,
        reviewStatus: "APPROVED",
        supportStatus: "SUPPORTED",
        malwareScanStatus: "CLEAN",
        confidentiality: "CONFIDENTIAL",
        linkedInputs: [
          "electricityConsumed",
          "gridEmissionFactor",
        ],
        linkedCalculations: ["CBAM_INDIRECT_EMISSIONS"],
        reviewerNotes: "Electricity consumption matches utility utility billing invoices.",
      },
      {
        evidenceId: EVIDENCE_3_ID,
        documentType: "PRODUCTION_RECONCILIATION_REPORT",
        fileName: "production-reconciliation-ledger.txt",
        storagePath: `evidence/${FIXTURE_OWNER_ID}/${FIXTURE_CASE_ID}/${EVIDENCE_3_ID}/production-reconciliation-ledger.txt`,
        mimeType: "text/plain",
        sizeBytes: EVIDENCE_3_BYTES.byteLength,
        issuer: "Internal Production Auditor",
        issueDate: "2026-03-31",
        reportingPeriod: "2026-Q1",
        pageReference: "Mass balance ledger lines 24-28",
        fileHash: EVIDENCE_3_HASH,
        uploadTimestamp: "2026-04-01T00:00:00.000Z",
        uploader: FIXTURE_OWNER_ID,
        reviewStatus: "APPROVED",
        supportStatus: "SUPPORTED",
        malwareScanStatus: "CLEAN",
        confidentiality: "CONFIDENTIAL",
        linkedInputs: [
          "goods.0.productionVolume",
          "goods.0.allocationShare",
          "goods.1.productionVolume",
          "goods.1.allocationShare",
        ],
        linkedCalculations: [
          "CBAM_GOOD_EMISSIONS_ALLOCATION_1",
          "CBAM_GOOD_EMISSIONS_ALLOCATION_2",
          "CBAM_GOODS_ALLOCATION_RECONCILIATION",
        ],
        reviewerNotes: "Approved production volume and allocation shares.",
      },
      {
        evidenceId: FIXTURE_EVIDENCE_ID,
        documentType: "PRIMARY_MONITORING_AND_CUSTOMS_PACKAGE",
        fileName: "verified-monitoring-package.txt",
        storagePath: `evidence/${FIXTURE_OWNER_ID}/${FIXTURE_CASE_ID}/${FIXTURE_EVIDENCE_ID}/verified-monitoring-package.txt`,
        mimeType: "text/plain",
        sizeBytes: FIXTURE_EVIDENCE_BYTES.byteLength,
        issuer: "Independent Monitoring Auditor",
        issueDate: "2026-03-31",
        reportingPeriod: "2026-Q1",
        pageReference: "Controlled package pages 1-48",
        fileHash: FIXTURE_EVIDENCE_HASH,
        uploadTimestamp: "2026-04-01T00:00:00.000Z",
        uploader: FIXTURE_OWNER_ID,
        reviewStatus: "APPROVED",
        supportStatus: "SUPPORTED",
        malwareScanStatus: "CLEAN",
        confidentiality: "CONFIDENTIAL",
        linkedInputs: [
          "directEmissions",
        ],
        linkedCalculations: [
          "CBAM_TOTAL_EMBEDDED_EMISSIONS",
        ],
        reviewerNotes:
          "Approved for the verifier-preparation package after ownership, period, hash, content and control linkage review.",
      },
    ],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [
      {
        decisionId: "22222222-2222-4222-8222-222222222222",
        topic: "PRECURSOR_SCOPE",
        selectedMethod: "No qualifying precursor line is declared for the fixture goods and controlled route.",
        reason: "The controlled bill of materials and production route contain no separate precursor goods requiring an additional precursor line in this fixture.",
        legalOrTechnicalBasis:
          "Regulation (EU) 2023/956 Annex IV and Commission Implementing Regulation (EU) 2025/2547; supported by the controlled bill of materials.",
        evidenceIds: [FIXTURE_EVIDENCE_ID],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
      {
        decisionId: "33333333-3333-4333-8333-333333333333",
        topic: "GOODS_EMISSIONS_ALLOCATION",
        selectedMethod: "Allocate installation emissions using documented product mass shares of 0.6 and 0.4.",
        reason: "The two goods are produced in the same controlled period and the reconciled product ledger provides complete mass shares summing to one.",
        legalOrTechnicalBasis:
          "Commission Implementing Regulation (EU) 2025/2547 allocation and monitoring-plan requirements; controlled production ledger.",
        evidenceIds: [EVIDENCE_3_ID],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
    ],
    auditEvents: [
      {
        eventId: "44444444-4444-4444-8444-444444444444",
        timestamp: "2026-04-01T00:00:00.000Z",
        actor: FIXTURE_OWNER_ID,
        action: "CASE_CREATED",
      },
    ],
  };
}

export function createVerifierEvidenceFiles(): EvidenceBinary[] {
  return [
    {
      evidenceId: EVIDENCE_1_ID,
      fileName: "customs-declaration-classification.txt",
      bytes: EVIDENCE_1_BYTES,
    },
    {
      evidenceId: EVIDENCE_2_ID,
      fileName: "electricity-utility-invoice.txt",
      bytes: EVIDENCE_2_BYTES,
    },
    {
      evidenceId: EVIDENCE_3_ID,
      fileName: "production-reconciliation-ledger.txt",
      bytes: EVIDENCE_3_BYTES,
    },
    {
      evidenceId: FIXTURE_EVIDENCE_ID,
      fileName: "verified-monitoring-package.txt",
      bytes: FIXTURE_EVIDENCE_BYTES,
    },
  ];
}
