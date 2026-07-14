"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrder = createOrder;
exports.transitionOrderStatus = transitionOrderStatus;
const firebase_admin_1 = require("../firebase-admin");
const commerce_errors_1 = require("./commerce-errors");
const firestore_validator_1 = require("../firestore-validator");
async function createOrder(dbTransaction, params) {
    (0, firestore_validator_1.validateIdentifier)("uid", params.uid);
    (0, firestore_validator_1.validateIdentifier)("caseId", params.caseId);
    const orderRef = firebase_admin_1.adminDb.collection("commerce_orders").doc();
    const orderId = `ord_${orderRef.id}`;
    const now = new Date().toISOString();
    const order = {
        orderId,
        uid: params.uid,
        caseId: params.caseId,
        productCode: params.productCode,
        status: "CHECKOUT_CREATED",
        currency: params.currency,
        amountMinor: params.amountMinor,
        createdAt: now,
        updatedAt: now,
    };
    dbTransaction.set(firebase_admin_1.adminDb.collection("commerce_orders").doc(orderId), order);
    return order;
}
async function transitionOrderStatus(dbTransaction, orderId, newStatus, metadata) {
    (0, firestore_validator_1.validateIdentifier)("orderId", orderId);
    if (metadata === null || metadata === void 0 ? void 0 : metadata.paddleTransactionId) {
        (0, firestore_validator_1.validateIdentifier)("paddleTransactionId", metadata.paddleTransactionId);
    }
    const orderRef = firebase_admin_1.adminDb.collection("commerce_orders").doc(orderId);
    const snapshot = await dbTransaction.get(orderRef);
    if (!snapshot.exists) {
        throw new commerce_errors_1.OrderNotFoundError(orderId);
    }
    const order = snapshot.data();
    if (!validateStateTransition(order.status, newStatus)) {
        throw new Error(`ORDER_STATE_TRANSITION_INVALID:${order.status}->${newStatus}`);
    }
    const updatedOrder = Object.assign(Object.assign({}, metadata), { status: newStatus, updatedAt: new Date().toISOString() });
    dbTransaction.update(orderRef, updatedOrder);
    return Object.assign(Object.assign({}, order), updatedOrder);
}
function validateStateTransition(current, target) {
    if (current === target)
        return true;
    const validTransitions = {
        DRAFT: ["CHECKOUT_CREATED"],
        CHECKOUT_CREATED: ["PAYMENT_PENDING", "PAYMENT_FAILED", "PAYMENT_CANCELED"],
        PAYMENT_PENDING: ["PAID", "PAYMENT_FAILED", "PAYMENT_CANCELED"],
        PAID: ["ENTITLED", "REFUNDED_UNUSED"],
        ENTITLED: ["REPORT_RESERVED", "REFUNDED_UNUSED"],
        REPORT_RESERVED: ["REPORT_CALCULATED", "ENTITLED", "REFUNDED_UNUSED"],
        REPORT_CALCULATED: ["REPORT_SEALED", "ENTITLED"],
        REPORT_SEALED: ["DELIVERED"],
        DELIVERED: ["REFUNDED_AFTER_DELIVERY"],
        PAYMENT_FAILED: ["CHECKOUT_CREATED"],
        PAYMENT_CANCELED: ["CHECKOUT_CREATED"],
        REFUNDED_UNUSED: [],
        REFUNDED_AFTER_DELIVERY: [],
    };
    return (validTransitions[current] || []).includes(target);
}
//# sourceMappingURL=order-service.js.map