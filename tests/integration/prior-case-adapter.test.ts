import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNewCaseDraft } from "@/lib/cbam/new-case";
import { AuditReadyCaseSchema } from "../../functions/src/cbam/schema";

type StoredDocument = Record<string, unknown>;

const fakeFirestore = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDocument>>();

  function store(name: string): Map<string, StoredDocument> {
    let collectionStore = collections.get(name);
    if (!collectionStore) {
      collectionStore = new Map<string, StoredDocument>();
      collections.set(name, collectionStore);
    }
    return collectionStore;
  }

  function snapshot(id: string, value: StoredDocument | undefined) {
    return {
      id,
      exists: value !== undefined,
      data: () => (value === undefined ? undefined : structuredClone(value)),
    };
  }

  const adminDb = {
    collection(name: string) {
      return {
        doc(id: string) {
          return {
            async get() {
              return snapshot(id, store(name).get(id));
            },
            async update(update: Record<string, unknown>) {
              const existing = store(name).get(id);
              if (existing === undefined) throw new Error("FAKE_DOC_NOT_FOUND");
              store(name).set(id, { ...existing, ...update });
            },
          };
        },
        where(field: string, operator: string, expected: unknown) {
          if (operator !== "==") throw new Error("FAKE_OPERATOR_UNSUPPORTED");
          return {
            limit() {
              return this;
            },
            async get() {
              const docs = [...store(name).entries()]
                .filter(([, value]) => value[field] === expected)
                .map(([id, value]) => ({ id, data: () => structuredClone(value) }));
              return { docs };
            },
          };
        },
      };
    },
  };

  return {
    adminDb,
    clear() {
      collections.clear();
    },
    set(name: string, id: string, value: StoredDocument) {
      store(name).set(id, structuredClone(value));
    },
  };
});

vi.mock("../../functions/src/firebase-admin", () => ({
  adminDb: fakeFirestore.adminDb,
}));

import { getCase, getCasesForUser, updateCase } from "../../functions/src/cbam/storage/case-repository";
import {
  adaptPriorAuditReadyCaseData,
  isRecognizedPriorNestedCaseData,
} from "../../functions/src/cbam/storage/prior-case-adapter";
import {
  adaptLegacyCaseData,
  isRecognizedLegacyCaseData,
} from "../../functions/src/cbam/storage/legacy-case-adapter";
import { buildCompatibilityMigrationError } from "../../functions/src/handlers/cases";

const OWNER_ID = "user_prior_v5_test123";
const CASE_ID = "case_priorV5Test123";
const DECISION_ID = "11111111-1111-4111-8111-111111111111";
const EVIDENCE_ID = "33333333-3333-4333-8333-333333333333";
const TIMESTAMP = "2026-07-15T12:00:00.000Z";
const EVENT_ID = "44444444-4444-4444-8444-444444444444";
const SCENARIO_EVENT_ID = "55555555-5555-4555-8555-555555555555";
const EVIDENCE_HASH = "a".repeat(64);

/**
 * Paths whose difference is an intentional artifact of the read-compatibility
 * migration, never a business-value change:
 *  - caseId / ownerId: server-derived identity injection
 *  - auditEvents: migration audit trail appended
 *  - methodologyDecisions[*].reviewStatus: honest downgrade of ACCEPTED
 *    decisions whose approval provenance is missing
 *  - evidenceRegister[*].qualityGrade: PENDING default for legacy records
 *    without structured quality metadata
 */
function isMigrationArtifactPath(path: string): boolean {
  if (path === "caseId" || path === "ownerId" || path === "auditEvents") return true;
  if (/^methodologyDecisions\[\d+\]\.reviewStatus$/.test(path)) return true;
  if (/^evidenceRegister\[\d+\]\.qualityGrade$/.test(path)) return true;
  return false;
}

