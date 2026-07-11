import admin from "firebase-admin";
import { getAdminDb } from "../firebase/admin";
import { DoubleSpendViolationError, EntitlementUnavailableError } from "./commerce-errors";
import { writeLedgerEntry } from "./ledger-service";
import { validateIdentifier } from "../firebase/firestore-validator";

export interface Entitlement {
  entitlementId: string;
  uid: string;
  orderId: string;
  productCode: string;
  status: "AVAILABLE" | "RESERVED" | "CONSUMED" | "REVOKED";
  quantity: number; // typically 1 for CBAM dossiers
  createdAt: string;
  updatedAt: string;
  reservedReportId?: string;
  reservationExpiresAt?: string;
  consumedReportId?: string;
  consumedAt?: string;
}

/**
 * Creates a new entitlement after a successful payment transaction
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
  }
): Promise<Entitlement> {
  validateIdentifier("uid", params.uid);
  validateIdentifier("orderId", params.orderId);
  validateIdentifier("transactionId", params.transactionId);

  const entitlementRef = getAdminDb().collection("entitlements").doc();
  const entitlementId = entitlementRef.id;
  const now = new Date().toISOString();

  const entitlement: Entitlement = {
    entitlementId,
    uid: params.uid,
    orderId: params.orderId,
    productCode: params.productCode,
    status: "AVAILABLE",
    quantity: params.quantity,
    createdAt: now,
    updatedAt: now,
  };

  dbTransaction.set(entitlementRef, entitlement);

  // Write to ledger
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

/**
 * Phase 1: Reserve Entitlement (Double-Spend Protection)
 */
export async function reserveEntitlement(
  dbTransaction: admin.firestore.Transaction,
  params: {
    entitlementId: string;
    uid: string;
    reportId: string;
    expiresInSeconds?: number;
  }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  validateIdentifier("uid", params.uid);
  validateIdentifier("reportId", params.reportId);

  const entitlementRef = getAdminDb().collection("entitlements").doc(params.entitlementId);
  const snapshot: any = await dbTransaction.get(entitlementRef as any);

  if (!snapshot.exists) {
    throw new EntitlementUnavailableError(`Entitlement with ID ${params.entitlementId} was not found.`);
  }

  const entitlement = snapshot.data() as Entitlement;

  if (entitlement.uid !== params.uid) {
    throw new EntitlementUnavailableError("Ownership mismatch on requested entitlement.");
  }

  // Handle expired reservation auto-recovery
  const now = new Date();
  const isExpired =
    entitlement.status === "RESERVED" &&
    entitlement.reservationExpiresAt &&
    new Date(entitlement.reservationExpiresAt) < now;

  if (entitlement.status !== "AVAILABLE" && !isExpired) {
    throw new DoubleSpendViolationError(params.entitlementId);
  }

  const defaultDuration = params.expiresInSeconds || 300; // 5 minutes default
  const expiresAt = new Date(now.getTime() + defaultDuration * 1000).toISOString();

  const updatedEntitlement: Partial<Entitlement> = {
    status: "RESERVED",
    reservedReportId: params.reportId,
    reservationExpiresAt: expiresAt,
    updatedAt: now.toISOString(),
  };

  dbTransaction.update(entitlementRef, updatedEntitlement);

  // Write to ledger
  await writeLedgerEntry(dbTransaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `reserve_${params.reportId}_${new Date().getTime()}`,
    type: "ENTITLEMENT_RESERVED",
    quantity: entitlement.quantity,
    idempotencyKey: `reserve:${params.entitlementId}:${params.reportId}`,
  });

  return { ...entitlement, ...updatedEntitlement };
}

/**
 * Phase 2: Seal and Consume Entitlement (Finalizes consumption after report is built successfully)
 */
export async function consumeEntitlement(
  dbTransaction: admin.firestore.Transaction,
  params: {
    entitlementId: string;
    uid: string;
    reportId: string;
    reportHash: string;
  }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  validateIdentifier("uid", params.uid);
  validateIdentifier("reportId", params.reportId);

  const entitlementRef = getAdminDb().collection("entitlements").doc(params.entitlementId);
  const snapshot: any = await dbTransaction.get(entitlementRef as any);

  if (!snapshot.exists) {
    throw new EntitlementUnavailableError(`Entitlement with ID ${params.entitlementId} was not found.`);
  }

  const entitlement = snapshot.data() as Entitlement;

  if (entitlement.uid !== params.uid) {
    throw new EntitlementUnavailableError("Ownership mismatch on requested entitlement.");
  }

  if (entitlement.status !== "RESERVED" || entitlement.reservedReportId !== params.reportId) {
    throw new DoubleSpendViolationError(params.entitlementId);
  }

  const now = new Date().toISOString();
  const updatedEntitlement: Partial<Entitlement> = {
    status: "CONSUMED",
    consumedReportId: params.reportId,
    consumedAt: now,
    updatedAt: now,
  };

  dbTransaction.update(entitlementRef, updatedEntitlement);

  // Write to ledger
  await writeLedgerEntry(dbTransaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `consume_${params.reportId}_${new Date().getTime()}`,
    type: "ENTITLEMENT_CONSUMED",
    quantity: entitlement.quantity,
    idempotencyKey: `consume:${params.entitlementId}:${params.reportId}`,
  });

  return { ...entitlement, ...updatedEntitlement };
}

/**
 * Reverts an active reservation to AVAILABLE in case of report generation errors
 */
export async function releaseEntitlementReservation(
  dbTransaction: admin.firestore.Transaction,
  params: {
    entitlementId: string;
    uid: string;
    reportId: string;
  }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  validateIdentifier("uid", params.uid);
  validateIdentifier("reportId", params.reportId);

  const entitlementRef = getAdminDb().collection("entitlements").doc(params.entitlementId);
  const snapshot: any = await dbTransaction.get(entitlementRef as any);

  if (!snapshot.exists) {
    throw new EntitlementUnavailableError();
  }

  const entitlement = snapshot.data() as Entitlement;

  if (entitlement.uid !== params.uid) {
    throw new EntitlementUnavailableError("Ownership mismatch.");
  }

  if (entitlement.status !== "RESERVED" || entitlement.reservedReportId !== params.reportId) {
    return entitlement; // No-op if not reserved by this report
  }

  const now = new Date().toISOString();
  const updatedEntitlement: Partial<Entitlement> = {
    status: "AVAILABLE",
    reservedReportId: undefined,
    reservationExpiresAt: undefined,
    updatedAt: now,
  };

  dbTransaction.update(entitlementRef, {
    status: "AVAILABLE",
    reservedReportId: null,
    reservationExpiresAt: null,
    updatedAt: now,
  });

  // Write to ledger
  await writeLedgerEntry(dbTransaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `release_${params.reportId}_${new Date().getTime()}`,
    type: "ENTITLEMENT_RELEASED",
    quantity: entitlement.quantity,
    idempotencyKey: `release:${params.entitlementId}:${params.reportId}`,
  });

  return { ...entitlement, ...updatedEntitlement };
}

/**
 * Revokes an entitlement entirely (e.g. during a checkout refund process)
 */
export async function revokeEntitlement(
  dbTransaction: admin.firestore.Transaction,
  params: {
    entitlementId: string;
    eventId: string;
  }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);

  const entitlementRef = getAdminDb().collection("entitlements").doc(params.entitlementId);
  const snapshot: any = await dbTransaction.get(entitlementRef as any);

  if (!snapshot.exists) {
    throw new EntitlementUnavailableError();
  }

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
