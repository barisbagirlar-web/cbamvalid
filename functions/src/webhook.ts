import { onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto";
import { adminDb } from "./firebase-admin";
import { verifyWebhookSignature } from "./commerce/webhook-verifier";
import { processWebhookEvent } from "./commerce/webhook-processor";

export const paddleWebhook = onRequest(
  {
    region: "europe-west1",
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    let rawBody = request.rawBody.toString("utf8");
    try {
      // 2. Read the signature header
      const signature = request.headers["paddle-signature"] as string || "";

      if (!signature) {
        response.status(401).json({ error: "Missing signature header" });
        return;
      }

      // 3. Verify signature using the verifier
      const verifiedEvent = await verifyWebhookSignature(rawBody, signature);

      const eventId = verifiedEvent.eventId;
      const eventType = verifiedEvent.eventType;
      const occurredAt = verifiedEvent.occurredAt;
      const payloadSha256 = crypto.createHash("sha256").update(rawBody).digest("hex");

      // 4. Duplicate event deduplication checks and registration in transactional block
      const eventRef = adminDb.collection("paddle_events").doc(eventId);
      const duplicate = await adminDb.runTransaction(async (dbTransaction: any) => {
        const docSnap = await dbTransaction.get(eventRef);
        if (docSnap.exists) {
          const existingEvent = docSnap.data();
          if (existingEvent?.payloadSha256 === payloadSha256) {
            return { isDuplicate: true, status: 200 };
          } else {
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
        } else {
          console.error(`[PADDLE-WEBHOOK] SECURITY WARNING: Event payload mismatch for duplicate event ID ${eventId}!`);
          response.status(409).json({ error: "PAYLOAD_MISMATCH" });
          return;
        }
      }
      // 6. Process the event payload
      try {
        const host = (request.headers.host || "").toLowerCase();
        const forwardedHost = (request.headers["x-forwarded-host"] as string || "").toLowerCase();
        
        const isProductionDomain = 
          host.includes("cbamvalid.com") || 
          host.includes("cbam-desk.web.app") || 
          host.includes("cbam-desk.firebaseapp.com") ||
          forwardedHost.includes("cbamvalid.com") ||
          forwardedHost.includes("cbam-desk.web.app") ||
          forwardedHost.includes("cbam-desk.firebaseapp.com");

        await processWebhookEvent(verifiedEvent, isProductionDomain);

        // Mark event as PROCESSED
        await eventRef.update({
          processingState: "PROCESSED",
          processedAt: new Date().toISOString(),
        });
      } catch (processError: any) {
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

    } catch (error: any) {
      console.error("[PADDLE-WEBHOOK] Webhook ingestion failure:", error.message || error);
      response.status(401).json({ error: error.message || "Unauthorized" });
      return;
    }
  }
);
