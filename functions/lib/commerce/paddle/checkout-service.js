"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckout = createCheckout;
const crypto_1 = __importDefault(require("crypto"));
const catalog_1 = require("../../commerce/catalog");
const paddle_client_1 = require("../paddle-client");
const firebase_admin_1 = require("../../firebase-admin");
const case_repository_1 = require("../../cbam/storage/case-repository");
const PREPARATION_PACK_PRODUCT = "CBAM_CREDIT_PACK_5";
function deterministicOrderId(uid, caseId) {
    const digest = crypto_1.default
        .createHash("sha256")
        .update(`${uid}:${caseId}:${PREPARATION_PACK_PRODUCT}`)
        .digest("hex")
        .slice(0, 32);
    return `ord_${digest}`;
}
async function createCheckout(uid, _email, productCode, metadata) {
    const { caseId } = metadata;
    if (productCode !== PREPARATION_PACK_PRODUCT) {
        throw new Error("CHECKOUT_PRODUCT_UNSUPPORTED");
    }
    const product = catalog_1.PRODUCT_CATALOG[productCode];
    if (!product || !product.active) {
        throw new Error("CHECKOUT_PRODUCT_INACTIVE");
    }
    const cbamCase = await (0, case_repository_1.verifyCaseOwner)(caseId, uid);
    if (cbamCase.status !== "DRAFT") {
        throw new Error("CHECKOUT_CASE_NOT_DRAFT");
    }
    const sandbox = (0, paddle_client_1.isSandboxMode)();
    const priceId = (0, catalog_1.getPriceIdForProduct)(productCode, sandbox);
    if (!priceId || priceId.includes("...")) {
        throw new Error("CHECKOUT_PRICE_MAPPING_MISSING");
    }
    const orderId = deterministicOrderId(uid, caseId);
    const orderRef = firebase_admin_1.adminDb.collection("commerce_orders").doc(orderId);
    const decision = await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
        const snapshot = await dbTransaction.get(orderRef);
        if (snapshot.exists) {
            const existing = snapshot.data();
            if (existing.uid !== uid ||
                existing.caseId !== caseId ||
                existing.productCode !== productCode ||
                existing.currency !== product.currency ||
                existing.amountMinor !== product.expectedUnitAmount) {
                throw new Error("CHECKOUT_ORDER_IDEMPOTENCY_MISMATCH");
            }
            if (existing.status === "PAYMENT_PENDING" && existing.paddleTransactionId) {
                return { create: false, transactionId: existing.paddleTransactionId };
            }
            if (["PAID", "ENTITLED", "REPORT_RESERVED", "REPORT_CALCULATED", "REPORT_SEALED", "DELIVERED"].includes(existing.status)) {
                throw new Error("PREPARATION_PACK_ALREADY_PURCHASED");
            }
            if (existing.status === "CHECKOUT_CREATED") {
                throw new Error("CHECKOUT_CREATION_IN_PROGRESS");
            }
            if (!["PAYMENT_FAILED", "PAYMENT_CANCELED"].includes(existing.status)) {
                throw new Error(`CHECKOUT_ORDER_STATE_INVALID:${existing.status}`);
            }
            dbTransaction.update(orderRef, {
                status: "CHECKOUT_CREATED",
                paddleTransactionId: null,
                updatedAt: new Date().toISOString(),
            });
            return { create: true };
        }
        const now = new Date().toISOString();
        const order = {
            orderId,
            uid,
            caseId,
            productCode,
            status: "CHECKOUT_CREATED",
            currency: product.currency,
            amountMinor: product.expectedUnitAmount,
            createdAt: now,
            updatedAt: now,
        };
        dbTransaction.set(orderRef, order);
        return { create: true };
    });
    if (!decision.create)
        return decision.transactionId;
    try {
        const paddleTransaction = await paddle_client_1.paddle.transactions.create({
            items: [{ priceId, quantity: 1 }],
            customData: {
                uid,
                orderId,
                caseId,
                productCode,
                environment: sandbox ? "sandbox" : "production",
            },
        });
        await orderRef.update({
            paddleTransactionId: paddleTransaction.id,
            status: "PAYMENT_PENDING",
            updatedAt: new Date().toISOString(),
        });
        return paddleTransaction.id;
    }
    catch (error) {
        await orderRef.update({
            status: "PAYMENT_FAILED",
            updatedAt: new Date().toISOString(),
            lastCheckoutError: error instanceof Error ? error.message : "CHECKOUT_CREATION_FAILED",
        });
        throw error;
    }
}
//# sourceMappingURL=checkout-service.js.map