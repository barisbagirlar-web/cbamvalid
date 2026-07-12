"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckout = createCheckout;
const catalog_1 = require("../../commerce/catalog");
const paddle_client_1 = require("../paddle-client");
const firebase_admin_1 = require("../../firebase-admin");
const order_service_1 = require("../order-service");
async function createCheckout(uid, email, productCode, metadata) {
    const { caseId } = metadata;
    const product = catalog_1.PRODUCT_CATALOG[productCode];
    if (!product || !product.active) {
        throw new Error("Product is inactive or invalid");
    }
    const isSandbox = (0, paddle_client_1.isSandboxMode)();
    const priceId = (0, catalog_1.getPriceIdForProduct)(productCode, isSandbox);
    if (!priceId) {
        throw new Error("Price mapping missing for the requested product code");
    }
    const result = await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
        // Create server-side tracking order
        const order = await (0, order_service_1.createOrder)(dbTransaction, {
            uid: uid,
            caseId: caseId,
            productCode: productCode,
            currency: product.currency,
            amountMinor: product.expectedUnitAmount,
        });
        return order;
    });
    const paddleTransaction = await paddle_client_1.paddle.transactions.create({
        items: [
            {
                priceId: priceId,
                quantity: 1,
            },
        ],
        customData: {
            uid: uid,
            orderId: result.orderId,
            caseId: caseId,
            productCode: productCode,
            environment: isSandbox ? "sandbox" : "production",
        },
    });
    await firebase_admin_1.adminDb.collection("commerce_orders").doc(result.orderId).update({
        paddleTransactionId: paddleTransaction.id,
        status: "PAYMENT_PENDING",
    });
    return paddleTransaction.id;
}
//# sourceMappingURL=checkout-service.js.map