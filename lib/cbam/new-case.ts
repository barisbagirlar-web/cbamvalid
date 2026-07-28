import {
  AuditReadyCaseSchema,
  createEmptyInput,
  type AuditReadyCase,
  type InputDatum,
  type UnitCode,
} from "./schema";

export const ILLUSTRATIVE_SCENARIO_ID = "ILLUSTRATIVE_STEEL_EXPORT_V1";
export const ILLUSTRATIVE_SCENARIO_LOADED = "ILLUSTRATIVE_SCENARIO_LOADED";
export const ILLUSTRATIVE_SCENARIO_REPLACED = "ILLUSTRATIVE_SCENARIO_REPLACED";

type NewCaseDraftOptions = {
  eventId?: string;
  scenarioEventId?: string;
  timestamp?: string;
  reportingYear?: number;
};

function normalizedOwner(ownerId: string): string {
  const normalizedOwnerId = ownerId.trim();
  if (!normalizedOwnerId) throw new Error("CASE_OWNER_ID_REQUIRED");
  return normalizedOwnerId;
}

function scenarioInput(
  value: string,
  canonicalUnit?: UnitCode,
  sourceType: InputDatum["sourceType"] = "ESTIMATED"
): InputDatum {
  return {
    value,
    ...(canonicalUnit ? { canonicalUnit } : {}),
    sourceType,
    confidenceStatus: sourceType === "DEFAULT" ? "DEFAULT_ASSIGNED" : "LOW_ESTIMATE",
    documentReference: "Illustrative scenario only — replace with the actual source document reference.",
    measurementMethod: "Illustrative example — replace with the monitored or documented method.",
    reviewerNote: "Example value. Replace and evidence this input before independent verification.",
  };
}

function resolveTimestamp(options: NewCaseDraftOptions): string {
  return options.timestamp ?? new Date().toISOString();
}

function resolveReportingYear(options: NewCaseDraftOptions, timestamp: string): number {
  if (options.reportingYear !== undefined) {
    if (!Number.isInteger(options.reportingYear) || options.reportingYear < 2026 || options.reportingYear > 2100) {
      throw new Error("ILLUSTRATIVE_SCENARIO_REPORTING_YEAR_INVALID");
    }
    return options.reportingYear;
  }
  const timestampYear = new Date(timestamp).getUTCFullYear();
  return Number.isInteger(timestampYear) && timestampYear >= 2026 ? timestampYear : 2026;
}

export function createBlankCaseDraft(
  ownerId: string,
  options: NewCaseDraftOptions = {}
): AuditReadyCase {
  const normalizedOwnerId = normalizedOwner(ownerId);
  const timestamp = resolveTimestamp(options);

  return AuditReadyCaseSchema.parse({
    status: "DRAFT",
    version: 1,
    ownerId: normalizedOwnerId,
    importerIdentity: {
      legalName: createEmptyInput(),
      eoriNumber: createEmptyInput(),
    },
    exporterIdentity: {
      legalName: createEmptyInput(),
    },
    reportingPeriod: {
      year: createEmptyInput(),
      quarter: createEmptyInput(),
    },
    goods: [],
    installation: {
      name: createEmptyInput(),
      country: createEmptyInput(),
      productionRoute: createEmptyInput(),
      systemBoundaries: "",
    },
    directEmissions: createEmptyInput("tCO2e"),
    electricityConsumed: createEmptyInput("MWh"),
    gridEmissionFactor: createEmptyInput("tCO2e/MWh"),
    precursors: [],
    carbonPriceRecords: [],
    evidenceRegister: [],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [],
    auditEvents: [{
      eventId: options.eventId ?? crypto.randomUUID(),
      timestamp,
      actor: normalizedOwnerId,
      action: "CASE_CREATED",
    }],
  });
}

