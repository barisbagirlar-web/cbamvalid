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
const PROCESSING_LEASE_MS = 5 * 60 * 1000;
exports.paddleWebhook = (0, https_1.onRequest)({
    region: "europe-west1",
    secrets: ["PADDLE_WEBHOOK_SECRET"],
}, async (request, response) => {
    if (request.method !== "POST") {
        response.status(405).send("Method Not Allowed");
        return;
    }
    const rawBody = request.rawBody.toString("utf8");
    try {
        const signature = request.headers["paddle-signature"] || "";
        if (!signature) {
            response.status(401).json({ error: "Missing signature header" });
            return;
        }
        const verifiedEvent = await (0, webhook_verifier_1.verifyWebhookSignature)(rawBody, signature);
        const eventId = verifiedEvent.eventId;
        const eventType = verifiedEvent.eventType;
        const occurredAt = verifiedEvent.occurredAt;
        const payloadSha256 = crypto.createHash("sha256").update(rawBody).digest("hex");
        if (!eventId || !eventType) {
            response.status(400).json({ error: "EVENT_ID_OR_TYPE_MISSING" });
            return;
        }
        const eventRef = firebase_admin_1.adminDb.collection("paddle_events").doc(eventId);
        const nowMs = Date.now();
        const now = new Date(nowMs).toISOString();
        const leaseUntil = new Date(nowMs + PROCESSING_LEASE_MS).toISOString();
        const decision = await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
            const snapshot = await dbTransaction.get(eventRef);
            if (!snapshot.exists) {
                dbTransaction.set(eventRef, {
                    eventId,
                    eventType,
                    occurredAt,
                    receivedAt: now,
                    payloadSha256,
                    signatureVerified: true,
                    processingState: "PROCESSING",
                    attempts: 1,
                    processingLeaseUntil: leaseUntil,
                });
                return { action: "PROCESS", attempts: 1 };
            }
            const existing = snapshot.data() || {};
            if (existing.payloadSha256 !== payloadSha256) {
                return { action: "CONFLICT" };
            }
            if (existing.processingState === "PROCESSED") {
                return { action: "ACK_PROCESSED" };
            }
            const existingLeaseMs = Date.parse(String(existing.processingLeaseUntil || ""));
            if (existing.processingState === "PROCESSING" && Number.isFinite(existingLeaseMs) && existingLeaseMs > nowMs) {
                return { action: "BUSY" };
            }
            const attempts = Number(existing.attempts || 0) + 1;
            dbTransaction.update(eventRef, {
                processingState: "PROCESSING",
                attempts,
                lastAttemptAt: now,
                processingLeaseUntil: leaseUntil,
                lastErrorCode: null,
            });
            return { action: "PROCESS", attempts };
        });
        if (decision.action === "CONFLICT") {
            console.error(`[PADDLE-WEBHOOK] SECURITY WARNING: payload mismatch for duplicate event ID ${eventId}.`);
            response.status(409).json({ error: "PAYLOAD_MISMATCH" });
            return;
        }
        if (decision.action === "ACK_PROCESSED") {
            response.status(200).json({ status: "acknowledged", duplicate: true, eventId });
            return;
        }
        if (decision.action === "BUSY") {
            // A live worker owns the event lease. Returning a retryable response
            // prevents a concurrent duplicate from being falsely acknowledged.
            response.status(503).json({ error: "EVENT_PROCESSING_IN_PROGRESS", eventId });
            return;
        }
        try {
            await (0, webhook_processor_1.processWebhookEvent)(verifiedEvent);
            await eventRef.update({
                processingState: "PROCESSED",
                processedAt: new Date().toISOString(),
                processingLeaseUntil: null,
                lastErrorCode: null,
            });
        }
        catch (processError) {
            const message = processError instanceof Error ? processError.message : "PROCESSING_FAILED";
            console.error(`[PADDLE-WEBHOOK] Error processing event ${eventId}:`, processError);
            await eventRef.update({
                processingState: "FAILED_RETRYABLE",
                failedAt: new Date().toISOString(),
                processingLeaseUntil: null,
                lastErrorCode: message,
            });
            response.status(500).json({ error: "Processing failed", eventId });
            return;
        }
        response.status(200).json({ status: "success", eventId, attempts: decision.attempts });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Unauthorized";
        console.error("[PADDLE-WEBHOOK] Webhook ingestion failure:", error);
        response.status(401).json({ error: message });
    }
});
//# sourceMappingURL=webhook.js.map