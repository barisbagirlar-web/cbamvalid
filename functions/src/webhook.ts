import { onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto";
import { adminDb } from "./firebase-admin";
import { verifyWebhookSignature } from "./commerce/webhook-verifier";
import { processWebhookEvent } from "./commerce/webhook-processor";

const PROCESSING_LEASE_MS = 5 * 60 * 1000;

type IngestionDecision =
  | { action: "PROCESS"; attempts: number }
  | { action: "ACK_PROCESSED" }
  | { action: "CONFLICT" }
  | { action: "BUSY" };

export const paddleWebhook = onRequest(
  {
    region: "europe-west1",
    secrets: ["PADDLE_WEBHOOK_SECRET"],
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    const rawBody = request.rawBody.toString("utf8");
    try {
      const signature = request.headers["paddle-signature"] as string || "";
      if (!signature) {
        response.status(401).json({ error: "Missing signature header" });
        return;
      }

      const verifiedEvent = await verifyWebhookSignature(rawBody, signature);
      const eventId = verifiedEvent.eventId;
      const eventType = verifiedEvent.eventType;
      const occurredAt = verifiedEvent.occurredAt;
      const payloadSha256 = crypto.createHash("sha256").update(rawBody).digest("hex");

      if (!eventId || !eventType) {
        response.status(400).json({ error: "EVENT_ID_OR_TYPE_MISSING" });
        return;
      }

      const eventRef = adminDb.collection("paddle_events").doc(eventId);
      const nowMs = Date.now();
      const now = new Date(nowMs).toISOString();
      const leaseUntil = new Date(nowMs + PROCESSING_LEASE_MS).toISOString();

      const decision = await adminDb.runTransaction<IngestionDecision>(async (dbTransaction) => {
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
        await processWebhookEvent(verifiedEvent);
        await eventRef.update({
          processingState: "PROCESSED",
          processedAt: new Date().toISOString(),
          processingLeaseUntil: null,
          lastErrorCode: null,
        });
      } catch (processError: unknown) {
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unauthorized";
      console.error("[PADDLE-WEBHOOK] Webhook ingestion failure:", error);
      response.status(401).json({ error: message });
    }
  }
);
