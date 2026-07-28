#!/usr/bin/env node
/**
 * Owner/admin seed: three hard, sector-differentiated CBAM working files
 * for teb232@gmail.com (production project cbam-desk).
 *
 * Usage:
 *   DRY_RUN=1 node scripts/seed-teb232-stress-cases.mjs   # default: print plan
 *   EXECUTE=1 node scripts/seed-teb232-stress-cases.mjs  # write Firestore + Storage
 */
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";

const EMAIL = "teb232@gmail.com";
const UID_KNOWN = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
const EXECUTE = process.env.EXECUTE === "1";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const raw = readFileSync(path, "utf8");
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function deriveCaseIdentity(uid, requestId) {
  const digest = createHash("sha256").update(`${uid}\u0000${requestId}`).digest("hex");
  return { digest, caseId: `case_${digest}`, requestId };
}

function datum(value, canonicalUnit, evidenceId, extras = {}) {
  return {
    value: String(value),
    ...(canonicalUnit ? { canonicalUnit } : {}),
    sourceType: "PRIMARY",
    confidenceStatus: "HIGH_VERIFIED",
    ...(evidenceId ? { evidenceId } : {}),
    documentReference: extras.documentReference || "Operator-controlled monitoring package, stress seed V1",
    measurementMethod: extras.measurementMethod || "Documented measurement / reconciled ledger",
    responsiblePerson: extras.responsiblePerson || "Installation monitoring manager",
  };
}

function pdfBytes(label) {
  // Distinct PDF-like payloads (unique hashes). Not a visual PDF — storage/hash/path contract only.
  return Buffer.from(
    `%PDF-1.4\n% CBAMValid stress evidence\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n${label}\n${randomUUID()}\n`,
    "utf8"
  );
}

function evidenceRecord({
  evidenceId,
  caseId,
  uid,
  documentType,
  fileName,
  bytes,
  issuer,
  issueDate,
  reportingPeriod,
  linkedInputs,
  linkedCalculations = [],
  reviewerNotes,
}) {
  const storagePath = `evidence/${uid}/${caseId}/${evidenceId}/${fileName}`;
  return {
    evidenceId,
    documentType,
    fileName,
    storagePath,
    mimeType: "application/pdf",
    sizeBytes: bytes.byteLength,
    issuer,
    issueDate,
    reportingPeriod,
    pageReference: "Pages 1-N",
    fileHash: sha256(bytes),
    uploadTimestamp: "2026-04-15T12:00:00.000Z",
    uploader: uid,
    reviewStatus: "APPROVED",
    supportStatus: "SUPPORTED",
    malwareScanStatus: "CLEAN",
    confidentiality: "CONFIDENTIAL",
    linkedInputs,
    linkedCalculations,
    reviewerNotes,
    _bytes: bytes,
  };
}

/** Deterministic request IDs → stable caseIds (re-run safe). */
const SCENARIOS = [
  {
    key: "STEEL_IN",
    requestId: "a1111111-1111-4111-8111-000000000001",
    title: "STRESS Steel BF-BOF India — 3 goods + HBI precursor + Art.9 carbon price",
  },
  {
    key: "CEMENT_EG",
    requestId: "a1111111-1111-4111-8111-000000000002",
    title: "STRESS Cement dry-kiln Egypt — mega plant, Annex I priced SEE, 2 goods",
  },
  {
    key: "ALU_CN",
    requestId: "a1111111-1111-4111-8111-000000000003",
    title: "STRESS Aluminium primary China — electrolytic + PFC/CO2, huge power, alumina precursor",
  },
];

