import { onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto";
import { adminDb } from "./firebase-admin";
import { verifyWebhookSignature } from "./commerce/webhook-verifier";
import { processWebhookEvent } from "./commerce/webhook-processor";

export const paddleWebhook = onRequest(
  {
    region: "europe-west1",
    secrets: ["PADDLE_API_KEY", "PADDLE_WEBHOOK_SECRET"],
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

      const eventRef = adminDb.collection("paddle_events").doc(eventId);
      const duplicate = await adminDb.runTransaction(async (dbTransaction) => {
        const docSnap = await dbTransaction.get(eventRef);
        if (docSnap.exists) {
          const existingEvent = docSnap.data();
          return {
            isDuplicate: true,
            status: existingEvent?.payloadSha256 === payloadSha256 ? 200 : 409,
          };
        }

        const now = new Date().toISOString();
        dbTransaction.set(eventRef, {
          eventId,
          eventType,
          occurredAt,
          receivedAt: now,
          payloadSha256,
          payload: verifiedEvent,
          signatureVerified: true,
          processingState: "PROCESSING",
          attempts: 1,
        });
        return { isDuplicate: false, status: 200 };
      });

      if (duplicate.isDuplicate) {
        if (duplicate.status === 200) {
          console.log(`[PADDLE-WEBHOOK] Duplicate event ${eventId} recognized. Acknowledging with 200.`);
          response.status(200).json({ status: "acknowledged", duplicate: true });
          return;
        }
        console.error(`[PADDLE-WEBHOOK] SECURITY WARNING: Event payload mismatch for duplicate event ID ${eventId}.`);
        response.status(409).json({ error: "PAYLOAD_MISMATCH" });
        return;
      }

      try {
        await processWebhookEvent(verifiedEvent);
        await eventRef.update({
          processingState: "PROCESSED",
          processedAt: new Date().toISOString(),
        });
      } catch (processError: unknown) {
        const message = processError instanceof Error ? processError.message : "PROCESSING_FAILED";
        console.error(`[PADDLE-WEBHOOK] Error processing event ${eventId}:`, processError);
        await eventRef.update({
          processingState: "FAILED_RETRYABLE",
          lastErrorCode: message,
        });
        response.status(500).json({ error: "Processing failed" });
        return;
      }

      response.status(200).json({ status: "success", eventId });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unauthorized";
      console.error("[PADDLE-WEBHOOK] Webhook ingestion failure:", error);
      response.status(401).json({ error: message });
    }
  }
);
