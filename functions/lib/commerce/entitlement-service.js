"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEntitlement = createEntitlement;
exports.reserveEntitlement = reserveEntitlement;
exports.consumeEntitlement = consumeEntitlement;
exports.releaseEntitlementReservation = releaseEntitlementReservation;
exports.revokeEntitlement = revokeEntitlement;
const firebase_admin_1 = require("@/firebase-admin");
const commerce_errors_1 = require("./commerce-errors");
const ledger_service_1 = require("./ledger-service");
const firestore_validator_1 = require("@/firestore-validator");
/**
 * Creates a new entitlement after a successful payment transaction
 */
async function createEntitlement(dbTransaction, params) {
    (0, firestore_validator_1.validateIdentifier)("uid", params.uid);
    (0, firestore_validator_1.validateIdentifier)("orderId", params.orderId);
    (0, firestore_validator_1.validateIdentifier)("transactionId", params.transactionId);
    const entitlementRef = firebase_admin_1.adminDb.collection("entitlements").doc();
    const entitlementId = entitlementRef.id;
    const now = new Date().toISOString();
    const entitlement = {
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
    await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
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
async function reserveEntitlement(dbTransaction, params) {
    (0, firestore_validator_1.validateIdentifier)("entitlementId", params.entitlementId);
    (0, firestore_validator_1.validateIdentifier)("uid", params.uid);
    (0, firestore_validator_1.validateIdentifier)("reportId", params.reportId);
    const entitlementRef = firebase_admin_1.adminDb.collection("entitlements").doc(params.entitlementId);
    const snapshot = await dbTransaction.get(entitlementRef);
    if (!snapshot.exists) {
        throw new commerce_errors_1.EntitlementUnavailableError(`Entitlement with ID ${params.entitlementId} was not found.`);
    }
    const entitlement = snapshot.data();
    if (entitlement.uid !== params.uid) {
        throw new commerce_errors_1.EntitlementUnavailableError("Ownership mismatch on requested entitlement.");
    }
    // Handle expired reservation auto-recovery
    const now = new Date();
    const isExpired = entitlement.status === "RESERVED" &&
        entitlement.reservationExpiresAt &&
        new Date(entitlement.reservationExpiresAt) < now;
    if (entitlement.status !== "AVAILABLE" && !isExpired) {
        throw new commerce_errors_1.DoubleSpendViolationError(params.entitlementId);
    }
    const defaultDuration = params.expiresInSeconds || 300; // 5 minutes default
    const expiresAt = new Date(now.getTime() + defaultDuration * 1000).toISOString();
    const updatedEntitlement = {
        status: "RESERVED",
        reservedReportId: params.reportId,
        reservationExpiresAt: expiresAt,
        updatedAt: now.toISOString(),
    };
    dbTransaction.update(entitlementRef, updatedEntitlement);
    // Write to ledger
    await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
        uid: entitlement.uid,
        orderId: entitlement.orderId,
        transactionId: entitlement.orderId,
        eventId: `reserve_${params.reportId}_${new Date().getTime()}`,
        type: "ENTITLEMENT_RESERVED",
        quantity: entitlement.quantity,
        idempotencyKey: `reserve:${params.entitlementId}:${params.reportId}`,
    });
    return Object.assign(Object.assign({}, entitlement), updatedEntitlement);
}
/**
 * Phase 2: Seal and Consume Entitlement (Finalizes consumption after report is built successfully)
 */