function buildSteel(uid, caseId) {
  const ids = {
    customs: "b1111111-1111-4111-8111-000000000101",
    power: "b1111111-1111-4111-8111-000000000102",
    production: "b1111111-1111-4111-8111-000000000103",
    direct: "b1111111-1111-4111-8111-000000000104",
    precursor: "b1111111-1111-4111-8111-000000000105",
    carbon: "b1111111-1111-4111-8111-000000000106",
    calibration: "b1111111-1111-4111-8111-000000000107",
  };

  const evidence = [
    evidenceRecord({
      evidenceId: ids.customs,
      caseId,
      uid,
      documentType: "CUSTOMS_DECLARATION",
      fileName: "in-customs-cn-eori-pack.pdf",
      bytes: pdfBytes("steel-customs"),
      issuer: "Indian Customs / Importer EORI desk",
      issueDate: "2026-03-31",
      reportingPeriod: "2026",
      linkedInputs: [
        "importerIdentity.eoriNumber",
        "goods.0.cnCode",
        "goods.1.cnCode",
        "goods.2.cnCode",
      ],
      reviewerNotes: "CN classification and importer EORI verified against declaration pack.",
    }),
    evidenceRecord({
      evidenceId: ids.power,
      caseId,
      uid,
      documentType: "UTILITY_BILL",
      fileName: "in-grid-power-48gwh.pdf",
      bytes: pdfBytes("steel-power"),
      issuer: "State Electricity Distribution Co.",
      issueDate: "2026-12-31",
      reportingPeriod: "2026",
      linkedInputs: ["electricityConsumed", "gridEmissionFactor"],
      linkedCalculations: ["CBAM_INDIRECT_EMISSIONS"],
      reviewerNotes: "48 GWh billed; grid factor 0.82 tCO2e/MWh from published supplier disclosure.",
    }),
    evidenceRecord({
      evidenceId: ids.production,
      caseId,
      uid,
      documentType: "PRODUCTION_RECONCILIATION_REPORT",
      fileName: "in-steel-mass-balance-3goods.pdf",
      bytes: pdfBytes("steel-production"),
      issuer: "Plant mass-balance auditor",
      issueDate: "2027-01-10",
      reportingPeriod: "2026",
      linkedInputs: [
        "goods.0.productionVolume",
        "goods.1.productionVolume",
        "goods.2.productionVolume",
        "goods.0.allocationShare",
        "goods.1.allocationShare",
        "goods.2.allocationShare",
      ],
      linkedCalculations: [
        "CBAM_GOOD_EMISSIONS_ALLOCATION_1",
        "CBAM_GOOD_EMISSIONS_ALLOCATION_2",
        "CBAM_GOOD_EMISSIONS_ALLOCATION_3",
        "CBAM_GOODS_ALLOCATION_RECONCILIATION",
      ],
      reviewerNotes: "Three-product mass balance: 0.45 / 0.32 / 0.23 shares reconcile to 1.000.",
    }),
    evidenceRecord({
      evidenceId: ids.direct,
      caseId,
      uid,
      documentType: "PRIMARY_MONITORING_AND_CUSTOMS_PACKAGE",
      fileName: "in-bf-bof-direct-emissions-ledger.pdf",
      bytes: pdfBytes("steel-direct"),
      issuer: "Independent monitoring auditor",
      issueDate: "2027-01-12",
      reportingPeriod: "2026",
      linkedInputs: ["directEmissions"],
      linkedCalculations: ["CBAM_TOTAL_EMBEDDED_EMISSIONS"],
      reviewerNotes: "Stack CEMS + process carbonates reconciled to 12,500 tCO2e direct.",
    }),
    evidenceRecord({
      evidenceId: ids.precursor,
      caseId,
      uid,
      documentType: "SUPPLIER_EMISSIONS_DECLARATION",
      fileName: "hbi-precursor-embedded-emissions.pdf",
      bytes: pdfBytes("steel-precursor"),
      issuer: "HBI supplier monitoring desk",
      issueDate: "2026-11-30",
      reportingPeriod: "2026",
      linkedInputs: [
        "precursors.0.quantity",
        "precursors.0.directEmissions",
        "precursors.0.indirectEmissions",
      ],
      reviewerNotes: "Imported HBI precursor quantity and embedded emissions accepted.",
    }),
    evidenceRecord({
      evidenceId: ids.carbon,
      caseId,
      uid,
      documentType: "CARBON_PRICE_PAYMENT_PROOF",
      fileName: "in-ets-like-carbon-price-paid.pdf",
      bytes: pdfBytes("steel-carbon"),
      issuer: "National carbon pricing authority",
      issueDate: "2026-12-20",
      reportingPeriod: "2026",
      linkedInputs: ["directEmissions"],
      reviewerNotes: "Art.9 carbon price paid proof for 2,400 tCO2e eligible reduction.",
    }),
    evidenceRecord({
      evidenceId: ids.calibration,
      caseId,
      uid,
      documentType: "CALIBRATION_CERTIFICATE",
      fileName: "meter-calibration-fuel-power.pdf",
      bytes: pdfBytes("steel-cal"),
      issuer: "NABL accredited calibration lab",
      issueDate: "2026-01-20",
      reportingPeriod: "2026",
      linkedInputs: ["directEmissions", "electricityConsumed"],
      reviewerNotes: "Fuel and electricity meters calibrated for 2026 reporting year.",
    }),
  ];

  const data = {
    status: "DRAFT",
    version: 1,
    caseId,
    ownerId: uid,
    importerIdentity: {
      legalName: datum("Nordic Steel Trading GmbH", undefined, undefined),
      eoriNumber: datum("DE8123456789012", undefined, ids.customs),
      address: datum("Hamburg, Germany", undefined, undefined),
    },
    exporterIdentity: {
      legalName: datum("STRESS JSW Eastern Works Pvt Ltd", undefined, undefined),
      address: datum("Paradip, Odisha, India", undefined, undefined),
    },
    reportingPeriod: {
      year: datum("2026", undefined, undefined),
      quarter: datum("ANNUAL", undefined, undefined),
    },
    goods: [
      {
        cnCode: datum("72011011", undefined, ids.customs),
        sector: "IRON_AND_STEEL",
        productionVolume: datum("54000", "t", ids.production),
        shipmentRecords: datum("54000", "t", undefined),
        allocationShare: datum("0.45", "fraction", ids.production),
      },
      {
        cnCode: datum("72044900", undefined, ids.customs),
        sector: "IRON_AND_STEEL",
        productionVolume: datum("38400", "t", ids.production),
        shipmentRecords: datum("38400", "t", undefined),
        allocationShare: datum("0.32", "fraction", ids.production),
      },
      {
        cnCode: datum("73089098", undefined, ids.customs),
        sector: "IRON_AND_STEEL",
        productionVolume: datum("27600", "t", ids.production),
        shipmentRecords: datum("27600", "t", undefined),
        allocationShare: datum("0.23", "fraction", ids.production),
      },
    ],
    installation: {
      name: datum("Paradip Integrated BF-BOF Complex", undefined, undefined),
      unloCode: datum("INPRT", undefined, undefined),
      country: datum("IN", undefined, undefined),
      productionRoute: datum("Blast Furnace — Basic Oxygen Furnace (BF-BOF) with sinter & coke plant", undefined, undefined),
      systemBoundaries:
        "Coke ovens, sinter strand, blast furnaces 1-3, BOF shop, continuous casting, hot strip mill, on-site power island and waste-gas recovery within the controlled installation fence. Off-site mining and downstream coating lines excluded.",
    },
    directEmissions: datum("12500", "tCO2e", ids.direct),
    electricityConsumed: datum("48000", "MWh", ids.power),
    gridEmissionFactor: datum("0.82", "tCO2e/MWh", ids.power),
    precursors: [
      {
        name: datum("Hot Briquetted Iron (HBI)", undefined, undefined),
        quantity: datum("18500", "t", ids.precursor),
        directEmissions: datum("9200", "tCO2e", ids.precursor),
        indirectEmissions: datum("2100", "tCO2e", ids.precursor),
        countryOfOrigin: datum("AE", undefined, undefined),
      },
    ],
    carbonPriceRecords: [
      {
        id: "c1111111-1111-4111-8111-000000000201",
        amountPaid: "1860000",
        applicableEmissions: "2400",
        currency: "EUR",
        paymentPeriod: "2026",
        legislationReference: "India carbon credit trading scheme — Art.9 CBAM adjustment stress record",
        proofOfPaymentEvidenceId: ids.carbon,
        eligibleCertificateReduction: "2400",
      },
    ],
    evidenceRegister: evidence.map((item) => {
      const rest = { ...item };
      delete rest._bytes;
      return rest;
    }),
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [
      {
        decisionId: "d1111111-1111-4111-8111-000000000301",
        topic: "PRECURSOR_SCOPE",
        selectedMethod: "Include imported HBI as a qualifying precursor line with supplier actuals.",
        reason: "HBI is consumed in the BF-BOF route and carries material embedded emissions that must not be omitted.",
        legalOrTechnicalBasis:
          "Regulation (EU) 2023/956 Annex IV and Commission Implementing Regulation (EU) 2025/2547 precursor rules; supplier declaration package.",
        evidenceIds: [ids.precursor],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
      {
        decisionId: "d1111111-1111-4111-8111-000000000302",
        topic: "GOODS_EMISSIONS_ALLOCATION",
        selectedMethod: "Allocate installation emissions by reconciled product mass shares 0.45 / 0.32 / 0.23 across three CN lines.",
        reason: "Three CBAM goods share the same BF-BOF boundary in one annual period; mass balance closes to 1.000.",
        legalOrTechnicalBasis:
          "Commission Implementing Regulation (EU) 2025/2547 allocation requirements; plant mass-balance ledger.",
        evidenceIds: [ids.production],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
    ],
    operatorSignOffs: [
      { role: "OPERATOR_PREPARER", name: "Ravi Prep", title: "CBAM Data Preparer", signedAt: "2027-01-14T09:00:00.000Z" },
      { role: "INTERNAL_REVIEWER", name: "Priya Review", title: "Internal Reviewer", signedAt: "2027-01-15T09:00:00.000Z" },
      { role: "DATA_OWNER", name: "Anil Owner", title: "Installation Manager", signedAt: "2027-01-16T09:00:00.000Z" },
    ],
    auditEvents: [
      {
        eventId: "e1111111-1111-4111-8111-000000000401",
        timestamp: "2027-01-16T10:00:00.000Z",
        actor: uid,
        action: "STRESS_SEED_LOADED",
        metadata: { scenario: "STEEL_IN", seed: "teb232-stress-v1" },
      },
    ],
  };

  return { data, evidence };
}

function buildCement(uid, caseId) {
  const ids = {
    customs: "b2111111-1111-4111-8111-000000000101",
    power: "b2111111-1111-4111-8111-000000000102",
    production: "b2111111-1111-4111-8111-000000000103",
    direct: "b2111111-1111-4111-8111-000000000104",
    carbon: "b2111111-1111-4111-8111-000000000105",
    calibration: "b2111111-1111-4111-8111-000000000106",
  };

  const evidence = [
    evidenceRecord({
      evidenceId: ids.customs,
      caseId,
      uid,
      documentType: "CUSTOMS_DECLARATION",
      fileName: "eg-cement-cn-eori.pdf",
      bytes: pdfBytes("cement-customs"),
      issuer: "Egyptian Customs / EU importer desk",
      issueDate: "2026-06-30",
      reportingPeriod: "2026",
      linkedInputs: ["importerIdentity.eoriNumber", "goods.0.cnCode", "goods.1.cnCode"],
      reviewerNotes: "Portland and white cement CN codes confirmed.",
    }),
    evidenceRecord({
      evidenceId: ids.power,
      caseId,
      uid,
      documentType: "UTILITY_BILL",
      fileName: "eg-kiln-power-210gwh.pdf",
      bytes: pdfBytes("cement-power"),
      issuer: "EEHC / industrial tariff desk",
      issueDate: "2026-12-31",
      reportingPeriod: "2026",
      linkedInputs: ["electricityConsumed", "gridEmissionFactor"],
      linkedCalculations: ["CBAM_INDIRECT_EMISSIONS"],
      reviewerNotes: "210 GWh plant power; grid factor 0.55 tCO2e/MWh.",
    }),
    evidenceRecord({
      evidenceId: ids.production,
      caseId,
      uid,
      documentType: "PRODUCTION_RECONCILIATION_REPORT",
      fileName: "eg-clinker-cement-mass-balance.pdf",
      bytes: pdfBytes("cement-production"),
      issuer: "Plant process accountant",
      issueDate: "2027-01-08",
      reportingPeriod: "2026",
      linkedInputs: [
        "goods.0.productionVolume",
        "goods.1.productionVolume",
        "goods.0.allocationShare",
        "goods.1.allocationShare",
      ],
      linkedCalculations: [
        "CBAM_GOOD_EMISSIONS_ALLOCATION_1",
        "CBAM_GOOD_EMISSIONS_ALLOCATION_2",
        "CBAM_GOODS_ALLOCATION_RECONCILIATION",
      ],
      reviewerNotes: "Allocation 0.78 / 0.22 by cementitious product mass.",
    }),
    evidenceRecord({
      evidenceId: ids.direct,
      caseId,
      uid,
      documentType: "PRIMARY_MONITORING_AND_CUSTOMS_PACKAGE",
      fileName: "eg-kiln-calcination-cems.pdf",
      bytes: pdfBytes("cement-direct"),
      issuer: "Independent kiln monitoring auditor",
      issueDate: "2027-01-11",
      reportingPeriod: "2026",
      linkedInputs: ["directEmissions"],
      linkedCalculations: ["CBAM_TOTAL_EMBEDDED_EMISSIONS"],
      reviewerNotes: "Calcination + fuel CO2 reconciled to 890,000 tCO2e direct (mega plant).",
    }),
    evidenceRecord({
      evidenceId: ids.carbon,
      caseId,
      uid,
      documentType: "CARBON_PRICE_PAYMENT_PROOF",
      fileName: "eg-carbon-levy-paid.pdf",
      bytes: pdfBytes("cement-carbon"),
      issuer: "Egyptian Environmental Affairs Agency",
      issueDate: "2026-12-15",
      reportingPeriod: "2026",
      linkedInputs: ["directEmissions"],
      reviewerNotes: "Domestic carbon levy paid; Art.9 eligible reduction 35,000 tCO2e.",
    }),
    evidenceRecord({
      evidenceId: ids.calibration,
      caseId,
      uid,
      documentType: "CALIBRATION_CERTIFICATE",
      fileName: "eg-kiln-meter-calibration.pdf",
      bytes: pdfBytes("cement-cal"),
      issuer: "EGAC accredited metrology lab",
      issueDate: "2026-02-01",
      reportingPeriod: "2026",
      linkedInputs: ["directEmissions", "electricityConsumed"],
      reviewerNotes: "Kiln fuel and electricity meters in calibration for 2026.",
    }),
  ];

  const data = {
    status: "DRAFT",
    version: 1,
    caseId,
    ownerId: uid,
    importerIdentity: {
      legalName: datum("Med Cement Import S.p.A.", undefined, undefined),
      eoriNumber: datum("IT12345678901", undefined, ids.customs),
      address: datum("Genova, Italy", undefined, undefined),
    },
    exporterIdentity: {
      legalName: datum("STRESS Nile Valley Cement SAE", undefined, undefined),
      address: datum("Ain Sokhna, Suez, Egypt", undefined, undefined),
    },
    reportingPeriod: {
      year: datum("2026", undefined, undefined),
      quarter: datum("ANNUAL", undefined, undefined),
    },
    goods: [
      {
        cnCode: datum("25232900", undefined, ids.customs),
        sector: "CEMENT",
        productionVolume: datum("4200000", "t", ids.production),
        shipmentRecords: datum("4200000", "t", undefined),
        allocationShare: datum("0.78", "fraction", ids.production),
      },
      {
        cnCode: datum("25232100", undefined, ids.customs),
        sector: "CEMENT",
        productionVolume: datum("1184615", "t", ids.production),
        shipmentRecords: datum("1184615", "t", undefined),
        allocationShare: datum("0.22", "fraction", ids.production),
      },
    ],
    installation: {
      name: datum("Ain Sokhna Dry-Process Cement Works", undefined, undefined),
      unloCode: datum("EGAIS", undefined, undefined),
      country: datum("EG", undefined, undefined),
      productionRoute: datum("Dry-process rotary kiln with precalciner and clinker grinding", undefined, undefined),
      systemBoundaries:
        "Raw meal preparation, preheater/precalciner tower, rotary kiln, clinker cooler, cement mills, fuel preparation and on-site substations inside the installation boundary. Quarry blasting and off-site distribution terminals excluded.",
    },
    directEmissions: datum("890000", "tCO2e", ids.direct),
    electricityConsumed: datum("210000", "MWh", ids.power),
    gridEmissionFactor: datum("0.55", "tCO2e/MWh", ids.power),
    precursors: [],
    carbonPriceRecords: [
      {
        id: "c2111111-1111-4111-8111-000000000201",
        amountPaid: "9800000",
        applicableEmissions: "35000",
        currency: "EUR",
        paymentPeriod: "2026",
        legislationReference: "Egyptian carbon levy — Art.9 CBAM adjustment stress record",
        proofOfPaymentEvidenceId: ids.carbon,
        eligibleCertificateReduction: "35000",
      },
    ],
    evidenceRegister: evidence.map((item) => {
      const rest = { ...item };
      delete rest._bytes;
      return rest;
    }),
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [
      {
        decisionId: "d2111111-1111-4111-8111-000000000301",
        topic: "PRECURSOR_SCOPE",
        selectedMethod: "No qualifying precursor goods are declared for this cement installation scope.",
        reason: "Clinker is produced on-site; no separately purchased CBAM precursor goods enter the boundary for the reported CN lines.",
        legalOrTechnicalBasis:
          "Regulation (EU) 2023/956 Annex IV and Commission Implementing Regulation (EU) 2025/2547; plant bill of materials.",
        evidenceIds: [ids.direct],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
      {
        decisionId: "d2111111-1111-4111-8111-000000000302",
        topic: "GOODS_EMISSIONS_ALLOCATION",
        selectedMethod: "Allocate installation emissions by cementitious product mass shares 0.78 / 0.22.",
        reason: "Two cement CN lines share one kiln/clinker boundary; mass balance reconciles to 1.000.",
        legalOrTechnicalBasis:
          "Commission Implementing Regulation (EU) 2025/2547 allocation requirements; cement mill ledger.",
        evidenceIds: [ids.production],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
    ],
    operatorSignOffs: [
      { role: "OPERATOR_PREPARER", name: "Hassan Prep", title: "CBAM Data Preparer", signedAt: "2027-01-14T09:00:00.000Z" },
      { role: "INTERNAL_REVIEWER", name: "Mona Review", title: "Internal Reviewer", signedAt: "2027-01-15T09:00:00.000Z" },
      { role: "DATA_OWNER", name: "Youssef Owner", title: "Plant Manager", signedAt: "2027-01-16T09:00:00.000Z" },
    ],
    auditEvents: [
      {
        eventId: "e2111111-1111-4111-8111-000000000401",
        timestamp: "2027-01-16T10:00:00.000Z",
        actor: uid,
        action: "STRESS_SEED_LOADED",
        metadata: { scenario: "CEMENT_EG", seed: "teb232-stress-v1" },
      },
    ],
  };

  return { data, evidence };
}

function buildAluminium(uid, caseId) {
  const ids = {
    customs: "b3111111-1111-4111-8111-000000000101",
    power: "b3111111-1111-4111-8111-000000000102",
    production: "b3111111-1111-4111-8111-000000000103",
    direct: "b3111111-1111-4111-8111-000000000104",
    precursor: "b3111111-1111-4111-8111-000000000105",
    calibration: "b3111111-1111-4111-8111-000000000106",
  };

  const evidence = [
    evidenceRecord({
      evidenceId: ids.customs,
      caseId,
      uid,
      documentType: "CUSTOMS_DECLARATION",
      fileName: "cn-alu-cn-eori.pdf",
      bytes: pdfBytes("alu-customs"),
      issuer: "China Customs / EU importer desk",
      issueDate: "2026-09-30",
      reportingPeriod: "2026",
      linkedInputs: ["importerIdentity.eoriNumber", "goods.0.cnCode", "goods.1.cnCode"],
      reviewerNotes: "Unwrought aluminium and plates CN codes confirmed.",
    }),
    evidenceRecord({
      evidenceId: ids.power,
      caseId,
      uid,
      documentType: "UTILITY_BILL",
      fileName: "cn-smelter-power-185gwh.pdf",
      bytes: pdfBytes("alu-power"),
      issuer: "Provincial grid industrial supply",
      issueDate: "2026-12-31",
      reportingPeriod: "2026",
      linkedInputs: ["electricityConsumed", "gridEmissionFactor"],
      linkedCalculations: ["CBAM_INDIRECT_EMISSIONS"],
      reviewerNotes: "185 GWh electrolytic load; grid factor 0.68 tCO2e/MWh.",
    }),
    evidenceRecord({
      evidenceId: ids.production,
      caseId,
      uid,
      documentType: "PRODUCTION_RECONCILIATION_REPORT",
      fileName: "cn-potline-casting-mass-balance.pdf",
      bytes: pdfBytes("alu-production"),
      issuer: "Smelter production controller",
      issueDate: "2027-01-09",
      reportingPeriod: "2026",
      linkedInputs: [
        "goods.0.productionVolume",
        "goods.1.productionVolume",
        "goods.0.allocationShare",
        "goods.1.allocationShare",
      ],
      linkedCalculations: [
        "CBAM_GOOD_EMISSIONS_ALLOCATION_1",
        "CBAM_GOOD_EMISSIONS_ALLOCATION_2",
        "CBAM_GOODS_ALLOCATION_RECONCILIATION",
      ],
      reviewerNotes: "Allocation 0.61 / 0.39 between unwrought and plate products.",
    }),
    evidenceRecord({
      evidenceId: ids.direct,
      caseId,
      uid,
      documentType: "PRIMARY_MONITORING_AND_CUSTOMS_PACKAGE",
      fileName: "cn-anode-pfc-co2-direct.pdf",
      bytes: pdfBytes("alu-direct"),
      issuer: "Independent smelter GHG auditor",
      issueDate: "2027-01-12",
      reportingPeriod: "2026",
      linkedInputs: ["directEmissions"],
      linkedCalculations: ["CBAM_TOTAL_EMBEDDED_EMISSIONS"],
      reviewerNotes: "Anode consumption CO2 + PFC (CF4/C2F6) reconciled to 18,750 tCO2e direct.",
    }),
    evidenceRecord({
      evidenceId: ids.precursor,
      caseId,
      uid,
      documentType: "SUPPLIER_EMISSIONS_DECLARATION",
      fileName: "alumina-precursor-actuals.pdf",
      bytes: pdfBytes("alu-precursor"),
      issuer: "Alumina refinery supplier desk",
      issueDate: "2026-11-15",
      reportingPeriod: "2026",
      linkedInputs: [
        "precursors.0.quantity",
        "precursors.0.directEmissions",
        "precursors.0.indirectEmissions",
      ],
      reviewerNotes: "Metallurgical alumina precursor actuals accepted.",
    }),
    evidenceRecord({
      evidenceId: ids.calibration,
      caseId,
      uid,
      documentType: "CALIBRATION_CERTIFICATE",
      fileName: "cn-potline-meter-calibration.pdf",
      bytes: pdfBytes("alu-cal"),
      issuer: "CNAS accredited calibration lab",
      issueDate: "2026-01-25",
      reportingPeriod: "2026",
      linkedInputs: ["directEmissions", "electricityConsumed"],
      reviewerNotes: "Potline power and anode meters calibrated for 2026.",
    }),
  ];

  const data = {
    status: "DRAFT",
    version: 1,
    caseId,
    ownerId: uid,
    importerIdentity: {
      legalName: datum("Alpine Aluminium GmbH", undefined, undefined),
      eoriNumber: datum("ATU12345678", undefined, ids.customs),
      address: datum("Linz, Austria", undefined, undefined),
    },
    exporterIdentity: {
      legalName: datum("STRESS Yunnan Primary Aluminium Co Ltd", undefined, undefined),
      address: datum("Kunming, Yunnan, China", undefined, undefined),
    },
    reportingPeriod: {
      year: datum("2026", undefined, undefined),
      quarter: datum("ANNUAL", undefined, undefined),
    },
    goods: [
      {
        cnCode: datum("76011000", undefined, ids.customs),
        sector: "ALUMINIUM",
        productionVolume: datum("86500", "t", ids.production),
        shipmentRecords: datum("86500", "t", undefined),
        allocationShare: datum("0.61", "fraction", ids.production),
      },
      {
        cnCode: datum("76061200", undefined, ids.customs),
        sector: "ALUMINIUM",
        productionVolume: datum("55300", "t", ids.production),
        shipmentRecords: datum("55300", "t", undefined),
        allocationShare: datum("0.39", "fraction", ids.production),
      },
    ],
    installation: {
      name: datum("Yunnan Primary Electrolytic Smelter & Casting Centre", undefined, undefined),
      unloCode: datum("CNKMG", undefined, undefined),
      country: datum("CN", undefined, undefined),
      productionRoute: datum("Primary Hall-Héroult electrolysis + remelt casting (PFC-relevant)", undefined, undefined),
      systemBoundaries:
        "Alumina handling, prebake anode plant, potlines A-D, casting centre, fume treatment and on-site rectifier stations. Bauxite mining and off-site rolling mills excluded.",
    },
    directEmissions: datum("18750", "tCO2e", ids.direct),
    electricityConsumed: datum("185000", "MWh", ids.power),
    gridEmissionFactor: datum("0.68", "tCO2e/MWh", ids.power),
    precursors: [
      {
        name: datum("Metallurgical alumina", undefined, undefined),
        quantity: datum("272000", "t", ids.precursor),
        directEmissions: datum("146000", "tCO2e", ids.precursor),
        indirectEmissions: datum("38500", "tCO2e", ids.precursor),
        countryOfOrigin: datum("AU", undefined, undefined),
      },
    ],
    carbonPriceRecords: [],
    evidenceRegister: evidence.map((item) => {
      const rest = { ...item };
      delete rest._bytes;
      return rest;
    }),
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [
      {
        decisionId: "d3111111-1111-4111-8111-000000000301",
        topic: "PRECURSOR_SCOPE",
        selectedMethod: "Include metallurgical alumina precursor with supplier actual embedded emissions.",
        reason: "Alumina is consumed in primary electrolysis and carries material direct and indirect emissions.",
        legalOrTechnicalBasis:
          "Regulation (EU) 2023/956 Annex IV and Commission Implementing Regulation (EU) 2025/2547; alumina supplier declaration.",
        evidenceIds: [ids.precursor],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
      {
        decisionId: "d3111111-1111-4111-8111-000000000302",
        topic: "GOODS_EMISSIONS_ALLOCATION",
        selectedMethod: "Allocate installation emissions by product mass shares 0.61 / 0.39.",
        reason: "Unwrought and plate products share the same smelter/casting boundary; mass balance reconciles to 1.000.",
        legalOrTechnicalBasis:
          "Commission Implementing Regulation (EU) 2025/2547 allocation requirements; casting ledger.",
        evidenceIds: [ids.production],
        reviewStatus: "ACCEPTED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
    ],
    operatorSignOffs: [
      { role: "OPERATOR_PREPARER", name: "Wei Prep", title: "CBAM Data Preparer", signedAt: "2027-01-14T09:00:00.000Z" },
      { role: "INTERNAL_REVIEWER", name: "Li Review", title: "Internal Reviewer", signedAt: "2027-01-15T09:00:00.000Z" },
      { role: "DATA_OWNER", name: "Chen Owner", title: "Smelter Manager", signedAt: "2027-01-16T09:00:00.000Z" },
    ],
    auditEvents: [
      {
        eventId: "e3111111-1111-4111-8111-000000000401",
        timestamp: "2027-01-16T10:00:00.000Z",
        actor: uid,
        action: "STRESS_SEED_LOADED",
        metadata: { scenario: "ALU_CN", seed: "teb232-stress-v1" },
      },
    ],
  };

  return { data, evidence };
}

const BUILDERS = {
  STEEL_IN: buildSteel,
  CEMENT_EG: buildCement,
  ALU_CN: buildAluminium,
};

async function main() {
  const env = loadEnvLocal();
  const bucketName = env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET missing in .env.local");

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: "cbam-desk",
      storageBucket: bucketName,
    });
  }

  const user = await admin.auth().getUserByEmail(EMAIL);
  if (user.uid !== UID_KNOWN) {
    throw new Error(`UID_MISMATCH expected ${UID_KNOWN} got ${user.uid}`);
  }
  const uid = user.uid;
  const db = admin.firestore();
  const bucket = admin.storage().bucket();
  const timestamp = new Date().toISOString();

  const results = [];

  for (const scenario of SCENARIOS) {
    const identity = deriveCaseIdentity(uid, scenario.requestId);
    const built = BUILDERS[scenario.key](uid, identity.caseId);
    const hashes = new Set(built.evidence.map((e) => e.fileHash));
    if (hashes.size !== built.evidence.length) {
      throw new Error(`DUPLICATE_EVIDENCE_HASH:${scenario.key}`);
    }

    const record = {
      caseId: identity.caseId,
      uid,
      data: built.data,
      status: "DRAFT",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    results.push({
      key: scenario.key,
      title: scenario.title,
      caseId: identity.caseId,
      requestId: scenario.requestId,
      goods: built.data.goods.map((g) => ({
        cn: g.cnCode.value,
        sector: g.sector,
        t: g.productionVolume.value,
        share: g.allocationShare?.value,
      })),
      direct: built.data.directEmissions.value,
      electricityMwh: built.data.electricityConsumed.value,
      gridFactor: built.data.gridEmissionFactor.value,
      precursors: built.data.precursors.length,
      evidenceCount: built.evidence.length,
      origin: built.data.installation.country.value,
    });

    if (!EXECUTE) continue;

    // Upload evidence objects first (physical bytes must match hashes).
    for (const ev of built.evidence) {
      const file = bucket.file(ev.storagePath);
      await file.save(ev._bytes, {
        contentType: "application/pdf",
        metadata: {
          metadata: {
            caseId: identity.caseId,
            ownerId: uid,
            evidenceId: ev.evidenceId,
            sha256: ev.fileHash,
            seed: "teb232-stress-v1",
          },
        },
        resumable: false,
      });
    }

    const caseRef = db.collection("cbam_cases").doc(identity.caseId);
    const markerRef = db.collection("case_creation_requests").doc(identity.digest);
    const existing = await caseRef.get();

    if (existing.exists) {
      await caseRef.set(
        {
          ...record,
          createdAt: existing.data()?.createdAt || timestamp,
          updatedAt: timestamp,
        },
        { merge: false }
      );
    } else {
      await db.runTransaction(async (tx) => {
        const markerSnap = await tx.get(markerRef);
        if (markerSnap.exists) {
          throw new Error(`MARKER_EXISTS_WITHOUT_CASE:${identity.caseId}`);
        }
        tx.create(caseRef, record);
        tx.create(markerRef, {
          uid,
          requestId: identity.requestId,
          caseId: identity.caseId,
          createdAt: timestamp,
        });
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        mode: EXECUTE ? "EXECUTE" : "DRY_RUN",
        email: EMAIL,
        uid,
        cases: results,
        workspaceHint: "Open /cases and look for exporter names starting with STRESS",
      },
      null,
      2
    )
  );

  if (!EXECUTE) {
    console.error("DRY_RUN only. Re-run with EXECUTE=1 to write production data.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
