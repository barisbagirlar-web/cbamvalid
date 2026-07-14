import admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { DoubleSpendViolationError, EntitlementUnavailableError } from "./commerce-errors";
import { writeLedgerEntry } from "./ledger-service";
import { validateIdentifier } from "../firestore-validator";

export interface Entitlement {
  entitlementId: string;
  uid: string;
  orderId: string;
  productCode: string;
  status: "AVAILABLE" | "RESERVED" | "CONSUMED" | "REVOKED";
  quantity: number; // typically 1 for CBAM dossiers
  createdAt: string;
  updatedAt: string;
  releasesCount: number; // Track release count (0 to 5)
  scopeCaseId?: string; // locked to this caseId after the first release
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

  const entitlementRef = adminDb.collection("entitlements").doc();
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
    releasesCount: 0,
    releasesList: [],
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
 * Phase 1: Reserve Entitlement (Double-Spend Protection & Scope Locking)
 */
export async function reserveEntitlement(
  dbTransaction: admin.firestore.Transaction,
  params: {
    entitlementId: string;
    uid: string;
    reportId: string;
    caseId: string;
    expiresInSeconds?: number;
  }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  validateIdentifier("uid", params.uid);
  validateIdentifier("reportId", params.reportId);
  validateIdentifier("caseId", params.caseId);

  const entitlementRef = adminDb.collection("entitlements").doc(params.entitlementId);
  const snapshot: any = await dbTransaction.get(entitlementRef as any);

  if (!snapshot.exists) {
    throw new EntitlementUnavailableError(`Entitlement with ID ${params.entitlementId} was not found.`);
  }

  const entitlement = snapshot.data() as Entitlement;

  if (entitlement.uid !== params.uid) {
    throw new EntitlementUnavailableError("Ownership mismatch on requested entitlement.");
  }

  // Prevent sixth release
  const currentCount = entitlement.releasesCount || 0;
  if (currentCount >= 5 || entitlement.status === "CONSUMED") {
    throw new EntitlementUnavailableError("Entitlement has already reached the maximum limit of 5 releases.");
  }

  // Scope Locking: if entitlement is already locked to a different caseId, throw error
  if (entitlement.scopeCaseId && entitlement.scopeCaseId !== params.caseId) {
    throw new EntitlementUnavailableError(`Entitlement is scope-locked to a different case: ${entitlement.scopeCaseId}`);
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
    caseId: string;
    reportHash: string;
    version: number;
    correctionReason?: string;
  }
): Promise<Entitlement> {
  validateIdentifier("entitlementId", params.entitlementId);
  validateIdentifier("uid", params.uid);
  validateIdentifier("reportId", params.reportId);
  validateIdentifier("caseId", params.caseId);

  const entitlementRef = adminDb.collection("entitlements").doc(params.entitlementId);
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

  // Scope Locking check
  if (entitlement.scopeCaseId && entitlement.scopeCaseId !== params.caseId) {
    throw new EntitlementUnavailableError("Scope mismatch on consumption.");
  }

  const currentCount = entitlement.releasesCount || 0;
  const newCount = currentCount + 1;
  if (newCount > 5) {
    throw new Error("Cannot consume more than 5 releases.");
  }

  // Correction reason verification (must be present for sequence 2-5)
  if (newCount > 1 && (!params.correctionReason || params.correctionReason.trim().length === 0)) {
    throw new Error("A correction reason must be supplied for releases after the first.");
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

  const newReleasesList = [...(entitlement.releasesList || []), releaseItem];
  const finalStatus = newCount === 5 ? "CONSUMED" : "AVAILABLE";

  const updatedEntitlement: Partial<Entitlement> = {
    status: finalStatus,
    releasesCount: newCount,
    scopeCaseId: params.caseId,
    releasesList: newReleasesList,
    consumedReportId: params.reportId,
    consumedAt: now,
    updatedAt: now,
  };

  dbTransaction.update(entitlementRef, {
    status: finalStatus,
    releasesCount: newCount,
    scopeCaseId: params.caseId,
    releasesList: newReleasesList,
    consumedReportId: params.reportId,
    consumedAt: now,
    updatedAt: now,
    reservedReportId: null,
    reservationExpiresAt: null,
  });

  // Write to ledger
  await writeLedgerEntry(dbTransaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `consume_${params.reportId}_${new Date().getTime()}`,
    type: "ENTITLEMENT_CONSUMED",
    quantity: entitlement.quantity,
    idempotencyKey: `consume:${params.entitlementId}:${params.reportId}:${newCount}`,
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

  const entitlementRef = adminDb.collection("entitlements").doc(params.entitlementId);
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
  const currentCount = entitlement.releasesCount || 0;
  const finalStatus = currentCount >= 5 ? "CONSUMED" : "AVAILABLE";

  const updatedEntitlement: Partial<Entitlement> = {
    status: finalStatus,
    reservedReportId: undefined,
    reservationExpiresAt: undefined,
    updatedAt: now,
  };

  dbTransaction.update(entitlementRef, {
    status: finalStatus,
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

  const entitlementRef = adminDb.collection("entitlements").doc(params.entitlementId);
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
