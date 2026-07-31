import { createHash } from "node:crypto";
import { AuditReadyCaseSchema, type AuditReadyCase } from "../schema";
import { isRecognizedLegacyCaseData } from "./legacy-case-adapter";

type UnknownRecord = Record<string, unknown>;

const METHODOLOGY_PROVENANCE_FIELDS = ["approverName", "approverRole", "approvedAt"] as const;

const ISO_DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

const EVIDENCE_ENUM_FIELDS: ReadonlyArray<{
  key: string;
  allowed: readonly string[];
  safeFallback: string;
}> = [
  {
    key: "reviewStatus",
    allowed: ["PENDING", "APPROVED", "REJECTED"],
    safeFallback: "PENDING",
  },
  {
    key: "supportStatus",
    allowed: [
      "PENDING",
      "SUPPORTED",
      "PARTIALLY_SUPPORTED",
      "UNSUPPORTED",
      "NOT_REQUIRED",
    ],
    safeFallback: "PENDING",
  },
  {
    key: "malwareScanStatus",
    allowed: ["CLEAN", "INFECTED", "PENDING"],
    safeFallback: "PENDING",
  },
  {
    key: "confidentiality",
    allowed: ["CONFIDENTIAL", "INTERNAL", "PUBLIC"],
    safeFallback: "CONFIDENTIAL",
  },
  {
    key: "qualityGrade",
    allowed: ["A", "B", "C", "D", "E", "PENDING"],
    safeFallback: "PENDING",
  },
];

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: UnknownRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function validIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

/**
 * Canonical stringification (sorted object keys) so the same stored record
 * always yields the same migration event ID — independent of Firestore key
 * ordering between reads.
 */
function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function deterministicMigrationEventId(caseId: string, rawData: unknown): string {
  const digest = createHash("sha256")
    .update(`prior-case-adapter:${caseId}:${canonicalStringify(rawData)}`)
    .digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function hasFullApprovalProvenance(decision: UnknownRecord): boolean {
  return METHODOLOGY_PROVENANCE_FIELDS.every((key) => {
    const value = decision[key];
    if (!hasOwn(decision, key)) return false;
    if (key === "approvedAt") {
      return (
        typeof value === "string" &&
        ISO_DATETIME_PATTERN.test(value) &&
        !Number.isNaN(Date.parse(value))
      );
    }
    return typeof value === "string" && value.trim().length > 0;
  });
}

/**
 * A pre-P0 nested AuditReadyCase record carries the nested case structure
 * (importerIdentity, exporterIdentity, installation, goods, evidenceRegister)
 * and is NOT a flat V1 legacy draft. It is only consulted when the current
 * schema has already failed, so a genuinely current record never reaches here.
 */
export function isRecognizedPriorNestedCaseData(value: unknown): value is UnknownRecord {
  if (!isRecord(value)) return false;
  const nestedStructurePresent =
    isRecord(value.importerIdentity) &&
    isRecord(value.exporterIdentity) &&
    isRecord(value.installation) &&
    Array.isArray(value.goods) &&
    Array.isArray(value.evidenceRegister);
  if (!nestedStructurePresent) return false;
  return !isRecognizedLegacyCaseData(value);
}

interface PriorNestedMigration {
  caseData: UnknownRecord;
  downgradedDecisionIds: string[];
  evidenceSchemaPaths: string[];
}

function migratePriorNestedRecord(source: UnknownRecord): PriorNestedMigration {
  const caseData: UnknownRecord = { ...source };
  const downgradedDecisionIds: string[] = [];
  const evidenceSchemaPaths: string[] = [];

  if (Array.isArray(source.methodologyDecisions)) {
    caseData.methodologyDecisions = source.methodologyDecisions.map((raw) => {
      if (!isRecord(raw) || raw.reviewStatus !== "ACCEPTED") return raw;
      if (hasFullApprovalProvenance(raw)) return raw;
      const decisionId = typeof raw.decisionId === "string" ? raw.decisionId : "";
      if (decisionId) downgradedDecisionIds.push(decisionId);
      return { ...raw, reviewStatus: "REVIEW_REQUIRED" };
    });
  }

  if (Array.isArray(source.evidenceRegister)) {
    caseData.evidenceRegister = source.evidenceRegister.map((raw, index) => {
      if (!isRecord(raw)) return raw;
      const record: UnknownRecord = { ...raw };
      let changed = false;

      // Legacy records without structured quality metadata are never auto
      // graded A/B; leave them explicitly PENDING for reassessment.
      if (record.qualityGrade === undefined || record.qualityGrade === null) {
        record.qualityGrade = "PENDING";
        changed = true;
      }

      for (const { key, allowed, safeFallback } of EVIDENCE_ENUM_FIELDS) {
        const value = record[key];
        if (value === undefined || value === null) continue;
        if (typeof value === "string" && allowed.includes(value)) continue;
        record[key] = safeFallback;
        evidenceSchemaPaths.push(`evidenceRegister[${index}].${key}`);
        changed = true;
      }

      return changed ? record : raw;
    });
  }

  return { caseData, downgradedDecisionIds, evidenceSchemaPaths };
}

/**
 * Read-compatibility adapter for nested AuditReadyCase records written before
 * the FAZ P0 schema hardening (PR #82). It never fabricates business,
 * commercial, calculation or evidence values: it only downgrades ACCEPTED
 * methodology decisions whose approval provenance is incomplete, safely
 * coerces invalid legacy evidence enums, and records a deterministic audit
 * event describing the read-compatibility view.
 */
export function adaptPriorAuditReadyCaseData(params: {
  rawData: unknown;
  caseId: string;
  uid: string;
  createdAt: string;
  updatedAt: string;
}): AuditReadyCase | null {
  if (!isRecognizedPriorNestedCaseData(params.rawData)) return null;
  const source = params.rawData;

  const { caseData, downgradedDecisionIds, evidenceSchemaPaths } =
    migratePriorNestedRecord(source);

  const parsed = AuditReadyCaseSchema.safeParse({
    ...caseData,
    caseId: params.caseId,
    ownerId: params.uid,
  });
  if (!parsed.success) return null;

  const migrationActive = downgradedDecisionIds.length > 0 || evidenceSchemaPaths.length > 0;
  if (!migrationActive) return parsed.data;

  const existingEventIds = new Set(parsed.data.auditEvents.map((event) => event.eventId));
  const eventId = deterministicMigrationEventId(params.caseId, source);
  if (existingEventIds.has(eventId)) return parsed.data;

  const eventTimestamp = validIsoTimestamp(
    params.updatedAt,
    validIsoTimestamp(params.createdAt, "1970-01-01T00:00:00.000Z")
  );

  return AuditReadyCaseSchema.parse({
    ...parsed.data,
    auditEvents: [
      ...parsed.data.auditEvents,
      {
        eventId,
        timestamp: eventTimestamp,
        actor: params.uid,
        action: "PRIOR_NESTED_CASE_ADAPTED",
        metadata: {
          sourceSchema: "AUDIT_READY_PRE_P0",
          migrationMode: "READ_COMPATIBILITY_VIEW",
          downgradedAcceptedDecisionIds: downgradedDecisionIds,
          reason: "ACCEPTED_DECISION_PROVENANCE_MISSING",
          ...(evidenceSchemaPaths.length > 0 ? { evidenceSchemaPaths } : {}),
        },
      },
    ],
  });
}
