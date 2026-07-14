import { paddle } from "./paddle-client";
import { InvalidWebhookSignatureError } from "./commerce-errors";

/**
 * Validates the raw request body against the Paddle-Signature header.
 * The canonical secret name is PADDLE_WEBHOOK_SECRET across every runtime.
 */
export async function verifyWebhookSignature(rawBody: string, signature: string): Promise<any> {
  const secretKey = process.env.PADDLE_WEBHOOK_SECRET || "";
  if (!secretKey) {
    console.error("[PADDLE] PADDLE_WEBHOOK_SECRET is not configured.");
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
