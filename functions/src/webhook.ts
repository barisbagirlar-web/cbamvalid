import { onRequest } from "firebase-functions/v2/https";
import { createHash } from "node:crypto";
import { adminDb } from "./firebase-admin";
import { verifyWebhookSignature } from "./commerce/webhook-verifier";
import { processWebhookEvent } from "./commerce/webhook-processor";

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "WEBHOOK_PROCESSING_FAILED";
}

function eventUid(event: Record<string, unknown>): string | null {
  const data = event.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const customData = (data as Record<string, unknown>).customData;
  if (!customData || typeof customData !== "object" || Array.isArray(customData)) return null;
  const uid = (customData as Record<string, unknown>).uid;
  return typeof uid === "string" && uid.trim() ? uid.trim() : null;
}

function eventDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export const paddleWebhook = onRequest(
  { region: "europe-west1" },
  async (request, response) => {
    if (request.method !== "POST") {
      response.status(405).send("Method Not Allowed");
      return;
    }

    const rawBody = request.rawBody.toString("utf8");
    const signature = typeof request.headers["paddle-signature"] === "string"
      ? request.headers["paddle-signature"]
      : "";
    if (!signature) {
      response.status(401).json({ error: "MISSING_SIGNATURE" });
      return;
    }

    let verifiedEvent: Record<string, unknown>;
    try {
      verifiedEvent = await verifyWebhookSignature(rawBody, signature);
    } catch (verificationError) {
      const code = errorMessage(verificationError);
      console.error("[PADDLE-WEBHOOK] Verification failure", verificationError);
      if (code === "PADDLE_WEBHOOK_SECRET_MISSING") {
        response.status(500).json({ error: "WEBHOOK_CONFIGURATION_ERROR", code });
      } else {
        response.status(401).json({ error: "WEBHOOK_VERIFICATION_FAILED" });
      }
      return;
    }

    const eventId = typeof verifiedEvent.eventId === "string" ? verifiedEvent.eventId.trim() : "";
    const eventType = typeof verifiedEvent.eventType === "string" ? verifiedEvent.eventType.trim() : "";
    const occurredAt = eventDate(verifiedEvent.occurredAt);
    if (!eventId || eventId.length > 128 || !eventType || eventType.length > 128 || !occurredAt) {
      response.status(400).json({ error: "PADDLE_EVENT_ENVELOPE_INVALID" });
      return;
    }

    const payloadSha256 = createHash("sha256").update(rawBody).digest("hex");
    const eventRef = adminDb.collection("paddle_events").doc(eventId);
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

    let acquisition: "PROCESS" | "PAYLOAD_MISMATCH" | "ACKNOWLEDGE" | "IN_PROGRESS" | "RETRY_LIMIT";
    try {
      acquisition = await adminDb.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(eventRef);
        if (!snapshot.exists) {
          transaction.create(eventRef, {
            eventId,
            eventType,
            occurredAt,
            receivedAt: now.toISOString(),
            payloadSha256,
            payload: verifiedEvent,
            uid: eventUid(verifiedEvent),
            signatureVerified: true,
            processingState: "PROCESSING",
            attempts: 1,
            leaseExpiresAt,
          });
          return "PROCESS" as const;
        }

        const existing = snapshot.data() as Record<string, unknown>;
        if (existing.payloadSha256 !== payloadSha256) return "PAYLOAD_MISMATCH" as const;
        if (existing.processingState === "PROCESSED") return "ACKNOWLEDGE" as const;

        const currentLease = typeof existing.leaseExpiresAt === "string"
          ? new Date(existing.leaseExpiresAt).getTime()
          : 0;
        if (existing.processingState === "PROCESSING" && currentLease > now.getTime()) {
          return "IN_PROGRESS" as const;
        }

        const attempts = Number(existing.attempts || 0);
        if (!Number.isSafeInteger(attempts) || attempts < 0 || attempts >= 10) {
          return "RETRY_LIMIT" as const;
        }
        transaction.update(eventRef, {
          processingState: "PROCESSING",
          attempts: attempts + 1,
          leaseExpiresAt,
          lastErrorCode: null,
          updatedAt: now.toISOString(),
        });
        return "PROCESS" as const;
      });
    } catch (ingestionError) {
      console.error(`[PADDLE-WEBHOOK] Event lease acquisition failed for ${eventId}`, ingestionError);
      response.status(500).json({ error: "WEBHOOK_INGESTION_FAILED" });
      return;
    }

    if (acquisition === "ACKNOWLEDGE") {
      response.status(200).json({ status: "acknowledged", duplicate: true });
      return;
    }
    if (acquisition === "PAYLOAD_MISMATCH") {
      response.status(409).json({ error: "PAYLOAD_MISMATCH" });
      return;
    }
    if (acquisition === "IN_PROGRESS") {
      response.status(409).json({ error: "EVENT_PROCESSING_IN_PROGRESS" });
      return;
    }
    if (acquisition === "RETRY_LIMIT") {
      response.status(500).json({ error: "WEBHOOK_RETRY_LIMIT_EXCEEDED" });
      return;
    }

    try {
      await processWebhookEvent(verifiedEvent);
      await eventRef.update({
        processingState: "PROCESSED",
        processedAt: new Date().toISOString(),
        leaseExpiresAt: new Date().toISOString(),
        lastErrorCode: null,
      });
      response.status(200).json({ status: "success", eventId });
    } catch (processingError) {
      const code = errorMessage(processingError);
      console.error(`[PADDLE-WEBHOOK] Processing failed for ${eventId}`, processingError);
      try {
        await eventRef.update({
          processingState: "FAILED_RETRYABLE",
          lastErrorCode: code,
          leaseExpiresAt: new Date().toISOString(),
          failedAt: new Date().toISOString(),
        });
      } catch (stateError) {
        console.error(`[PADDLE-WEBHOOK] Failure state persistence failed for ${eventId}`, stateError);
      }
      response.status(500).json({ error: "PROCESSING_FAILED", code });
    }
  }
);
