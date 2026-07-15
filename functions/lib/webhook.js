"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.paddleWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const crypto = __importStar(require("crypto"));
const firebase_admin_1 = require("./firebase-admin");
const webhook_verifier_1 = require("./commerce/webhook-verifier");
const webhook_processor_1 = require("./commerce/webhook-processor");
exports.paddleWebhook = (0, https_1.onRequest)({
    region: "europe-west1",
}, async (request, response) => {
    if (request.method !== "POST") {
        response.status(405).send("Method Not Allowed");
        return;
    }
    let rawBody = request.rawBody.toString("utf8");
    try {
        // 2. Read the signature header
        const signature = request.headers["paddle-signature"] || "";
        if (!signature) {
            response.status(401).json({ error: "Missing signature header" });
            return;
        }
        // 3. Verify signature using the verifier
        const verifiedEvent = await (0, webhook_verifier_1.verifyWebhookSignature)(rawBody, signature);
        const eventId = verifiedEvent.eventId;
        const eventType = verifiedEvent.eventType;
        const occurredAt = verifiedEvent.occurredAt;
        const payloadSha256 = crypto.createHash("sha256").update(rawBody).digest("hex");
        // 4. Duplicate event deduplication checks and registration in transactional block
        const eventRef = firebase_admin_1.adminDb.collection("paddle_events").doc(eventId);
        const duplicate = await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
            const docSnap = await dbTransaction.get(eventRef);
            if (docSnap.exists) {
                const existingEvent = docSnap.data();
                if ((existingEvent === null || existingEvent === void 0 ? void 0 : existingEvent.payloadSha256) === payloadSha256) {
                    return { isDuplicate: true, status: 200 };
                }
                else {
                    return { isDuplicate: true, status: 409 };
                }
            }
            const now = new Date().toISOString();
            const eventRecord = {
                eventId,
                eventType,
                occurredAt,
                receivedAt: now,
                payloadSha256,
                payload: verifiedEvent,
                signatureVerified: true,
                processingState: "PROCESSING",
                attempts: 1,
            };
            dbTransaction.set(eventRef, eventRecord);
            return { isDuplicate: false };
        });
        if (duplicate.isDuplicate) {
            if (duplicate.status === 200) {
                console.log(`[PADDLE-WEBHOOK] Duplicate event ${eventId} recognized. Acknowledging with 200.`);
                response.status(200).json({ status: "acknowledged", duplicate: true });
                return;
            }
            else {
                console.error(`[PADDLE-WEBHOOK] SECURITY WARNING: Event payload mismatch for duplicate event ID ${eventId}!`);
                response.status(409).json({ error: "PAYLOAD_MISMATCH" });
                return;
            }
        }
        // 6. Process the event payload
        try {
            await (0, webhook_processor_1.processWebhookEvent)(verifiedEvent);
            // Mark event as PROCESSED
            await eventRef.update({
                processingState: "PROCESSED",
                processedAt: new Date().toISOString(),
            });
        }
        catch (processError) {
            console.error(`[PADDLE-WEBHOOK] Error processing event ${eventId}:`, processError.message || processError);
            await eventRef.update({
                processingState: "FAILED_RETRYABLE",
                lastErrorCode: processError.message || "PROCESSING_FAILED",
            });
            response.status(500).json({ error: "Processing failed" });
            return;
        }
        // 7. Acknowledge rapidly
        response.status(200).json({ status: "success", eventId });
        return;
    }
    catch (error) {
        console.error("[PADDLE-WEBHOOK] Webhook ingestion failure:", error.message || error);
        response.status(401).json({ error: error.message || "Unauthorized" });
        return;
    }
});
//# sourceMappingURL=webhook.js.map