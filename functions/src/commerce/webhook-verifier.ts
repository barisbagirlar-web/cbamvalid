import { z } from "zod";
import { InvalidWebhookSignatureError } from "./commerce-errors";
import { getPaddleClient } from "./paddle-client";

const VerifiedWebhookEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  occurredAt: z.string().min(1),
  data: z.unknown(),
});

export type VerifiedWebhookEvent = z.infer<typeof VerifiedWebhookEventSchema>;

export async function verifyWebhookSignature(rawBody: string, signature: string): Promise<VerifiedWebhookEvent> {
  const secretKey = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secretKey) throw new Error("PADDLE_WEBHOOK_SECRET_MISSING");
  if (!rawBody) throw new InvalidWebhookSignatureError();
  if (!signature) throw new InvalidWebhookSignatureError();

  try {
    const event = await getPaddleClient().webhooks.unmarshal(rawBody, secretKey, signature);
    return VerifiedWebhookEventSchema.parse(event);
  } catch (error: unknown) {
    console.error("[PADDLE] Webhook signature or payload validation failed.", error);
    throw new InvalidWebhookSignatureError();
  }
}
