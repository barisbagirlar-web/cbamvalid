"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEntitlement = createEntitlement;
exports.reserveEntitlement = reserveEntitlement;
exports.consumeEntitlement = consumeEntitlement;
exports.releaseEntitlementReservation = releaseEntitlementReservation;
exports.revokeEntitlement = revokeEntitlement;
const firebase_admin_1 = require("../firebase-admin");
const commerce_errors_1 = require("./commerce-errors");
const ledger_service_1 = require("./ledger-service");
const firestore_validator_1 = require("../firestore-validator");
/**
 * Legacy single-document issuer. New Preparation Pack purchases use
 * issuePreparationPack(), which emits five case-bound quantity-one documents.
 */
async function createEntitlement(dbTransaction, params) {
    (0, firestore_validator_1.validateIdentifier)("uid", params.uid);
    (0, firestore_validator_1.validateIdentifier)("orderId", params.orderId);
    (0, firestore_validator_1.validateIdentifier)("transactionId", params.transactionId);
    const entitlementRef = firebase_admin_1.adminDb.collection("entitlements").doc();
    const now = new Date().toISOString();
    const entitlement = {
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
    // writeLedgerEntry performs reads before its write; call it before any other write.
    await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
        uid: params.uid,
        orderId: params.orderId,
        transactionId: params.transactionId,
        eventId: params.eventId,
        type: "ENTITLEMENT_ISSUED",
        quantity: params.quantity,
        idempotencyKey: `entitlement:${params.transactionId}:${params.productCode}`,
    });
    dbTransaction.set(entitlementRef, entitlement);
    return entitlement;
}
async function reserveEntitlement(dbTransaction, params) {
    (0, firestore_validator_1.validateIdentifier)("entitlementId", params.entitlementId);
    (0, firestore_validator_1.validateIdentifier)("uid", params.uid);
    (0, firestore_validator_1.validateIdentifier)("caseId", params.caseId);
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
    if (!entitlement.caseId || entitlement.caseId !== params.caseId) {
        throw new commerce_errors_1.EntitlementUnavailableError("This report version belongs to a different dossier.");
    }
    if (entitlement.quantity !== 1) {
        throw new commerce_errors_1.EntitlementUnavailableError("Entitlement quantity is invalid for a sealed version.");
    }
    const now = new Date();
    const isSameReservation = entitlement.status === "RESERVED" && entitlement.reservedReportId === params.reportId;
    if (isSameReservation) {
        return entitlement;
    }
    const isExpired = entitlement.status === "RESERVED" &&
        entitlement.reservationExpiresAt &&
        new Date(entitlement.reservationExpiresAt) < now;
    if (entitlement.status !== "AVAILABLE" && !isExpired) {
        throw new commerce_errors_1.DoubleSpendViolationError(params.entitlementId);
    }
    const expiresAt = new Date(now.getTime() + (params.expiresInSeconds || 900) * 1000).toISOString();
    const updatedEntitlement = {
        status: "RESERVED",
        reservedReportId: params.reportId,
        reservationExpiresAt: expiresAt,
        updatedAt: now.toISOString(),
    };
    await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
        uid: entitlement.uid,
        orderId: entitlement.orderId,
        transactionId: entitlement.orderId,
        eventId: `reserve_${params.reportId}`,
        type: "ENTITLEMENT_RESERVED",
        quantity: 1,
        idempotencyKey: `reserve:${params.entitlementId}:${params.reportId}`,
    });
    dbTransaction.update(entitlementRef, updatedEntitlement);
    return Object.assign(Object.assign({}, entitlement), updatedEntitlement);
}
async function consumeEntitlement(dbTransaction, params) {
    (0, firestore_validator_1.validateIdentifier)("entitlementId", params.entitlementId);
    (0, firestore_validator_1.validateIdentifier)("uid", params.uid);
    (0, firestore_validator_1.validateIdentifier)("caseId", params.caseId);
    (0, firestore_validator_1.validateIdentifier)("reportId", params.reportId);
    const entitlementRef = firebase_admin_1.adminDb.collection("entitlements").doc(params.entitlementId);
    const snapshot = await dbTransaction.get(entitlementRef);
    if (!snapshot.exists) {
        throw new commerce_errors_1.EntitlementUnavailableError(`Entitlement with ID ${params.entitlementId} was not found.`);
    }
    const entitlement = snapshot.data();
    if (entitlement.uid !== params.uid || entitlement.caseId !== params.caseId) {
        throw new commerce_errors_1.EntitlementUnavailableError("Ownership or dossier mismatch on requested entitlement.");
    }
    if (entitlement.status === "CONSUMED" && entitlement.consumedReportId === params.reportId) {
        return entitlement;
    }
    if (entitlement.status !== "RESERVED" || entitlement.reservedReportId !== params.reportId) {
        throw new commerce_errors_1.DoubleSpendViolationError(params.entitlementId);
    }
    const now = new Date().toISOString();
    const updatedEntitlement = {
        status: "CONSUMED",
        consumedReportId: params.reportId,
        consumedAt: now,
        reservationExpiresAt: undefined,
        updatedAt: now,
    };
    await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
        uid: entitlement.uid,
        orderId: entitlement.orderId,
        transactionId: entitlement.orderId,
        eventId: `consume_${params.reportId}`,
        type: "ENTITLEMENT_CONSUMED",
        quantity: 1,
        idempotencyKey: `consume:${params.entitlementId}:${params.reportId}`,
    });
    dbTransaction.update(entitlementRef, Object.assign(Object.assign({}, updatedEntitlement), { reservationExpiresAt: null }));
    return Object.assign(Object.assign({}, entitlement), updatedEntitlement);
}
async function releaseEntitlementReservation(dbTransaction, params) {
    (0, firestore_validator_1.validateIdentifier)("entitlementId", params.entitlementId);
    (0, firestore_validator_1.validateIdentifier)("uid", params.uid);
    (0, firestore_validator_1.validateIdentifier)("caseId", params.caseId);
    (0, firestore_validator_1.validateIdentifier)("reportId", params.reportId);
    const entitlementRef = firebase_admin_1.adminDb.collection("entitlements").doc(params.entitlementId);
    const snapshot = await dbTransaction.get(entitlementRef);
    if (!snapshot.exists)
        throw new commerce_errors_1.EntitlementUnavailableError();
    const entitlement = snapshot.data();
    if (entitlement.uid !== params.uid || entitlement.caseId !== params.caseId) {
        throw new commerce_errors_1.EntitlementUnavailableError("Ownership or dossier mismatch.");
    }
    if (entitlement.status === "AVAILABLE") {
        return entitlement;
    }
    if (entitlement.status !== "RESERVED" || entitlement.reservedReportId !== params.reportId) {
        return entitlement;
    }
    const now = new Date().toISOString();
    await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
        uid: entitlement.uid,
        orderId: entitlement.orderId,
        transactionId: entitlement.orderId,
        eventId: `release_${params.reportId}`,
        type: "ENTITLEMENT_RELEASED",
        quantity: 1,
        idempotencyKey: `release:${params.entitlementId}:${params.reportId}`,
    });
    dbTransaction.update(entitlementRef, {
        status: "AVAILABLE",
        reservedReportId: null,
        reservationExpiresAt: null,
        updatedAt: now,
    });
    return Object.assign(Object.assign({}, entitlement), { status: "AVAILABLE", reservedReportId: undefined, reservationExpiresAt: undefined, updatedAt: now });
}
async function revokeEntitlement(dbTransaction, params) {
    (0, firestore_validator_1.validateIdentifier)("entitlementId", params.entitlementId);
    const entitlementRef = firebase_admin_1.adminDb.collection("entitlements").doc(params.entitlementId);
    const snapshot = await dbTransaction.get(entitlementRef);
    if (!snapshot.exists)
        throw new commerce_errors_1.EntitlementUnavailableError();
    const entitlement = snapshot.data();
    if (entitlement.status === "REVOKED")
        return entitlement;
    const now = new Date().toISOString();
    await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
        uid: entitlement.uid,
        orderId: entitlement.orderId,
        transactionId: entitlement.orderId,
        eventId: params.eventId,
        type: "ENTITLEMENT_REVOKED",
        quantity: entitlement.quantity,
        idempotencyKey: `revoke:${params.entitlementId}:${params.eventId}`,
    });
    dbTransaction.update(entitlementRef, {
        status: "REVOKED",
        reservedReportId: null,
        reservationExpiresAt: null,
        updatedAt: now,
    });
    return Object.assign(Object.assign({}, entitlement), { status: "REVOKED", updatedAt: now });
}
//# sourceMappingURL=entitlement-service.js.map