export function createNewCaseDraft(
  ownerId: string,
  options: NewCaseDraftOptions = {}
): AuditReadyCase {
  const normalizedOwnerId = normalizedOwner(ownerId);
  const timestamp = resolveTimestamp(options);
  const reportingYear = resolveReportingYear(options, timestamp);

  return AuditReadyCaseSchema.parse({
    status: "DRAFT",
    version: 1,
    ownerId: normalizedOwnerId,
    importerIdentity: {
      legalName: scenarioInput("Illustrative EU Importer B.V."),
      eoriNumber: scenarioInput("NL123456789B01"),
    },
    exporterIdentity: {
      legalName: scenarioInput("Illustrative Steel Exporter Ltd."),
    },
    reportingPeriod: {
      year: scenarioInput(String(reportingYear), undefined, "REGULATORY"),
      quarter: scenarioInput("Q1", undefined, "REGULATORY"),
    },
    goods: [
      {
        cnCode: scenarioInput("72085120", undefined, "REGULATORY"),
        sector: "IRON_AND_STEEL",
        productionVolume: scenarioInput("600", "t"),
        shipmentRecords: scenarioInput("Illustrative hot-rolled steel plate shipment — 600 t"),
        allocationShare: scenarioInput("0.6", "fraction"),
      },
      {
        cnCode: scenarioInput("72085210", undefined, "REGULATORY"),
        sector: "IRON_AND_STEEL",
        productionVolume: scenarioInput("400", "t"),
        shipmentRecords: scenarioInput("Illustrative hot-rolled steel sheet shipment — 400 t"),
        allocationShare: scenarioInput("0.4", "fraction"),
      },
    ],
    installation: {
      name: scenarioInput("Illustrative Steel Plant"),
      country: scenarioInput("TR"),
      productionRoute: scenarioInput("Electric Arc Furnace (EAF)"),
      systemBoundaries:
        "Illustrative boundary covering scrap and precursor receipt, electric-arc-furnace melting, casting, rolling, finishing and allocated electricity consumption. Replace with the actual monitored installation boundary.",
    },
    directEmissions: scenarioInput("620", "tCO2e"),
    electricityConsumed: scenarioInput("850", "MWh"),
    gridEmissionFactor: scenarioInput("0.4344", "tCO2e/MWh", "DEFAULT"),
    precursors: [
      {
        name: scenarioInput("Pig iron"),
        quantity: scenarioInput("120", "t"),
        directEmissions: scenarioInput("150", "tCO2e"),
        indirectEmissions: scenarioInput("18", "tCO2e"),
        countryOfOrigin: scenarioInput("TR"),
      },
    ],
    carbonPriceRecords: [
      {
        id: crypto.randomUUID(),
        amountPaid: "21700",
        applicableEmissions: "620",
        currency: "TRY",
        paymentPeriod: String(reportingYear),
        legislationReference:
          "Illustrative carbon-pricing reference — replace with the applicable legal instrument.",
        rebateInformation: "Illustrative example — verify rebates or compensation against payment evidence.",
        eligibleCertificateReduction: "0",
      },
    ],
    evidenceRegister: [],
    calculationTrace: [],
    gapAssessment: [],
    methodologyDecisions: [
      {
        decisionId: crypto.randomUUID(),
        topic: "GOODS_EMISSIONS_ALLOCATION",
        selectedMethod: "Illustrative mass-based allocation using production shares of 0.6 and 0.4.",
        reason: "The example assumes both goods share the same production process and reporting period.",
        legalOrTechnicalBasis:
          "Illustrative application of the active definitive-period allocation rules; replace with the case-specific basis and evidence.",
        evidenceIds: [],
        reviewStatus: "REVIEW_REQUIRED",
        rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
      },
    ],
    auditEvents: [
      {
        eventId: options.eventId ?? crypto.randomUUID(),
        timestamp,
        actor: normalizedOwnerId,
        action: "CASE_CREATED",
      },
      {
        eventId: options.scenarioEventId ?? crypto.randomUUID(),
        timestamp,
        actor: normalizedOwnerId,
        action: ILLUSTRATIVE_SCENARIO_LOADED,
        metadata: {
          scenarioId: ILLUSTRATIVE_SCENARIO_ID,
          classification: "ILLUSTRATIVE_SCENARIO_NOT_FOR_SUBMISSION",
        },
      },
    ],
  });
}

export function isIllustrativeScenarioActive(caseData: AuditReadyCase): boolean {
  return caseData.auditEvents.reduce((active, event) => {
    if (event.action === ILLUSTRATIVE_SCENARIO_LOADED) return true;
    if (event.action === ILLUSTRATIVE_SCENARIO_REPLACED) return false;
    return active;
  }, false);
}

export function replaceIllustrativeScenarioWithBlank(
  caseData: AuditReadyCase,
  actor: string,
  timestamp = new Date().toISOString()
): AuditReadyCase {
  const blank = createBlankCaseDraft(actor, { timestamp });
  return AuditReadyCaseSchema.parse({
    ...blank,
    ...(caseData.caseId ? { caseId: caseData.caseId } : {}),
    version: caseData.version,
    auditEvents: [
      ...caseData.auditEvents,
      {
        eventId: crypto.randomUUID(),
        timestamp,
        actor: normalizedOwner(actor),
        action: ILLUSTRATIVE_SCENARIO_REPLACED,
        metadata: {
          scenarioId: ILLUSTRATIVE_SCENARIO_ID,
          reason: "User started a blank case and must supply case-specific source data and evidence.",
        },
      },
    ],
  });
}
