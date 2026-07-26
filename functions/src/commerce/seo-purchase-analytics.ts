import { adminDb } from "../firebase-admin";
import {
  SEO_ANALYTICS_IDEMPOTENCY_COLLECTION,
  type PurchaseAnalyticsEmissionRecord,
  type PurchaseAnalyticsClaimResult,
  type PurchaseAnalyticsIdempotencyStore,
  emitPurchaseAnalyticsExactlyOnce,
} from "./purchase-analytics-idempotency";

export function createFunctionsPurchaseAnalyticsStore(): PurchaseAnalyticsIdempotencyStore {
  const collection = adminDb.collection(SEO_ANALYTICS_IDEMPOTENCY_COLLECTION);
  return {
    async claim(record: PurchaseAnalyticsEmissionRecord): Promise<PurchaseAnalyticsClaimResult> {
      return adminDb.runTransaction(async (tx) => {
        const ref = collection.doc(record.idempotencyKey);
        const snap = await tx.get(ref);
        if (snap.exists) {
          return {
            status: "duplicate",
            record: snap.data() as PurchaseAnalyticsEmissionRecord,
          };
        }
        tx.set(ref, record);
        return { status: "created", record };
      });
    },
  };
}

/**
 * Emit purchase analytics exactly once after Paddle-verified fulfillment.
 * Shares Firestore collection/key with Next /api/seo/track.
 */
export async function emitVerifiedPurchaseAnalytics(params: {
  transactionId: string;
  eventId: string;
  valueMinor: number;
  currency: string;
}): Promise<{ status: "emitted" | "duplicate"; emissionDelta: 0 | 1 }> {
  if (params.currency !== "USD") {
    console.warn(
      `[SEO-PURCHASE-ANALYTICS] Skipping non-USD analytics emission for ${params.transactionId}`,
    );
    return { status: "duplicate", emissionDelta: 0 };
  }

  const store = createFunctionsPurchaseAnalyticsStore();
  const result = await emitPurchaseAnalyticsExactlyOnce(
    store,
    {
      transactionId: params.transactionId,
      eventId: params.eventId,
      value: params.valueMinor / 100,
      currency: "USD",
      emitter: "paddle_webhook",
    },
    (record) => {
      console.info(
        JSON.stringify({
          type: "seo_conversion_event",
          event: "purchase",
          transaction_id: record.transactionId,
          event_id: record.eventId,
          value: record.value,
          currency: record.currency,
          emitter: record.emitter,
          idempotencyKey: record.idempotencyKey,
          ts: record.emittedAt,
        }),
      );
    },
  );
  return { status: result.status, emissionDelta: result.emissionDelta };
}
