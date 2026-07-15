import admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { DoubleSpendViolationError, EntitlementUnavailableError } from "./commerce-errors";
import { writeLedgerEntry } from "./ledger-service";
import { validateIdentifier } from "../firestore-validator";
import { PREPARATION_PACK } from "./preparation-pack";
import { normalizeCreditSummary } from "./credit-service";

const DEFAULT_MAX_RELEASES = PREPARATION_PACK.maxReleases;

export interface Entitlement {
  entitlementId: string;
  uid: string;
  orderId: string;
  productCode: string;
  status: "AVAILABLE" | "RESERVED" | "CONSUMED" | "REVOKED";
  quantity: number;
  maxReleases: number;
  creditsRemaining: number;
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
  const quantity = Number(source.quantity ?? 1);
  const maxReleases = Number(source.maxReleases ?? DEFAULT_MAX_RELEASES);
  const releasesCount = Number(source.releasesCount ?? 0);
  const expectedCredits = (DEFAULT_MAX_RELEASES - releasesCount) * PREPARATION_PACK.creditsPerRelease;
  const creditsRemaining = Number(source.creditsRemaining ?? expectedCredits);
  if (
    !Number.isSafeInteger(quantity) || quantity <= 0 ||
    !Number.isSafeInteger(maxReleases) || maxReleases !== DEFAULT_MAX_RELEASES ||
    !Number.isSafeInteger(releasesCount) || releasesCount < 0 || releasesCount > maxReleases ||
    !Number.isSafeInteger(creditsRemaining) || creditsRemaining < 0 ||
    creditsRemaining !== expectedCredits
  ) throw new EntitlementUnavailableError("Entitlement counters or credit conservation are invalid.");

