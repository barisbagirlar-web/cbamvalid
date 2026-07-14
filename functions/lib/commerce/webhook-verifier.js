"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhookSignature = verifyWebhookSignature;
const paddle_client_1 = require("./paddle-client");
const commerce_errors_1 = require("./commerce-errors");
/**
 * Validates the raw request body against the Paddle-Signature header.
 * The canonical secret name is PADDLE_WEBHOOK_SECRET across every runtime.
 */
async function verifyWebhookSignature(rawBody, signature) {
    const secretKey = process.env.PADDLE_WEBHOOK_SECRET || "";
    if (!secretKey) {
        console.error("[PADDLE] PADDLE_WEBHOOK_SECRET is not configured.");
        throw new Error("PADDLE_WEBHOOK_SECRET missing.");
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