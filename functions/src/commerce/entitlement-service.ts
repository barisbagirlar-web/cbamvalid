import admin from "firebase-admin";
// dbTransaction context validation matching comment
import { adminDb } from "../firebase-admin";
import { DoubleSpendViolationError, EntitlementUnavailableError } from "./commerce-errors";
import { writeLedgerEntry } from "./ledger-service";
import { validateIdentifier } from "../firestore-validator";

const DEFAULT_MAX_RELEASES = 5;

export interface Entitlement {
  entitlementId: string;
  uid: string;
  orderId: string;
  productCode: string;
  status: "AVAILABLE" | "RESERVED" | "CONSUMED" | "REVOKED";
  quantity: number;
  maxReleases?: number;
  createdAt: string;
  updatedAt: string;
  releasesCount: number;
  scopeCaseId?: string;
  reservedReportId?: string;
  reservationExpiresAt?: string;
  consumedReportId?: string;
  consumedAt?: string;
  releasesList: Array<{
    reportId: string;
    version: number;
    sequence: number;
    correctionReason?: string;
    documentHash: string;
    sealedAt: string;
  }>;
}

function normalizeEntitlement(data: unknown, documentId: string): Entitlement {
  if (!data || typeof data !== "object") throw new EntitlementUnavailableError("Entitlement payload is invalid.");
  const source = data as Partial<Entitlement>;
  return {
    entitlementId: source.entitlementId || documentId,
    uid: String(source.uid || ""),
    orderId: String(source.orderId || ""),
    productCode: String(source.productCode || ""),
    status: source.status || "REVOKED",
    quantity: Number(source.quantity || 1),
    maxReleases: Number(source.maxReleases || DEFAULT_MAX_RELEASES),
    createdAt: String(source.createdAt || new Date(0).toISOString()),
    updatedAt: String(source.updatedAt || new Date(0).toISOString()),
    releasesCount: Number(source.releasesCount || 0),
    scopeCaseId: source.scopeCaseId,
    reservedReportId: source.reservedReportId,
    reservationExpiresAt: source.reservationExpiresAt,
    consumedReportId: source.consumedReportId,
    consumedAt: source.consumedAt,
    releasesList: Array.isArray(source.releasesList) ? source.releasesList : [],
  };
}

async function assertCanonicalOrderEntitlement(
  transaction: admin.firestore.Transaction,
  entitlement: Entitlement
): Promise<void> {
  if (!entitlement.orderId) throw new EntitlementUnavailableError("Entitlement order scope is missing.");
  const query = adminDb.collection("entitlements").where("orderId", "==", entitlement.orderId);
  const snapshot = await transaction.get(query);
  const siblings = snapshot.docs
    .map((document) => normalizeEntitlement(document.data(), document.id))
    .filter((candidate) =>
      candidate.uid === entitlement.uid &&
      candidate.productCode === entitlement.productCode &&
      candidate.status !== "REVOKED"
    )
    .sort((left, right) => left.entitlementId.localeCompare(right.entitlementId));
  if (siblings.length === 0 || siblings[0].entitlementId !== entitlement.entitlementId) {
    throw new EntitlementUnavailableError(
      "This entitlement is a disabled duplicate from a legacy multi-entitlement unlock. Use the canonical pack entitlement."
    );
  }
}

export async function createEntitlement(
  transaction: admin.firestore.Transaction,
  params: {
    uid: string;
    orderId: string;
    transactionId: string;
    eventId: string;
    productCode: string;
    quantity: number;
  }
): Promise<Entitlement> {
  validateIdentifier("uid", params.uid);
  validateIdentifier("orderId", params.orderId);
  validateIdentifier("transactionId", params.transactionId);

  const entitlementRef = adminDb.collection("entitlements").doc();
  const now = new Date().toISOString();
  const entitlement: Entitlement = {
    entitlementId: entitlementRef.id,
    uid: params.uid,
    orderId: params.orderId,
    productCode: params.productCode,
    status: "AVAILABLE",
    quantity: params.quantity,
    maxReleases: DEFAULT_MAX_RELEASES,
    createdAt: now,
    updatedAt: now,
    releasesCount: 0,
    releasesList: [],
  };
  await writeLedgerEntry(transaction, {
    uid: params.uid,
    orderId: params.orderId,
    transactionId: params.transactionId,
    eventId: params.eventId,
    type: "ENTITLEMENT_ISSUED",
    quantity: params.quantity,
    idempotencyKey: `entitlement:${params.transactionId}:${params.productCode}`,
  });
  transaction.set(entitlementRef, entitlement);
  return entitlement;
}

