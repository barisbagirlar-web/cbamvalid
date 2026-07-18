import { paddle } from "./paddle-client";
import { InvalidWebhookSignatureError } from "./commerce-errors";

/**
 * Validates the raw request body against the signature header using the Paddle SDK
 */
export async function verifyWebhookSignature(rawBody: string, signature: string): Promise<any> {
  const secretKey = process.env.PADDLE_WEBHOOK_SECRET_KEY || process.env.PADDLE_WEBHOOK_SECRET || "";
  if (!secretKey) {
    console.error("[PADDLE] Error: PADDLE_WEBHOOK_SECRET or PADDLE_WEBHOOK_SECRET_KEY is not configured.");
    throw new Error("PADDLE_WEBHOOK_SECRET missing.");
  }

  try {
    const event = await paddle.webhooks.unmarshal(rawBody, secretKey, signature);
    if (!event) {
      throw new InvalidWebhookSignatureError();
    }
    return event;
  } catch (error) {
    console.error("[PADDLE] Signature verification check failed:", error);
    throw new InvalidWebhookSignatureError();
  }
}
