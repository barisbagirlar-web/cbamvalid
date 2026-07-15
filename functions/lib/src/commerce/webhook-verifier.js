"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhookSignature = verifyWebhookSignature;
const paddle_client_1 = require("./paddle-client");
const commerce_errors_1 = require("./commerce-errors");
/**
 * Validates the raw request body against the signature header using the Paddle SDK
 */
async function verifyWebhookSignature(rawBody, signature) {
    const secretKey = process.env.PADDLE_WEBHOOK_SECRET_KEY || "";
    if (!secretKey) {
        console.error("[PADDLE] Error: PADDLE_WEBHOOK_SECRET_KEY is not configured.");
        throw new Error("PADDLE_WEBHOOK_SECRET_KEY missing.");
    }
    try {
        const event = await paddle_client_1.paddle.webhooks.unmarshal(rawBody, secretKey, signature);
        if (!event) {
            throw new commerce_errors_1.InvalidWebhookSignatureError();
        }
        return event;
    }
    catch (error) {
        console.error("[PADDLE] Signature verification check failed:", error);
        throw new commerce_errors_1.InvalidWebhookSignatureError();
    }
}
//# sourceMappingURL=webhook-verifier.js.map