export async function reserveEntitlement(
  transaction: admin.firestore.Transaction,
  params: { entitlementId: string; uid: string; reportId: string; caseId: string; expiresInSeconds?: number; auth?: any }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  validateIdentifier("uid", params.uid);
  validateIdentifier("reportId", params.reportId);
  validateIdentifier("caseId", params.caseId);

  const entitlementRef = adminDb.collection("entitlements").doc(params.entitlementId);
  const snapshot = await transaction.get(entitlementRef);
  if (!snapshot.exists) throw new EntitlementUnavailableError(`Entitlement ${params.entitlementId} was not found.`);
  const entitlement = normalizeEntitlement(snapshot.data(), snapshot.id);
  if (entitlement.uid !== params.uid) throw new EntitlementUnavailableError("Ownership mismatch on requested entitlement.");
  await assertCanonicalOrderEntitlement(transaction, entitlement);

  const maxReleases = entitlement.maxReleases || DEFAULT_MAX_RELEASES;
  if (entitlement.releasesCount >= maxReleases || entitlement.status === "CONSUMED") {
    throw new EntitlementUnavailableError(`The pack has reached its ${maxReleases}-release limit.`);
  }
  if (entitlement.scopeCaseId && entitlement.scopeCaseId !== params.caseId) {
    throw new EntitlementUnavailableError(`The pack is scope-locked to case ${entitlement.scopeCaseId}.`);
  }
  const now = new Date();
  const reservationExpired = entitlement.reservationExpiresAt
    ? new Date(entitlement.reservationExpiresAt).getTime() < now.getTime()
    : false;
  if (entitlement.status !== "AVAILABLE" && !reservationExpired) {
    throw new DoubleSpendViolationError(params.entitlementId);
  }

  const reservationExpiresAt = new Date(
    now.getTime() + (params.expiresInSeconds || 300) * 1000
  ).toISOString();
  await writeLedgerEntry(transaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `reserve_${params.reportId}`,
    type: "ENTITLEMENT_RESERVED",
    quantity: 1,
    idempotencyKey: `reserve:${params.entitlementId}:${params.reportId}`,
    ...(params.auth?.token?.syntheticTest ? {
      syntheticTest: true,
      environment: params.auth.token.environment || "",
      testRunId: params.auth.token.testRunId || "",
      testLifecycle: "ACTIVE_TEST",
    } : {}),
  });
  transaction.update(entitlementRef, {
    status: "RESERVED",
    reservedReportId: params.reportId,
    reservationExpiresAt,
    updatedAt: now.toISOString(),
  });
  return { ...entitlement, status: "RESERVED", reservedReportId: params.reportId, reservationExpiresAt, updatedAt: now.toISOString() };
}

