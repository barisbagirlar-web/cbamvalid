"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processWebhookEvent = processWebhookEvent;
const firebase_admin_1 = require("../firebase-admin");
const preparation_pack_service_1 = require("./preparation-pack-service");
const ledger_service_1 = require("./ledger-service");
const refund_service_1 = require("./refund-service");
const catalog_1 = require("./catalog");
const paddle_client_1 = require("./paddle-client");
function asString(value) {
    return typeof value === "string" ? value : "";
}
function transactionAmountMinor(transaction) {
    var _a, _b, _c, _d, _e, _f;
    var _g, _h, _j;
    const raw = (_j = (_h = (_g = (_b = (_a = transaction === null || transaction === void 0 ? void 0 : transaction.details) === null || _a === void 0 ? void 0 : _a.totals) === null || _b === void 0 ? void 0 : _b.grandTotal) !== null && _g !== void 0 ? _g : (_d = (_c = transaction === null || transaction === void 0 ? void 0 : transaction.details) === null || _c === void 0 ? void 0 : _c.totals) === null || _d === void 0 ? void 0 : _d.total) !== null && _h !== void 0 ? _h : (_e = transaction === null || transaction === void 0 ? void 0 : transaction.totals) === null || _e === void 0 ? void 0 : _e.grandTotal) !== null && _j !== void 0 ? _j : (_f = transaction === null || transaction === void 0 ? void 0 : transaction.totals) === null || _f === void 0 ? void 0 : _f.total;
    const amount = Number(raw);
    return Number.isFinite(amount) ? amount : Number.NaN;
}
function itemPriceId(item) {
    var _a;
    return asString(((_a = item === null || item === void 0 ? void 0 : item.price) === null || _a === void 0 ? void 0 : _a.id) || (item === null || item === void 0 ? void 0 : item.priceId) || (item === null || item === void 0 ? void 0 : item.price_id));
}
function assertOrderMatchesPayment(order, expected) {
    if (order.uid !== expected.uid ||
        order.caseId !== expected.caseId ||
        order.productCode !== expected.productCode ||
        order.currency !== expected.currency ||
        order.amountMinor !== expected.amountMinor ||
        (order.paddleTransactionId && order.paddleTransactionId !== expected.transactionId)) {
        throw new Error("PADDLE_ORDER_PAYLOAD_MISMATCH");
    }
}
/** Main processor of verified webhook events from Paddle. */
async function processWebhookEvent(event) {
    const eventId = asString(event === null || event === void 0 ? void 0 : event.eventId);
    const eventType = asString(event === null || event === void 0 ? void 0 : event.eventType);
    const data = event === null || event === void 0 ? void 0 : event.data;
    if (!eventId || !eventType || !data) {
        throw new Error("PADDLE_EVENT_SHAPE_INVALID");
    }
    console.log(`[PADDLE-PROCESSOR] Processing event ${eventId} of type ${eventType}`);
    if (eventType === "transaction.completed") {
        await handleTransactionCompleted(eventId, data);
    }
    else if (eventType === "adjustment.created" || eventType === "adjustment.updated") {
        await handleAdjustmentUpdated(eventId, data);
    }
    else {
        console.log(`[PADDLE-PROCESSOR] Skipping unhandled event type: ${eventType}`);
    }
}
async function handleTransactionCompleted(eventId, transaction) {
    const transactionId = asString(transaction === null || transaction === void 0 ? void 0 : transaction.id);
    const status = asString(transaction === null || transaction === void 0 ? void 0 : transaction.status);
    const customData = (transaction === null || transaction === void 0 ? void 0 : transaction.customData) || (transaction === null || transaction === void 0 ? void 0 : transaction.custom_data) || {};
    const uid = asString(customData.uid);
    const orderId = asString(customData.orderId || customData.order_id);
    const caseId = asString(customData.caseId || customData.case_id);
    const productCode = asString(customData.productCode || customData.product_code);
    const eventEnvironment = asString(customData.environment);
    if (!transactionId || !uid || !orderId || !caseId || !productCode) {
        throw new Error("PADDLE_TRANSACTION_METADATA_MISSING");
    }
    if (status !== "completed") {
        throw new Error(`PADDLE_TRANSACTION_STATUS_INVALID:${status || "missing"}`);
    }
    const catalogProduct = catalog_1.PRODUCT_CATALOG[productCode];
    if (!catalogProduct || !catalogProduct.active || productCode !== "CBAM_CREDIT_PACK_5") {
        throw new Error("PADDLE_PRODUCT_MAPPING_INVALID");
    }
    const sandbox = (0, paddle_client_1.isSandboxMode)();
    const expectedEnvironment = sandbox ? "sandbox" : "production";
    if (eventEnvironment !== expectedEnvironment) {
        throw new Error("PADDLE_ENVIRONMENT_MISMATCH");
    }
    const currency = asString((transaction === null || transaction === void 0 ? void 0 : transaction.currencyCode) || (transaction === null || transaction === void 0 ? void 0 : transaction.currency_code));
    if (currency !== catalogProduct.currency) {
        throw new Error(`PADDLE_CURRENCY_MISMATCH:${currency || "missing"}`);
    }
    const items = Array.isArray(transaction === null || transaction === void 0 ? void 0 : transaction.items) ? transaction.items : [];
    const purchasedQuantity = items.reduce((total, item) => total + Number((item === null || item === void 0 ? void 0 : item.quantity) || 0), 0);
    if (items.length !== 1 || purchasedQuantity !== 1) {
        throw new Error("PADDLE_ITEM_QUANTITY_INVALID");
    }
    const expectedPriceId = (0, catalog_1.getPriceIdForProduct)(productCode, sandbox);
    if (!expectedPriceId || itemPriceId(items[0]) !== expectedPriceId) {
        throw new Error("PADDLE_PRICE_ID_MISMATCH");
    }
    const actualAmountMinor = transactionAmountMinor(transaction);
    if (!Number.isFinite(actualAmountMinor) || actualAmountMinor !== catalogProduct.expectedUnitAmount) {
        throw new Error("PADDLE_AMOUNT_MISMATCH");
    }
    const orderRef = firebase_admin_1.adminDb.collection("commerce_orders").doc(orderId);
    const expectedOrder = { uid, caseId, productCode, currency, amountMinor: actualAmountMinor, transactionId };
    await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
        const orderSnapshot = await dbTransaction.get(orderRef);
        if (!orderSnapshot.exists)
            throw new Error("PADDLE_ORDER_NOT_FOUND");
        const order = orderSnapshot.data();
        assertOrderMatchesPayment(order, expectedOrder);
        if (!["CHECKOUT_CREATED", "PAYMENT_PENDING", "PAID", "ENTITLED"].includes(order.status)) {
            throw new Error(`PADDLE_ORDER_STATE_INVALID:${order.status}`);
        }
        await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
            uid,
            orderId,
            transactionId,
            eventId,
            type: "PAYMENT_CAPTURED",
            quantity: 1,
            currency,
            amountMinor: actualAmountMinor,
            idempotencyKey: `payment:${transactionId}`,
        });
        if (order.status !== "ENTITLED") {
            dbTransaction.update(orderRef, {
                paddleTransactionId: transactionId,
                status: "PAID",
                updatedAt: new Date().toISOString(),
            });
        }
    });
    await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
        const orderSnapshot = await dbTransaction.get(orderRef);
        if (!orderSnapshot.exists)
            throw new Error("PADDLE_ORDER_NOT_FOUND_AFTER_CAPTURE");
        const order = orderSnapshot.data();
        assertOrderMatchesPayment(order, expectedOrder);
        if (order.status !== "PAID" && order.status !== "ENTITLED") {
            throw new Error(`PADDLE_ORDER_NOT_PAID:${order.status}`);
        }
        await (0, preparation_pack_service_1.issuePreparationPack)(dbTransaction, {
            uid,
            orderId,
            caseId,
            transactionId,
            eventId,
            productCode,
            versions: catalogProduct.entitlementQuantity,
        });
        if (order.status !== "ENTITLED") {
            dbTransaction.update(orderRef, {
                status: "ENTITLED",
                updatedAt: new Date().toISOString(),
            });
        }
    });
    console.log(`[PADDLE-PROCESSOR] Completed fulfillment for order ${orderId}; five case-bound versions issued.`);
}
async function handleAdjustmentUpdated(eventId, adjustment) {
    var _a, _b;
    var _c, _d;
    const transactionId = asString((adjustment === null || adjustment === void 0 ? void 0 : adjustment.transactionId) || (adjustment === null || adjustment === void 0 ? void 0 : adjustment.transaction_id));
    const status = asString(adjustment === null || adjustment === void 0 ? void 0 : adjustment.status);
    const adjustmentId = asString(adjustment === null || adjustment === void 0 ? void 0 : adjustment.id);
    if (!transactionId || !adjustmentId) {
        throw new Error("PADDLE_ADJUSTMENT_METADATA_MISSING");
    }
    if (status !== "approved" && status !== "completed") {
        console.log(`[PADDLE-PROCESSOR] Adjustment ${adjustmentId} status is ${status}. Skipping.`);
        return;
    }
    const orderQuery = await firebase_admin_1.adminDb
        .collection("commerce_orders")
        .where("paddleTransactionId", "==", transactionId)
        .limit(1)
        .get();
    if (orderQuery.empty) {
        throw new Error("PADDLE_REFUND_ORDER_NOT_FOUND");
    }
    const order = orderQuery.docs[0].data();
    const amountMinor = Number((_d = (_c = (_a = adjustment === null || adjustment === void 0 ? void 0 : adjustment.totals) === null || _a === void 0 ? void 0 : _a.subtotal) !== null && _c !== void 0 ? _c : (_b = adjustment === null || adjustment === void 0 ? void 0 : adjustment.totals) === null || _b === void 0 ? void 0 : _b.total) !== null && _d !== void 0 ? _d : order.amountMinor);
    await (0, refund_service_1.processRefund)({
        uid: order.uid,
        orderId: order.orderId,
        transactionId,
        eventId,
        adjustmentId,
        amountMinor: Number.isFinite(amountMinor) ? amountMinor : order.amountMinor,
        currency: asString((adjustment === null || adjustment === void 0 ? void 0 : adjustment.currencyCode) || (adjustment === null || adjustment === void 0 ? void 0 : adjustment.currency_code)) || order.currency,
    });
    console.log(`[PADDLE-PROCESSOR] Completed refund processing for order ${order.orderId}.`);
}
//# sourceMappingURL=webhook-processor.js.map