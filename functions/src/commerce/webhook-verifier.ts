import { paddle } from "./paddle-client";
import { InvalidWebhookSignatureError } from "./commerce-errors";

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string
): Promise<Record<string, unknown>> {
  if (!rawBody) throw new InvalidWebhookSignatureError();
  if (!signature.trim()) throw new InvalidWebhookSignatureError();
  const secretKey = (
    process.env.PADDLE_WEBHOOK_SECRET?.trim() ||
    process.env.PADDLE_WEBHOOK_SECRET_KEY?.trim() ||
    ""
  );
  if (!secretKey) throw new Error("PADDLE_WEBHOOK_SECRET_MISSING");

  try {
    const event = await paddle.webhooks.unmarshal(rawBody, secretKey, signature);
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      throw new InvalidWebhookSignatureError();
    }
    return event as unknown as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.message === "PADDLE_WEBHOOK_SECRET_MISSING") throw error;
    console.error("[PADDLE] Signature verification failed", error);
    throw new InvalidWebhookSignatureError();
  }
}
