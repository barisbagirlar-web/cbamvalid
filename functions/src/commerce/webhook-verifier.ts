import { paddle } from "./paddle-client";
import { InvalidWebhookSignatureError } from "./commerce-errors";

type VerifiedWebhookEvent = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  data: Record<string, unknown>;
};

/**
 * Validates the raw request body against the signature header using the Paddle SDK
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string
): Promise<VerifiedWebhookEvent> {
  // Cloud Run binds Secret Manager as PADDLE_WEBHOOK_SECRET; Next/.env may use _KEY.
  const secretKey =
    process.env.PADDLE_WEBHOOK_SECRET_KEY || process.env.PADDLE_WEBHOOK_SECRET || "";
  if (!secretKey) {
    console.error("[PADDLE] Error: PADDLE_WEBHOOK_SECRET_KEY / PADDLE_WEBHOOK_SECRET is not configured.");
    throw new Error("PADDLE_WEBHOOK_SECRET missing.");
  }

  try {
    const event = await paddle.webhooks.unmarshal(rawBody, secretKey, signature);
    if (!event) {
      throw new InvalidWebhookSignatureError();
    }
    return {
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      data: { ...event.data },
    };
  } catch (error) {
    console.error("[PADDLE] Signature verification check failed:", error);
    throw new InvalidWebhookSignatureError();
  }
}
