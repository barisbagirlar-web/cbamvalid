#!/usr/bin/env npx tsx
/**
 * FAZ P0 hotfix diagnostic — inspect a single stored CBAM case for schema
 * compatibility without writing anything to Firestore.
 *
 * Usage:
 *   CASE_ID="<full-case-id>" npx tsx scripts/inspect-case-schema-compatibility.ts
 *
 * Defaults to read-only; refuses to run when a write flag is set. It prints
 * only non-PII compatibility facts: schema pass state, adapter recognition
 * flags, zod issue paths/codes, downgraded decision IDs and a business-value
 * diff count. Raw customer values are never printed.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";
import { AuditReadyCaseSchema } from "../functions/src/cbam/schema";
import {
  adaptPriorAuditReadyCaseData,
  isRecognizedPriorNestedCaseData,
} from "../functions/src/cbam/storage/prior-case-adapter";
import {
  adaptLegacyCaseData,
  isRecognizedLegacyCaseData,
} from "../functions/src/cbam/storage/legacy-case-adapter";

type UnknownRecord = Record<string, unknown>;

function loadEnvLocal(): Record<string, string> {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return {};
  const result: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    result[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return result;
}

function isMigrationArtifactPath(path: string): boolean {
  if (path === "caseId" || path === "ownerId" || path === "auditEvents") return true;
  if (/^methodologyDecisions\[\d+\]\.reviewStatus$/.test(path)) return true;
  if (/^evidenceRegister\[\d+\]\.qualityGrade$/.test(path)) return true;
  return false;
}

function findBusinessValueDiffs(source: unknown, migrated: unknown, path = ""): string[] {
  const diffs: string[] = [];
  if (isMigrationArtifactPath(path)) return diffs;

  const isObject = (value: unknown): value is UnknownRecord =>
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

async function main(): Promise<void> {
  const caseId = (process.env.CASE_ID ?? "").trim();
  if (!caseId) {
    console.error("CASE_ID=<full-case-id> is required.");
    process.exit(2);
  }
  const writeMode = (process.env.WRITE_MODE ?? "").toLowerCase();
  if (writeMode === "1" || writeMode === "true") {
    console.error("This inspector is read-only and never writes to Firestore.");
    process.exit(2);
  }

  const env = loadEnvLocal();
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "cbam-desk";

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
  }

  const collection = admin.firestore().collection("cbam_cases");
  const canonical = await collection.doc(caseId).get();
  let snapshot = canonical.exists ? canonical : null;
  if (!snapshot) {
    const query = await collection.where("caseId", "==", caseId).limit(2).get();
    if (query.docs.length !== 1) {
      console.log("CASE_FOUND=false");
      process.exit(1);
    }
    snapshot = query.docs[0]!;
  }

  const doc = snapshot.data() as UnknownRecord;
  const data = doc.data as unknown;
  const uid = typeof doc.uid === "string" ? doc.uid : "";
  const createdAt = typeof doc.createdAt === "string" ? doc.createdAt : new Date(0).toISOString();
  const updatedAt = typeof doc.updatedAt === "string" ? doc.updatedAt : new Date(0).toISOString();

  const current = AuditReadyCaseSchema.safeParse({
    ...(data as UnknownRecord),
    caseId,
    ownerId: uid,
  });
  const issuePaths = current.success
    ? []
    : current.error.issues.map((issue) => issue.path.join(".")).filter(Boolean);

  const priorRecognized = isRecognizedPriorNestedCaseData(data);
  const flatRecognized = isRecognizedLegacyCaseData(data);

  let downgradedDecisionIds: string[] = [];
  let businessValueDiffCount = 0;
  let adapterResult = "CURRENT_SCHEMA";

  if (!current.success) {
    const adapted = adaptPriorAuditReadyCaseData({
      rawData: data,
      caseId,
      uid,
      createdAt,
      updatedAt,
    });
    if (adapted) {
      adapterResult = "PRIOR_NESTED_READ_VIEW";
      const event = adapted.auditEvents.find(
        (entry) => entry.action === "PRIOR_NESTED_CASE_ADAPTED"
      );
      const metadata = event?.metadata as UnknownRecord | undefined;
      downgradedDecisionIds = Array.isArray(metadata?.downgradedAcceptedDecisionIds)
        ? (metadata?.downgradedAcceptedDecisionIds as string[])
        : [];
      businessValueDiffCount = findBusinessValueDiffs(data, adapted).length;
    } else {
      const legacy = adaptLegacyCaseData({
        rawData: data,
        caseId,
        uid,
        createdAt,
        updatedAt,
      });
      if (legacy) {
        adapterResult = "FLAT_V1_READ_VIEW";
      } else {
        adapterResult = "UNSUPPORTED";
      }
    }
  }

  console.log(`CURRENT_SCHEMA_PASS=${current.success ? "true" : "false"}`);
  console.log(`PRIOR_NESTED_RECOGNIZED=${priorRecognized ? "true" : "false"}`);
  console.log(`FLAT_V1_RECOGNIZED=${flatRecognized ? "true" : "false"}`);
  console.log(`ISSUE_PATHS=${JSON.stringify(issuePaths)}`);
  console.log(`DOWNGRADED_DECISION_IDS=${JSON.stringify(downgradedDecisionIds)}`);
  console.log(`BUSINESS_VALUE_DIFF_COUNT=${businessValueDiffCount}`);
  console.log(`ADAPTER_RESULT=${adapterResult}`);
}

main().catch((error: unknown) => {
  console.error(
    `INSPECT_ERROR=${error instanceof Error ? error.message : "UNKNOWN_INSPECT_ERROR"}`
  );
  process.exit(1);
});