async function consumeEntitlement(dbTransaction, params) {
    (0, firestore_validator_1.validateIdentifier)("entitlementId", params.entitlementId);
    (0, firestore_validator_1.validateIdentifier)("uid", params.uid);
    (0, firestore_validator_1.validateIdentifier)("reportId", params.reportId);
    const entitlementRef = firebase_admin_1.adminDb.collection("entitlements").doc(params.entitlementId);
    const snapshot = await dbTransaction.get(entitlementRef);
    if (!snapshot.exists) {
        throw new commerce_errors_1.EntitlementUnavailableError(`Entitlement with ID ${params.entitlementId} was not found.`);
    }
    const entitlement = snapshot.data();
    if (entitlement.uid !== params.uid) {
        throw new commerce_errors_1.EntitlementUnavailableError("Ownership mismatch on requested entitlement.");
    }
    if (entitlement.status !== "RESERVED" || entitlement.reservedReportId !== params.reportId) {
        throw new commerce_errors_1.DoubleSpendViolationError(params.entitlementId);
    }
    const now = new Date().toISOString();
    const updatedEntitlement = {
        status: "CONSUMED",
        consumedReportId: params.reportId,
        consumedAt: now,
        updatedAt: now,
    };
    dbTransaction.update(entitlementRef, updatedEntitlement);
    // Write to ledger
    await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
        uid: entitlement.uid,
        orderId: entitlement.orderId,
        transactionId: entitlement.orderId,
        eventId: `consume_${params.reportId}_${new Date().getTime()}`,
        type: "ENTITLEMENT_CONSUMED",
        quantity: entitlement.quantity,
        idempotencyKey: `consume:${params.entitlementId}:${params.reportId}`,
    });
    return Object.assign(Object.assign({}, entitlement), updatedEntitlement);
}
/**
 * Reverts an active reservation to AVAILABLE in case of report generation errors
 */
async function releaseEntitlementReservation(dbTransaction, params) {
    (0, firestore_validator_1.validateIdentifier)("entitlementId", params.entitlementId);
    (0, firestore_validator_1.validateIdentifier)("uid", params.uid);
    (0, firestore_validator_1.validateIdentifier)("reportId", params.reportId);
    const entitlementRef = firebase_admin_1.adminDb.collection("entitlements").doc(params.entitlementId);
    const snapshot = await dbTransaction.get(entitlementRef);
    if (!snapshot.exists) {
        throw new commerce_errors_1.EntitlementUnavailableError();
    }
    const entitlement = snapshot.data();
    if (entitlement.uid !== params.uid) {
        throw new commerce_errors_1.EntitlementUnavailableError("Ownership mismatch.");
    }
    if (entitlement.status !== "RESERVED" || entitlement.reservedReportId !== params.reportId) {
        return entitlement; // No-op if not reserved by this report
    }
    const now = new Date().toISOString();
    const updatedEntitlement = {
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
    await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
        uid: entitlement.uid,
        orderId: entitlement.orderId,
        transactionId: entitlement.orderId,
        eventId: `release_${params.reportId}_${new Date().getTime()}`,
        type: "ENTITLEMENT_RELEASED",
        quantity: entitlement.quantity,
        idempotencyKey: `release:${params.entitlementId}:${params.reportId}`,
    });
    return Object.assign(Object.assign({}, entitlement), updatedEntitlement);
}
/**
 * Revokes an entitlement entirely (e.g. during a checkout refund process)
 */
async function revokeEntitlement(dbTransaction, params) {
    (0, firestore_validator_1.validateIdentifier)("entitlementId", params.entitlementId);
    const entitlementRef = firebase_admin_1.adminDb.collection("entitlements").doc(params.entitlementId);
    const snapshot = await dbTransaction.get(entitlementRef);
    if (!snapshot.exists) {
        throw new commerce_errors_1.EntitlementUnavailableError();
    }
    const entitlement = snapshot.data();
    const now = new Date().toISOString();
    dbTransaction.update(entitlementRef, {
        status: "REVOKED",
        reservedReportId: null,
        reservationExpiresAt: null,
        updatedAt: now,
    });
    await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
        uid: entitlement.uid,
        orderId: entitlement.orderId,
        transactionId: entitlement.orderId,
        eventId: params.eventId,
        type: "ENTITLEMENT_REVOKED",
        quantity: entitlement.quantity,
        idempotencyKey: `revoke:${params.entitlementId}:${params.eventId}`,
    });
    return Object.assign(Object.assign({}, entitlement), { status: "REVOKED", updatedAt: now });
}
//# sourceMappingURL=entitlement-service.js.map