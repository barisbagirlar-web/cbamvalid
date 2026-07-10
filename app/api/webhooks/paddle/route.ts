import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import { verifyWebhookSignature } from "@/lib/commerce/webhook-verifier";
import { processWebhookEvent } from "@/lib/commerce/webhook-processor";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let rawBody = "";
  try {
    // 1. Read the exact raw body text for signature integrity
    rawBody = await request.text();
    
    // 2. Read the signature header
    const signature = request.headers.get("paddle-signature") || "";

    if (!signature) {
      return NextResponse.json({ error: "Missing signature header" }, { status: 401 });
    }

    // 3. Verify signature using the verifier
    const verifiedEvent = await verifyWebhookSignature(rawBody, signature);

    const eventId = verifiedEvent.eventId;
    const eventType = verifiedEvent.eventType;
    const occurredAt = verifiedEvent.occurredAt;
    const payloadSha256 = crypto.createHash("sha256").update(rawBody).digest("hex");

    // 4. Duplicate event deduplication checks
    const eventRef = adminDb.collection("paddle_events").doc(eventId);
    const existingEventDoc = await eventRef.get();

    if (existingEventDoc.exists) {
      const existingEvent = existingEventDoc.data();
      if (existingEvent?.payloadSha256 === payloadSha256) {
        console.log(`[PADDLE-WEBHOOK] Duplicate event ${eventId} recognized. Acknowledging with 200.`);
        return NextResponse.json({ status: "acknowledged", duplicate: true }, { status: 200 });
      } else {
        console.error(`[PADDLE-WEBHOOK] SECURITY WARNING: Event payload mismatch for duplicate event ID ${eventId}!`);
        return NextResponse.json({ error: "PAYLOAD_MISMATCH" }, { status: 409 });
      }
    }

    // 5. Register the event in RECEIVED state
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

    await eventRef.set(eventRecord);

    // 6. Process the event payload
    try {
      await processWebhookEvent(verifiedEvent);

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

      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }

    // 7. Acknowledge rapidly
    return NextResponse.json({ status: "success", eventId }, { status: 200 });

  } catch (error: any) {
    console.error("[PADDLE-WEBHOOK] Webhook ingestion failure:", error.message || error);
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }
}