export async function consumeEntitlement(
  transaction: admin.firestore.Transaction,
  params: {
    entitlementId: string;
    uid: string;
    reportId: string;
    caseId: string;
    reportHash: string;
    version: number;
    correctionReason?: string;
    auth?: any;
  }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  validateIdentifier("uid", params.uid);
  validateIdentifier("reportId", params.reportId);
  validateIdentifier("caseId", params.caseId);

  const entitlementRef = adminDb.collection("entitlements").doc(params.entitlementId);
  const snapshot = await transaction.get(entitlementRef);
  if (!snapshot.exists) throw new EntitlementUnavailableError(`Entitlement ${params.entitlementId} was not found.`);
  const entitlement = normalizeEntitlement(snapshot.data(), snapshot.id);
  if (entitlement.uid !== params.uid) throw new EntitlementUnavailableError("Ownership mismatch on requested entitlement.");
  if (entitlement.status !== "RESERVED" || entitlement.reservedReportId !== params.reportId) {
    throw new DoubleSpendViolationError(params.entitlementId);
  }
  if (entitlement.scopeCaseId && entitlement.scopeCaseId !== params.caseId) {
    throw new EntitlementUnavailableError("Scope mismatch on consumption.");
  }

  const maxReleases = entitlement.maxReleases || DEFAULT_MAX_RELEASES;
  const newCount = entitlement.releasesCount + 1;
  if (newCount > maxReleases) throw new EntitlementUnavailableError("Release limit exceeded.");
  if (newCount > 1 && !params.correctionReason?.trim()) {
    throw new EntitlementUnavailableError("A correction reason is required after the first release.");
  }

  const now = new Date().toISOString();
  const releaseItem = {
    reportId: params.reportId,
    version: params.version,
    sequence: newCount,
    correctionReason: params.correctionReason || "",
    documentHash: params.reportHash,
    sealedAt: now,
  };
  const releasesList = [...entitlement.releasesList, releaseItem];
  const status: Entitlement["status"] = newCount === maxReleases ? "CONSUMED" : "AVAILABLE";
  await writeLedgerEntry(transaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `consume_${params.reportId}_${newCount}`,
    type: "ENTITLEMENT_CONSUMED",
    quantity: 1,
    idempotencyKey: `consume:${params.entitlementId}:${params.reportId}:${newCount}`,
    ...(params.auth?.token?.syntheticTest ? {
      syntheticTest: true,
      environment: params.auth.token.environment || "",
      testRunId: params.auth.token.testRunId || "",
      testLifecycle: "COMPLETED_TEST",
    } : {}),
  });
  transaction.update(entitlementRef, {
    status,
    releasesCount: newCount,
    maxReleases,
    scopeCaseId: params.caseId,
    releasesList,
    consumedReportId: params.reportId,
    consumedAt: now,
    updatedAt: now,
    reservedReportId: null,
    reservationExpiresAt: null,
  });
  return { ...entitlement, status, releasesCount: newCount, maxReleases, scopeCaseId: params.caseId, releasesList, consumedReportId: params.reportId, consumedAt: now, updatedAt: now, reservedReportId: undefined, reservationExpiresAt: undefined };
}

export async function releaseEntitlementReservation(
  transaction: admin.firestore.Transaction,
  params: { entitlementId: string; uid: string; reportId: string }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  validateIdentifier("uid", params.uid);
  validateIdentifier("reportId", params.reportId);
  const entitlementRef = adminDb.collection("entitlements").doc(params.entitlementId);
  const snapshot = await transaction.get(entitlementRef);
  if (!snapshot.exists) throw new EntitlementUnavailableError();
  const entitlement = normalizeEntitlement(snapshot.data(), snapshot.id);
  if (entitlement.uid !== params.uid) throw new EntitlementUnavailableError("Ownership mismatch.");
  if (entitlement.status !== "RESERVED" || entitlement.reservedReportId !== params.reportId) return entitlement;

  const maxReleases = entitlement.maxReleases || DEFAULT_MAX_RELEASES;
  const status: Entitlement["status"] = entitlement.releasesCount >= maxReleases ? "CONSUMED" : "AVAILABLE";
  const now = new Date().toISOString();
  await writeLedgerEntry(transaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `release_${params.reportId}`,
    type: "ENTITLEMENT_RELEASED",
    quantity: 1,
    idempotencyKey: `release:${params.entitlementId}:${params.reportId}`,
  });
  transaction.update(entitlementRef, { status, reservedReportId: null, reservationExpiresAt: null, updatedAt: now });
  return { ...entitlement, status, updatedAt: now, reservedReportId: undefined, reservationExpiresAt: undefined };
}

export async function revokeEntitlement(
  transaction: admin.firestore.Transaction,
  params: { entitlementId: string; eventId: string }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  const entitlementRef = adminDb.collection("entitlements").doc(params.entitlementId);
  const snapshot = await transaction.get(entitlementRef);
  if (!snapshot.exists) throw new EntitlementUnavailableError();
  const entitlement = normalizeEntitlement(snapshot.data(), snapshot.id);
  const now = new Date().toISOString();
  await writeLedgerEntry(transaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: params.eventId,
    type: "ENTITLEMENT_REVOKED",
    quantity: 1,
    idempotencyKey: `revoke:${params.entitlementId}:${params.eventId}`,
  });
  transaction.update(entitlementRef, { status: "REVOKED", reservedReportId: null, reservationExpiresAt: null, updatedAt: now });
  return { ...entitlement, status: "REVOKED", updatedAt: now };
}
