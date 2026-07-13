import admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { DoubleSpendViolationError, EntitlementUnavailableError } from "./commerce-errors";
import { writeLedgerEntry } from "./ledger-service";
import { validateIdentifier } from "../firestore-validator";

export interface Entitlement {
  entitlementId: string;
  uid: string;
  orderId: string;
  caseId?: string;
  productCode: string;
  status: "AVAILABLE" | "RESERVED" | "CONSUMED" | "REVOKED";
  quantity: number;
  versionSequence?: number;
  createdAt: string;
  updatedAt: string;
  reservedReportId?: string;
  reservationExpiresAt?: string;
  consumedReportId?: string;
  consumedAt?: string;
}

/**
 * Legacy single-document issuer. New Preparation Pack purchases use
 * issuePreparationPack(), which emits five case-bound quantity-one documents.
 */
export async function createEntitlement(
  dbTransaction: admin.firestore.Transaction,
  params: {
    uid: string;
    orderId: string;
    transactionId: string;
    eventId: string;
    productCode: string;
    quantity: number;
    caseId?: string;
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
    caseId: params.caseId,
    productCode: params.productCode,
    status: "AVAILABLE",
    quantity: params.quantity,
    createdAt: now,
    updatedAt: now,
  };

  dbTransaction.set(entitlementRef, entitlement);
  await writeLedgerEntry(dbTransaction, {
    uid: params.uid,
    orderId: params.orderId,
    transactionId: params.transactionId,
    eventId: params.eventId,
    type: "ENTITLEMENT_ISSUED",
    quantity: params.quantity,
    idempotencyKey: `entitlement:${params.transactionId}:${params.productCode}`,
  });

  return entitlement;
}

export async function reserveEntitlement(
  dbTransaction: admin.firestore.Transaction,
  params: {
    entitlementId: string;
    uid: string;
    caseId: string;
    reportId: string;
    expiresInSeconds?: number;
  }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  validateIdentifier("uid", params.uid);
  validateIdentifier("caseId", params.caseId);
  validateIdentifier("reportId", params.reportId);

  const entitlementRef = adminDb.collection("entitlements").doc(params.entitlementId);
  const snapshot: any = await dbTransaction.get(entitlementRef as any);
  if (!snapshot.exists) {
    throw new EntitlementUnavailableError(`Entitlement with ID ${params.entitlementId} was not found.`);
  }

  const entitlement = snapshot.data() as Entitlement;
  if (entitlement.uid !== params.uid) {
    throw new EntitlementUnavailableError("Ownership mismatch on requested entitlement.");
  }
  if (!entitlement.caseId || entitlement.caseId !== params.caseId) {
    throw new EntitlementUnavailableError("This report version belongs to a different dossier.");
  }
  if (entitlement.quantity !== 1) {
    throw new EntitlementUnavailableError("Entitlement quantity is invalid for a sealed version.");
  }

  const now = new Date();
  const isExpired =
    entitlement.status === "RESERVED" &&
    entitlement.reservationExpiresAt &&
    new Date(entitlement.reservationExpiresAt) < now;

  if (entitlement.status !== "AVAILABLE" && !isExpired) {
    throw new DoubleSpendViolationError(params.entitlementId);
  }

  const expiresAt = new Date(now.getTime() + (params.expiresInSeconds || 900) * 1000).toISOString();
  const updatedEntitlement: Partial<Entitlement> = {
    status: "RESERVED",
    reservedReportId: params.reportId,
    reservationExpiresAt: expiresAt,
    updatedAt: now.toISOString(),
  };

  dbTransaction.update(entitlementRef, updatedEntitlement);
  await writeLedgerEntry(dbTransaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `reserve_${params.reportId}`,
    type: "ENTITLEMENT_RESERVED",
    quantity: 1,
    idempotencyKey: `reserve:${params.entitlementId}:${params.reportId}`,
  });

  return { ...entitlement, ...updatedEntitlement };
}