  return {
    entitlementId: source.entitlementId || documentId,
    uid: String(source.uid || ""),
    orderId: String(source.orderId || ""),
    productCode: String(source.productCode || ""),
    status: source.status || "REVOKED",
    quantity,
    maxReleases,
    creditsRemaining,
    createdAt: String(source.createdAt || new Date(0).toISOString()),
    updatedAt: String(source.updatedAt || new Date(0).toISOString()),
    releasesCount,
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
  const snapshot = await transaction.get(
    adminDb.collection("entitlements").where("orderId", "==", entitlement.orderId)
  );
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
  if (params.productCode !== PREPARATION_PACK.productCode) throw new Error("ENTITLEMENT_PRODUCT_INVALID");

  const entitlementRef = adminDb.collection("entitlements").doc();
  const now = new Date().toISOString();
  const entitlement: Entitlement = {
    entitlementId: entitlementRef.id,
    uid: params.uid,
    orderId: params.orderId,
    productCode: params.productCode,
    status: "AVAILABLE",
    quantity: 1,
    maxReleases: DEFAULT_MAX_RELEASES,
    creditsRemaining: PREPARATION_PACK.accountCredits,
    createdAt: now,
    updatedAt: now,
    releasesCount: 0,
    releasesList: [],
  };
  transaction.create(entitlementRef, entitlement);
  await writeLedgerEntry(transaction, {
    uid: params.uid,
    orderId: params.orderId,
    transactionId: params.transactionId,
    eventId: params.eventId,
    type: "ENTITLEMENT_ISSUED",
    quantity: 1,
    idempotencyKey: `entitlement:${params.transactionId}:${params.productCode}`,
  });
  return entitlement;
}

export async function reserveEntitlement(
  transaction: admin.firestore.Transaction,
  params: { entitlementId: string; uid: string; reportId: string; caseId: string; expiresInSeconds?: number }
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

  if (
    entitlement.releasesCount >= DEFAULT_MAX_RELEASES ||
    entitlement.creditsRemaining < PREPARATION_PACK.creditsPerRelease ||
    entitlement.status === "CONSUMED"
  ) {
    throw new EntitlementUnavailableError(`The pack has reached its ${DEFAULT_MAX_RELEASES}-release limit.`);
  }
  if (entitlement.scopeCaseId && entitlement.scopeCaseId !== params.caseId) {
    throw new EntitlementUnavailableError(`The pack is scope-locked to case ${entitlement.scopeCaseId}.`);
  }

  const now = new Date();
  const reservationExpired = entitlement.status === "RESERVED" && entitlement.reservationExpiresAt
    ? new Date(entitlement.reservationExpiresAt).getTime() < now.getTime()
    : false;
  if (entitlement.status !== "AVAILABLE" && !reservationExpired) {
    throw new DoubleSpendViolationError(params.entitlementId);
  }

  const expiresInSeconds = params.expiresInSeconds ?? 300;
  if (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds < 30 || expiresInSeconds > 3600) {
    throw new Error("ENTITLEMENT_RESERVATION_DURATION_INVALID");
  }
  const reservationExpiresAt = new Date(now.getTime() + expiresInSeconds * 1000).toISOString();
  transaction.update(entitlementRef, {
    status: "RESERVED",
    reservedReportId: params.reportId,
    reservationExpiresAt,
    updatedAt: now.toISOString(),
  });
  await writeLedgerEntry(transaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `reserve_${params.reportId}`,
    type: "ENTITLEMENT_RESERVED",
    quantity: 1,
    idempotencyKey: `reserve:${params.entitlementId}:${params.reportId}`,
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
  await assertCanonicalOrderEntitlement(transaction, entitlement);
  if (entitlement.status !== "RESERVED" || entitlement.reservedReportId !== params.reportId) {
    throw new DoubleSpendViolationError(params.entitlementId);
  }
  if (entitlement.scopeCaseId && entitlement.scopeCaseId !== params.caseId) {
    throw new EntitlementUnavailableError("Scope mismatch on consumption.");
  }

  const newCount = entitlement.releasesCount + 1;
  if (newCount > DEFAULT_MAX_RELEASES) throw new EntitlementUnavailableError("Release limit exceeded.");
  if (params.version !== newCount) throw new EntitlementUnavailableError(`Release version mismatch. Expected ${newCount}.`);
  if (newCount > 1 && !params.correctionReason?.trim()) {
    throw new EntitlementUnavailableError("A correction reason is required after the first release.");
  }

  const creditSummaryRef = adminDb.collection("users").doc(params.uid).collection("creditSummary").doc("current");
  const creditMarkerRef = adminDb.collection("credit_events").doc(`seal_${params.reportId}`);
  const creditLedgerRef = adminDb.collection("users").doc(params.uid).collection("creditLedger").doc(`seal_${params.reportId}`);
  const [creditSnapshot, creditMarkerSnapshot] = await Promise.all([
    transaction.get(creditSummaryRef),
    transaction.get(creditMarkerRef),
  ]);
  if (creditMarkerSnapshot.exists) throw new Error("SEAL_CREDIT_PARTIAL_STATE");
  const creditSummary = normalizeCreditSummary(creditSnapshot.data());
  if (
    creditSummary.availableCredits < PREPARATION_PACK.creditsPerRelease ||
    entitlement.creditsRemaining < PREPARATION_PACK.creditsPerRelease
  ) {
    throw new EntitlementUnavailableError(
      `${PREPARATION_PACK.creditsPerRelease} credits are required for a successful seal.`
    );
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
  const creditsRemaining = entitlement.creditsRemaining - PREPARATION_PACK.creditsPerRelease;
  const status: Entitlement["status"] = newCount === DEFAULT_MAX_RELEASES ? "CONSUMED" : "AVAILABLE";
  const balanceAfter = creditSummary.availableCredits - PREPARATION_PACK.creditsPerRelease;

  transaction.update(entitlementRef, {
    status,
    releasesCount: newCount,
    maxReleases: DEFAULT_MAX_RELEASES,
    creditsRemaining,
    scopeCaseId: params.caseId,
    releasesList,
    consumedReportId: params.reportId,
    consumedAt: now,
    updatedAt: now,
    reservedReportId: null,
    reservationExpiresAt: null,
  });
  transaction.set(creditSummaryRef, {
    ...creditSummary,
    availableCredits: balanceAfter,
    lifetimeConsumed: creditSummary.lifetimeConsumed + PREPARATION_PACK.creditsPerRelease,
    updatedAt: now,
  }, { merge: true });
  transaction.create(creditLedgerRef, {
    uid: params.uid,
    type: "SEAL_CONSUMPTION",
    amount: -PREPARATION_PACK.creditsPerRelease,
    reason: "SUCCESSFUL_REPORT_SEAL",
    orderId: entitlement.orderId,
    entitlementId: entitlement.entitlementId,
    reportId: params.reportId,
    createdAt: now,
    balanceAfter,
  });
  transaction.create(creditMarkerRef, {
    uid: params.uid,
    entitlementId: params.entitlementId,
    reportId: params.reportId,
    creditsConsumed: PREPARATION_PACK.creditsPerRelease,
    createdAt: now,
  });
  await writeLedgerEntry(transaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `consume_${params.reportId}_${newCount}`,
    type: "ENTITLEMENT_CONSUMED",
    quantity: 1,
    idempotencyKey: `consume:${params.entitlementId}:${params.reportId}:${newCount}`,
  });
  return {
    ...entitlement,
    status,
    releasesCount: newCount,
    creditsRemaining,
    scopeCaseId: params.caseId,
    releasesList,
    consumedReportId: params.reportId,
    consumedAt: now,
    updatedAt: now,
    reservedReportId: undefined,
    reservationExpiresAt: undefined,
  };
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

  const status: Entitlement["status"] = entitlement.releasesCount >= DEFAULT_MAX_RELEASES ? "CONSUMED" : "AVAILABLE";
  const now = new Date().toISOString();
  transaction.update(entitlementRef, { status, reservedReportId: null, reservationExpiresAt: null, updatedAt: now });
  await writeLedgerEntry(transaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: `release_${params.reportId}`,
    type: "ENTITLEMENT_RELEASED",
    quantity: 1,
    idempotencyKey: `release:${params.entitlementId}:${params.reportId}`,
  });
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
  transaction.update(entitlementRef, { status: "REVOKED", reservedReportId: null, reservationExpiresAt: null, updatedAt: now });
  await writeLedgerEntry(transaction, {
    uid: entitlement.uid,
    orderId: entitlement.orderId,
    transactionId: entitlement.orderId,
    eventId: params.eventId,
    type: "ENTITLEMENT_REVOKED",
    quantity: 1,
    idempotencyKey: `revoke:${params.entitlementId}:${params.eventId}`,
  });
  return { ...entitlement, status: "REVOKED", updatedAt: now };
}