function findBusinessValueDiffs(source: unknown, migrated: unknown, path = ""): string[] {
  const diffs: string[] = [];
  if (isMigrationArtifactPath(path)) return diffs;

  const isObject = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === "object" && !Array.isArray(value);

  if (isObject(source) && isObject(migrated)) {
    const keys = new Set([...Object.keys(source), ...Object.keys(migrated)]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      const left = source[key];
      const right = migrated[key];
      if (left === undefined && right === undefined) continue;
      diffs.push(...findBusinessValueDiffs(left, right, childPath));
    }
    return diffs;
  }

  if (Array.isArray(source) && Array.isArray(migrated)) {
    if (source.length !== migrated.length) {
      diffs.push(`${path}<length:${source.length}!==${migrated.length}>`);
      return diffs;
    }
    for (let index = 0; index < source.length; index += 1) {
      diffs.push(...findBusinessValueDiffs(source[index], migrated[index], `${path}[${index}]`));
    }
    return diffs;
  }

  if (source !== migrated) diffs.push(path || "<root>");
  return diffs;
}

function buildPreP0NestedData(overrides: {
  acceptedProvenance?: boolean;
  invalidSupportStatus?: boolean;
} = {}): Record<string, unknown> {
  const draft = createNewCaseDraft(OWNER_ID, {
    eventId: EVENT_ID,
    scenarioEventId: SCENARIO_EVENT_ID,
    timestamp: TIMESTAMP,
  });
  const raw = JSON.parse(JSON.stringify(draft)) as Record<string, unknown>;

  const decisions: Record<string, unknown>[] = [
    {
      decisionId: DECISION_ID,
      topic: "GOODS_EMISSIONS_ALLOCATION",
      selectedMethod: "Mass-based allocation using production shares 0.6 / 0.4.",
      reason: "Both goods share the same installation and reporting period.",
      legalOrTechnicalBasis: "Applicable allocation rules for the reporting period.",
      evidenceIds: [],
      reviewStatus: "ACCEPTED",
      rulesetVersion: "EU-CBAM-DEFINITIVE-2026",
    },
  ];
  if (overrides.acceptedProvenance) {
    decisions[0]!.approverName = "Internal Reviewer A";
    decisions[0]!.approverRole = "INTERNAL_REVIEWER";
    decisions[0]!.approvedAt = "2026-07-14T09:00:00.000Z";
  }
  raw.methodologyDecisions = decisions;

  raw.evidenceRegister = [
    {
      evidenceId: EVIDENCE_ID,
      documentType: "electricity invoice",
      fileName: "electricity-invoice-q1-2026.pdf",
      storagePath: `evidence/${OWNER_ID}/${CASE_ID}/${EVIDENCE_ID}/invoice.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 2048,
      issuer: "Grid operator invoice",
      issueDate: "2026-04-05",
      reportingPeriod: "Q1 2026",
      pageReference: "p.1",
      fileHash: EVIDENCE_HASH,
      uploadTimestamp: TIMESTAMP,
      uploader: OWNER_ID,
      reviewStatus: "APPROVED",
      supportStatus: overrides.invalidSupportStatus ? "VERIFIED" : "SUPPORTED",
      malwareScanStatus: "CLEAN",
      confidentiality: "CONFIDENTIAL",
      linkedInputs: ["electricityConsumed", "gridEmissionFactor"],
      linkedCalculations: [],
      evidencePeriodStart: "2026-01-01",
      evidencePeriodEnd: "2026-03-31",
    },
  ];

  return raw;
}

function storedRecord(data: unknown, documentId = CASE_ID): StoredDocument {
  return {
    caseId: documentId,
    uid: OWNER_ID,
    status: "DRAFT",
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
    data,
  };
}

describe("prior nested V5 case compatibility", () => {
  beforeEach(() => {
    fakeFirestore.clear();
  });

  it("recognizes prior nested records and never claims flat V1 drafts", () => {
    expect(isRecognizedPriorNestedCaseData(buildPreP0NestedData())).toBe(true);
    expect(isRecognizedPriorNestedCaseData({
      exporterName: "Legacy Exporter",
      declarantEORI: "DE123456789012",
      cnCode: "72085120",
      installationName: "Legacy Plant",
      directEmissions: 56788,
    })).toBe(false);
    expect(isRecognizedLegacyCaseData({ directEmissions: { value: 10 } })).toBe(false);
  });

  it("Test A — opens a pre-P0 nested case and honestly downgrades ACCEPTED decisions without provenance", async () => {
    const raw = buildPreP0NestedData();

    const current = AuditReadyCaseSchema.safeParse({
      ...raw,
      caseId: CASE_ID,
      ownerId: OWNER_ID,
    });
    expect(current.success).toBe(false);

    const adapted = adaptPriorAuditReadyCaseData({
      rawData: raw,
      caseId: CASE_ID,
      uid: OWNER_ID,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    expect(adapted).not.toBeNull();
    expect(() => AuditReadyCaseSchema.parse(adapted)).not.toThrow();

    const decision = adapted!.methodologyDecisions.find((record) => record.decisionId === DECISION_ID);
    expect(decision?.reviewStatus).toBe("REVIEW_REQUIRED");
    expect(decision?.topic).toBe("GOODS_EMISSIONS_ALLOCATION");
    expect(decision?.selectedMethod).toContain("0.6 / 0.4");

    // No business value is invented or changed.
    expect(findBusinessValueDiffs(raw, adapted!)).toEqual([]);
    expect(adapted!.exporterIdentity.legalName.value).toBe("Illustrative Steel Exporter Ltd.");
    expect(adapted!.directEmissions.value).toBe("620");
    expect(adapted!.goods).toHaveLength(2);
    expect(adapted!.installation.name.value).toBe("Illustrative Steel Plant");

    const event = adapted!.auditEvents.at(-1);
    expect(event?.action).toBe("PRIOR_NESTED_CASE_ADAPTED");
    expect(event?.metadata).toMatchObject({
      sourceSchema: "AUDIT_READY_PRE_P0",
      migrationMode: "READ_COMPATIBILITY_VIEW",
      downgradedAcceptedDecisionIds: [DECISION_ID],
      reason: "ACCEPTED_DECISION_PROVENANCE_MISSING",
    });

    fakeFirestore.set("cbam_cases", CASE_ID, storedRecord(raw));
    const record = await getCase(CASE_ID);
    expect(record).not.toBeNull();
    expect(record?.data.methodologyDecisions[0]?.reviewStatus).toBe("REVIEW_REQUIRED");
    expect(() => AuditReadyCaseSchema.parse(record?.data)).not.toThrow();
  });

  it("Test B — keeps ACCEPTED decisions that carry full approval provenance", () => {
    const raw = buildPreP0NestedData({ acceptedProvenance: true });

    const current = AuditReadyCaseSchema.safeParse({
      ...raw,
      caseId: CASE_ID,
      ownerId: OWNER_ID,
    });
    expect(current.success).toBe(true);
    const decision = current.data!.methodologyDecisions.find((record) => record.decisionId === DECISION_ID);
    expect(decision?.reviewStatus).toBe("ACCEPTED");
    expect(decision?.approverName).toBe("Internal Reviewer A");
    expect(decision?.approvedAt).toBe("2026-07-14T09:00:00.000Z");

    const adapted = adaptPriorAuditReadyCaseData({
      rawData: raw,
      caseId: CASE_ID,
      uid: OWNER_ID,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    expect(adapted).not.toBeNull();
    const preserved = adapted!.methodologyDecisions.find((record) => record.decisionId === DECISION_ID);
    expect(preserved?.reviewStatus).toBe("ACCEPTED");
    expect(
      adapted!.auditEvents.some((event) => event.action === "PRIOR_NESTED_CASE_ADAPTED")
    ).toBe(false);
    expect(findBusinessValueDiffs(raw, adapted!)).toEqual([]);
  });

  it("Test C — preserves legacy approved evidence without fabricating quality approval", () => {
    const raw = buildPreP0NestedData();
    const adapted = adaptPriorAuditReadyCaseData({
      rawData: raw,
      caseId: CASE_ID,
      uid: OWNER_ID,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    expect(adapted).not.toBeNull();

    const evidence = adapted!.evidenceRegister[0];
    expect(evidence?.evidenceId).toBe(EVIDENCE_ID);
    expect(evidence?.storagePath).toBe(`evidence/${OWNER_ID}/${CASE_ID}/${EVIDENCE_ID}/invoice.pdf`);
    expect(evidence?.fileHash).toBe(EVIDENCE_HASH);
    expect(evidence?.sizeBytes).toBe(2048);
    expect(evidence?.mimeType).toBe("application/pdf");
    expect(evidence?.linkedInputs).toEqual(["electricityConsumed", "gridEmissionFactor"]);
    expect(evidence?.reviewStatus).toBe("APPROVED");
    // Never auto-graded A/B and never scanned from the free-text issuer.
    expect(evidence?.qualityGrade).toBe("PENDING");
    expect(evidence?.issuerCategory).toBeUndefined();
    expect(evidence?.documentAuthority).toBeUndefined();
    expect(evidence?.qualityAssessedBy).toBeUndefined();
  });

  it("safely coerces invalid legacy evidence enums and records their path", () => {
    const raw = buildPreP0NestedData({ invalidSupportStatus: true });
    const adapted = adaptPriorAuditReadyCaseData({
      rawData: raw,
      caseId: CASE_ID,
      uid: OWNER_ID,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    expect(adapted).not.toBeNull();
    expect(adapted!.evidenceRegister[0]?.supportStatus).toBe("PENDING");
    const event = adapted!.auditEvents.at(-1);
    expect(event?.metadata?.evidenceSchemaPaths).toEqual(["evidenceRegister[0].supportStatus"]);
    expect(event?.metadata?.downgradedAcceptedDecisionIds).toEqual([DECISION_ID]);
  });

  it("Test D — leaves a current valid case byte-equivalent and does not engage migration", () => {
    const current = createNewCaseDraft(OWNER_ID, {
      eventId: EVENT_ID,
      scenarioEventId: SCENARIO_EVENT_ID,
      timestamp: TIMESTAMP,
    });
    const raw = JSON.parse(JSON.stringify(current)) as Record<string, unknown>;

    const currentResult = AuditReadyCaseSchema.safeParse({
      ...raw,
      caseId: CASE_ID,
      ownerId: OWNER_ID,
    });
    expect(currentResult.success).toBe(true);

    const adapted = adaptPriorAuditReadyCaseData({
      rawData: raw,
      caseId: CASE_ID,
      uid: OWNER_ID,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    expect(adapted).not.toBeNull();
    expect(
      adapted!.auditEvents.some((event) => event.action === "PRIOR_NESTED_CASE_ADAPTED")
    ).toBe(false);
    expect(findBusinessValueDiffs(raw, adapted!)).toEqual([]);
  });

  it("Test E — the flat V1 legacy adapter still wins for flat drafts", () => {
    const legacy = {
      exporterName: "Legacy Exporter",
      declarantEORI: "DE123456789012",
      importYear: 2026,
      importQuarter: 1,
      cnCode: "72085120",
      productionVolume: 300,
      installationName: "Legacy Plant",
      directEmissions: 56788,
      electricityConsumed: 456,
      gridEmissionFactor: 4344,
    };

    expect(isRecognizedPriorNestedCaseData(legacy)).toBe(false);
    expect(isRecognizedLegacyCaseData(legacy)).toBe(true);
    expect(
      adaptPriorAuditReadyCaseData({
        rawData: legacy,
        caseId: "case_legacyPriorTest",
        uid: OWNER_ID,
        createdAt: TIMESTAMP,
        updatedAt: TIMESTAMP,
      })
    ).toBeNull();

    const legacyAdapted = adaptLegacyCaseData({
      rawData: legacy,
      caseId: "case_legacyPriorTest",
      uid: OWNER_ID,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    expect(legacyAdapted).not.toBeNull();
    expect(legacyAdapted?.installation.name.value).toBe("Legacy Plant");
  });

  it("Test F — fails closed for a genuinely unsupported record without logging raw data", async () => {
    const raw = { directEmissions: { value: 999 } };
    fakeFirestore.set("cbam_cases", "unsupportedDoc", storedRecord(raw, "case_unsupportedDoc"));

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(getCase("case_unsupportedDoc")).rejects.toThrow("CASE_RECORD_UNSUPPORTED_SCHEMA");

    const log = consoleError.mock.calls.find(
      (args) => args[0] === "event=CASE_SCHEMA_COMPATIBILITY_FAILED"
    )?.[1] as Record<string, unknown> | undefined;
    expect(log).toBeDefined();
    expect(log?.documentId).toBe("unsupportedDoc");
    expect(log?.caseId).toBe("case_unsupportedDoc");
    expect(log?.schemaIssuePaths).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(log?.schemaIssueCodes).toEqual(expect.arrayContaining([expect.any(String)]));
    expect(log?.priorAdapterRecognized).toBe(false);
    expect(log?.flatLegacyAdapterRecognized).toBe(false);
    // No raw business value is serialized into the log payload.
    expect(JSON.stringify(log)).not.toContain("999");
    consoleError.mockRestore();

    // The HTTP-facing mapping is an explicit failed-precondition migration
    // error, never a raw HTTP 500.
    const mapped = buildCompatibilityMigrationError(
      new Error("CASE_RECORD_UNSUPPORTED_SCHEMA")
    );
    expect(mapped).toBeInstanceOf(Error);
    expect((mapped as { code: string }).code).toBe("failed-precondition");
    expect(mapped.message).toBe("CASE_RECORD_REQUIRES_COMPATIBILITY_MIGRATION");
    expect(() => buildCompatibilityMigrationError(new Error("CASE_NOT_FOUND"))).toThrow(
      "CASE_NOT_FOUND"
    );
  });

  it("Test G — read twice is deterministic and never duplicates the migration event", async () => {
    const raw = buildPreP0NestedData();
    fakeFirestore.set("cbam_cases", CASE_ID, storedRecord(raw));

    const first = await getCase(CASE_ID);
    const second = await getCase(CASE_ID);
    expect(first).toEqual(second);

    const firstEvents = first!.data.auditEvents.filter(
      (event) => event.action === "PRIOR_NESTED_CASE_ADAPTED"
    );
    const secondEvents = second!.data.auditEvents.filter(
      (event) => event.action === "PRIOR_NESTED_CASE_ADAPTED"
    );
    expect(firstEvents).toHaveLength(1);
    expect(secondEvents).toHaveLength(1);
    expect(firstEvents[0]?.eventId).toBe(secondEvents[0]?.eventId);
    expect(firstEvents[0]?.metadata).toEqual(secondEvents[0]?.metadata);

    const adaptedA = adaptPriorAuditReadyCaseData({
      rawData: raw,
      caseId: CASE_ID,
      uid: OWNER_ID,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    const adaptedB = adaptPriorAuditReadyCaseData({
      rawData: raw,
      caseId: CASE_ID,
      uid: OWNER_ID,
      createdAt: TIMESTAMP,
      updatedAt: TIMESTAMP,
    });
    expect(adaptedA!.auditEvents.at(-1)?.eventId).toBe(adaptedB!.auditEvents.at(-1)?.eventId);
  });

  it("surfaces prior-nested records in the user case list without skipping them", async () => {
    const raw = buildPreP0NestedData();
    fakeFirestore.set("cbam_cases", CASE_ID, storedRecord(raw));

    const cases = await getCasesForUser(OWNER_ID);
    expect(cases).toHaveLength(1);
    expect(cases[0]?.data.methodologyDecisions[0]?.reviewStatus).toBe("REVIEW_REQUIRED");
    expect(cases[0]?.data.evidenceRegister[0]?.linkedInputs).toEqual([
      "electricityConsumed",
      "gridEmissionFactor",
    ]);
  });

  it("persists the migrated view on save without creating a second migration event", async () => {
    const raw = buildPreP0NestedData();
    fakeFirestore.set("cbam_cases", CASE_ID, storedRecord(raw));

    const opened = await getCase(CASE_ID);
    expect(opened).not.toBeNull();
    const updated = await updateCase(CASE_ID, OWNER_ID, opened!.data);

    const persistedEvents = updated.data.auditEvents.filter(
      (event) => event.action === "PRIOR_NESTED_CASE_ADAPTED"
    );
    expect(persistedEvents).toHaveLength(1);
    expect(updated.data.methodologyDecisions[0]?.reviewStatus).toBe("REVIEW_REQUIRED");
    expect(updated.data.evidenceRegister[0]?.qualityGrade).toBe("PENDING");

    const reopened = await getCase(CASE_ID);
    expect(reopened).not.toBeNull();
    const reopenedEvents = reopened!.data.auditEvents.filter(
      (event) => event.action === "PRIOR_NESTED_CASE_ADAPTED"
    );
    expect(reopenedEvents).toHaveLength(1);
  });
});
