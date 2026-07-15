import crypto from "node:crypto";
import type { Transaction } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { adminDb } from "./firebase-admin";
import { processWebhookEvent, type ProcessedWebhookResult } from "./commerce/webhook-processor";
import { verifyWebhookSignature } from "./commerce/webhook-verifier";

type ProcessingState = "PROCESSING" | "PROCESSED" | "IGNORED" | "FAILED_RETRYABLE";

type PaddleEventRecord = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  receivedAt: string;
  updatedAt: string;
  payloadSha256: string;
  payload: unknown;
  signatureVerified: true;
  processingState: ProcessingState;
  attempts: number;
  leaseExpiresAt?: string;
  processedAt?: string;
  uid?: string;
  orderId?: string;
  transactionId?: string;
  productCode?: string;
  lastErrorCode?: string;
};

type IngestionDecision =
  | { action: "PROCESS"; attempts: number }
  | { action: "ACKNOWLEDGE"; state: "PROCESSED" | "IGNORED" }
  | { action: "IN_PROGRESS"; leaseExpiresAt: string }
  | { action: "PAYLOAD_MISMATCH" };

function errorCode(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message.slice(0, 240)
    : "PROCESSING_FAILED";
}

async function acquireProcessingLease(params: {
  transaction: Transaction;
  eventRef: FirebaseFirestore.DocumentReference;
  eventId: string;
  eventType: string;
  occurredAt: string;
  payloadSha256: string;
  payload: unknown;
}): Promise<IngestionDecision> {
  const snapshot = await params.transaction.get(params.eventRef);
  const now = new Date();
  const nowIso = now.toISOString();
  const leaseExpiresAt = new Date(now.getTime() + 5 * 60 * 1000).toISOString();

  if (snapshot.exists) {
    const existing = snapshot.data() as PaddleEventRecord;
    if (existing.payloadSha256 !== params.payloadSha256) return { action: "PAYLOAD_MISMATCH" };
    if (existing.processingState === "PROCESSED" || existing.processingState === "IGNORED") {
      return { action: "ACKNOWLEDGE", state: existing.processingState };
    }
    if (
      existing.processingState === "PROCESSING" &&
      existing.leaseExpiresAt &&
      new Date(existing.leaseExpiresAt).getTime() > now.getTime()
    ) {
      return { action: "IN_PROGRESS", leaseExpiresAt: existing.leaseExpiresAt };
    }

    const attempts = Number(existing.attempts || 0) + 1;
    if (!Number.isSafeInteger(attempts) || attempts < 1 || attempts > 25) {
      throw new Error("PADDLE_WEBHOOK_ATTEMPT_LIMIT_EXCEEDED");
    }
    params.transaction.update(params.eventRef, {
      processingState: "PROCESSING",
      attempts,
      leaseExpiresAt,
      updatedAt: nowIso,
      lastErrorCode: null,
    });
    return { action: "PROCESS", attempts };
  }

  const record: PaddleEventRecord = {
    eventId: params.eventId,
    eventType: params.eventType,
    occurredAt: params.occurredAt,
    receivedAt: nowIso,
    updatedAt: nowIso,
    payloadSha256: params.payloadSha256,
    payload: params.payload,
    signatureVerified: true,
    processingState: "PROCESSING",
    attempts: 1,
    leaseExpiresAt,
  };
  params.transaction.create(params.eventRef, record);
  return { action: "PROCESS", attempts: 1 };
}

export const paddleWebhook = onRequest(
  {
    region: "europe-west1",
    timeoutSeconds: 60,
    memory: "256MiB",
    maxInstances: 20,
  },
  async (request, response) => {
    if (request.method !== "POST") {
      response.set("Allow", "POST").status(405).json({ error: "METHOD_NOT_ALLOWED" });
      return;
    }

    const rawBody = request.rawBody.toString("utf8");
    const signatureHeader = request.headers["paddle-signature"];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader || "";
    if (!signature) {
      response.status(401).json({ error: "PADDLE_SIGNATURE_MISSING" });
      return;
    }

    try {
      const verifiedEvent = await verifyWebhookSignature(rawBody, signature);
      const payloadSha256 = crypto.createHash("sha256").update(rawBody).digest("hex");
      const eventRef = adminDb.collection("paddle_events").doc(verifiedEvent.eventId);
      const decision = await adminDb.runTransaction((transaction) => acquireProcessingLease({
        transaction,
        eventRef,
        eventId: verifiedEvent.eventId,
        eventType: verifiedEvent.eventType,
        occurredAt: verifiedEvent.occurredAt,
        payloadSha256,
        payload: verifiedEvent,
      }));

      if (decision.action === "PAYLOAD_MISMATCH") {
        response.status(409).json({ error: "PADDLE_EVENT_PAYLOAD_MISMATCH" });
        return;
      }
      if (decision.action === "ACKNOWLEDGE") {
        response.status(200).json({
          status: "acknowledged",
          duplicate: true,
          processingState: decision.state,
          eventId: verifiedEvent.eventId,
        });
        return;
      }
      if (decision.action === "IN_PROGRESS") {
        response.status(202).json({
          status: "processing",
          eventId: verifiedEvent.eventId,
          leaseExpiresAt: decision.leaseExpiresAt,
        });
        return;
      }

      try {
        const result: ProcessedWebhookResult = await processWebhookEvent(verifiedEvent);
        const processingState: ProcessingState = result.handled ? "PROCESSED" : "IGNORED";
        await eventRef.update({
          processingState,
          processedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          leaseExpiresAt: null,
          uid: result.uid || null,
          orderId: result.orderId || null,
          transactionId: result.transactionId || null,
          productCode: result.productCode || null,
          idempotentReplay: result.idempotentReplay === true,
        });
        response.status(200).json({
          status: result.handled ? "success" : "ignored",
          eventId: verifiedEvent.eventId,
          eventType: verifiedEvent.eventType,
          idempotentReplay: result.idempotentReplay === true,
        });
      } catch (processingError: unknown) {
        const code = errorCode(processingError);
        console.error(`[PADDLE-WEBHOOK] Processing failed event=${verifiedEvent.eventId} code=${code}`);
        await eventRef.update({
          processingState: "FAILED_RETRYABLE",
          lastErrorCode: code,
          leaseExpiresAt: null,
          updatedAt: new Date().toISOString(),
        });
        response.status(500).json({ error: "PADDLE_PROCESSING_FAILED", eventId: verifiedEvent.eventId });
      }
    } catch (verificationError: unknown) {
      const code = errorCode(verificationError);
      console.error(`[PADDLE-WEBHOOK] Verification failed code=${code}`);
      response.status(401).json({ error: "PADDLE_WEBHOOK_UNAUTHORIZED" });
    }
  }
);
