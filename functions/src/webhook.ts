import { onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto";
import { adminDb } from "./firebase-admin";
import { verifyWebhookSignature } from "./commerce/webhook-verifier";
import { processWebhookEvent } from "./commerce/webhook-processor";

export type ExistingPaddleEventDecision =
  | "ACK_PROCESSED"
  | "RETRY"
  | "IN_FLIGHT"
  | "PAYLOAD_MISMATCH";

export function classifyExistingPaddleEvent(
  existingEvent: Record<string, unknown>,
  payloadSha256: string,
  nowMs = Date.now()
): ExistingPaddleEventDecision {
  if (existingEvent.payloadSha256 !== payloadSha256) return "PAYLOAD_MISMATCH";
  if (existingEvent.processingState === "PROCESSED") return "ACK_PROCESSED";
  const lastAttemptAt = Date.parse(
    String(existingEvent.lastAttemptAt || existingEvent.receivedAt || "")
  );
  const processingIsStale =
    existingEvent.processingState === "PROCESSING" &&
    Number.isFinite(lastAttemptAt) &&
    nowMs - lastAttemptAt > 5 * 60 * 1000;
  if (existingEvent.processingState === "FAILED_RETRYABLE" || processingIsStale) {
    return "RETRY";
  }
  return "IN_FLIGHT";
}

export const paddleWebhook = onRequest(
  {
    region: "europe-west1",
    // Secret Manager bindings (names must match deployed secrets)
    secrets: ["PADDLE_WEBHOOK_SECRET", "PADDLE_API_KEY"],
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    const rawBody = request.rawBody.toString("utf8");
    let signatureVerified = false;
    try {
      // 2. Read the signature header
      const signature = request.headers["paddle-signature"] as string || "";

      if (!signature) {
        response.status(401).json({ error: "Missing signature header" });
        return;
      }

      // 3. Verify signature using the verifier
      const verifiedEvent = await verifyWebhookSignature(rawBody, signature);
      signatureVerified = true;

      const eventId = verifiedEvent.eventId;
      const eventType = verifiedEvent.eventType;
      const occurredAt = verifiedEvent.occurredAt;
      const payloadSha256 = crypto.createHash("sha256").update(rawBody).digest("hex");

      // 4. Duplicate event deduplication checks and registration in transactional block
      const eventRef = adminDb.collection("paddle_events").doc(eventId);
      const duplicate = await adminDb.runTransaction(async (dbTransaction) => {
        const docSnap = await dbTransaction.get(eventRef);
        if (docSnap.exists) {
          const existingEvent = docSnap.data();
          const decision = classifyExistingPaddleEvent(existingEvent || {}, payloadSha256);
          if (decision === "PAYLOAD_MISMATCH") {
            return { isDuplicate: true, status: 409 };
          }
          if (decision === "ACK_PROCESSED") {
            return { isDuplicate: true, status: 200 };
          }
          if (decision === "RETRY") {
            dbTransaction.update(eventRef, {
              processingState: "PROCESSING",
              attempts: Number(existingEvent?.attempts || 0) + 1,
              lastAttemptAt: new Date().toISOString(),
              lastErrorCode: null,
            });
            return { isDuplicate: false, retry: true };
          }
          return { isDuplicate: true, status: 503 };
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
          lastAttemptAt: now,
        };

        dbTransaction.set(eventRef, eventRecord);
        return { isDuplicate: false };
      });

      if (duplicate.isDuplicate) {
        if (duplicate.status === 200) {
          console.log(`[PADDLE-WEBHOOK] Duplicate event ${eventId} recognized. Acknowledging with 200.`);
          response.status(200).json({ status: "acknowledged", duplicate: true });
          return;
        } else if (duplicate.status === 409) {
          console.error(`[PADDLE-WEBHOOK] SECURITY WARNING: Event payload mismatch for duplicate event ID ${eventId}!`);
          response.status(409).json({ error: "PAYLOAD_MISMATCH" });
          return;
        } else {
          response.status(503).json({ error: "EVENT_ALREADY_PROCESSING" });
          return;
        }
      }

      // 6. Process the event payload
      try {
        await processWebhookEvent(verifiedEvent);

        // Mark event as PROCESSED
        await eventRef.update({
          processingState: "PROCESSED",
          processedAt: new Date().toISOString(),
        });
      } catch (processError: unknown) {
        const processMessage =
          processError instanceof Error ? processError.message : "PROCESSING_FAILED";
        console.error(`[PADDLE-WEBHOOK] Error processing event ${eventId}:`, processMessage);
        
        await eventRef.update({
          processingState: "FAILED_RETRYABLE",
          lastErrorCode: processMessage,
          failedAt: new Date().toISOString(),
        });

        response.status(500).json({ error: "Processing failed" });
        return;
      }

      // 7. Acknowledge rapidly
      response.status(200).json({ status: "success", eventId });
      return;

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unauthorized";
      console.error("[PADDLE-WEBHOOK] Webhook ingestion failure:", message);
      response
        .status(signatureVerified ? 500 : 401)
        .json({ error: signatureVerified ? "Webhook ingestion failed" : message });
      return;
    }
  }
);
