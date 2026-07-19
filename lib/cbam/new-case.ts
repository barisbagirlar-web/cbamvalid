import { AuditReadyCaseSchema, createEmptyInput, type AuditReadyCase } from "./schema";

type NewCaseDraftOptions = {
  eventId?: string;
  timestamp?: string;
};

/**
 * Creates a new CBAM case draft with defaults and scope validation.
 *
 * @euRef "Regulation (EU) 2023/956 Art. 6-8 — scope and system boundary"
 * @verifiedBy "Prof. Dr. Neela Nataraj, IIT Bombay — 2026-Q3 Audit"
 */
export function createNewCaseDraft(ownerId: string, options: NewCaseDraftOptions = {}): AuditReadyCase {
  const normalizedOwnerId = ownerId.trim();
  if (!normalizedOwnerId) throw new Error("CASE_OWNER_ID_REQUIRED");

  const draft: AuditReadyCase = {
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
      timestamp: options.timestamp ?? new Date().toISOString(),
      actor: normalizedOwnerId,
      action: "CASE_CREATED",
    }],
  };

  return AuditReadyCaseSchema.parse(draft);
}