export async function consumeEntitlement(
  dbTransaction: admin.firestore.Transaction,
  params: {
    entitlementId: string;
    uid: string;
    caseId: string;
    reportId: string;
    reportHash: string;
  }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  validateIdentifier("uid", params.uid);
  validateIdentifier("caseId", params.caseId);
  validateIdentifier("reportId", params.reportId);

  const entitlementRef = adminDb.collection("entitlements").doc(params.entitlementId);
  const snapshot: any = await dbTransaction.get(entitlementRef as any);
  if (!snapshot.exists) {
    throw new EntitlementUnavailableError(`Entitlement with ID ${params.entitlementId} was not found.`);
  }

  const entitlement = snapshot.data() as Entitlement;
  if (entitlement.uid !== params.uid || entitlement.caseId !== params.caseId) {
    throw new EntitlementUnavailableError("Ownership or dossier mismatch on requested entitlement.");
  }
  if (entitlement.status !== "RESERVED" || entitlement.reservedReportId !== params.reportId) {
    throw new DoubleSpendViolationError(params.entitlementId);
  }

  const now = new Date().toISOString();
  const updatedEntitlement: Partial<Entitlement> = {
    status: "CONSUMED",
    consumedReportId: params.reportId,
    consumedAt: now,
    reservationExpiresAt: undefined,
    updatedAt: now,
  };

  dbTransaction.update(entitlementRef, {
    ...updatedEntitlement,
    reservationExpiresAt: null,
  });

  await writeLedgerEntry(dbTransaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `consume_${params.reportId}`,
    type: "ENTITLEMENT_CONSUMED",
    quantity: 1,
    idempotencyKey: `consume:${params.entitlementId}:${params.reportId}`,
  });

  return { ...entitlement, ...updatedEntitlement };
}

export async function releaseEntitlementReservation(
  dbTransaction: admin.firestore.Transaction,
  params: {
    entitlementId: string;
    uid: string;
    caseId: string;
    reportId: string;
  }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  validateIdentifier("uid", params.uid);
  validateIdentifier("caseId", params.caseId);
  validateIdentifier("reportId", params.reportId);

  const entitlementRef = adminDb.collection("entitlements").doc(params.entitlementId);
  const snapshot: any = await dbTransaction.get(entitlementRef as any);
  if (!snapshot.exists) throw new EntitlementUnavailableError();

  const entitlement = snapshot.data() as Entitlement;
  if (entitlement.uid !== params.uid || entitlement.caseId !== params.caseId) {
    throw new EntitlementUnavailableError("Ownership or dossier mismatch.");
  }
  if (entitlement.status !== "RESERVED" || entitlement.reservedReportId !== params.reportId) {
    return entitlement;
  }

  const now = new Date().toISOString();
  dbTransaction.update(entitlementRef, {
    status: "AVAILABLE",
    reservedReportId: null,
    reservationExpiresAt: null,
    updatedAt: now,
  });

  await writeLedgerEntry(dbTransaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `release_${params.reportId}`,
    type: "ENTITLEMENT_RELEASED",
    quantity: 1,
    idempotencyKey: `release:${params.entitlementId}:${params.reportId}`,
  });

  return {
    ...entitlement,
    status: "AVAILABLE",
    reservedReportId: undefined,
    reservationExpiresAt: undefined,
    updatedAt: now,
  };
}

export async function revokeEntitlement(
  dbTransaction: admin.firestore.Transaction,
  params: { entitlementId: string; eventId: string }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  const entitlementRef = adminDb.collection("entitlements").doc(params.entitlementId);
  const snapshot: any = await dbTransaction.get(entitlementRef as any);
  if (!snapshot.exists) throw new EntitlementUnavailableError();

  const entitlement = snapshot.data() as Entitlement;
  const now = new Date().toISOString();
  dbTransaction.update(entitlementRef, {
    status: "REVOKED",
    reservedReportId: null,
    reservationExpiresAt: null,
    updatedAt: now,
  });

  await writeLedgerEntry(dbTransaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: params.eventId,
    type: "ENTITLEMENT_REVOKED",
    quantity: entitlement.quantity,
    idempotencyKey: `revoke:${params.entitlementId}:${params.eventId}`,
  });

  return { ...entitlement, status: "REVOKED", updatedAt: now };
}
