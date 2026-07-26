/**
 * Persistent purchase-analytics idempotency (Functions copy — keep parity with
 * lib/seo/purchase-analytics-idempotency.ts).
 * Key: analytics_purchase:${transactionId}
 */

export const SEO_ANALYTICS_IDEMPOTENCY_COLLECTION = "seo_analytics_idempotency" as const;

export function buildPurchaseAnalyticsIdempotencyKey(transactionId: string): string {
  const cleaned = transactionId.trim();
  if (cleaned.length < 4) {
    throw new Error("PURCHASE_ANALYTICS_TRANSACTION_ID_INVALID");
  }
  return `analytics_purchase:${cleaned}`;
}

export interface PurchaseAnalyticsEmissionRecord {
  readonly idempotencyKey: string;
  readonly transactionId: string;
  readonly eventId?: string;
  readonly value: number;
  readonly currency: "USD";
  readonly landingPage?: string;
  readonly source?: string;
  readonly medium?: string;
  readonly campaign?: string;
  readonly referrer?: string;
  readonly emittedAt: string;
  readonly emitter: "api_seo_track" | "paddle_webhook" | "test";
}

export type PurchaseAnalyticsClaimResult =
  | { readonly status: "created"; readonly record: PurchaseAnalyticsEmissionRecord }
  | { readonly status: "duplicate"; readonly record: PurchaseAnalyticsEmissionRecord };

export interface PurchaseAnalyticsIdempotencyStore {
  claim(record: PurchaseAnalyticsEmissionRecord): Promise<PurchaseAnalyticsClaimResult>;
}

export async function claimPurchaseAnalyticsEmission(
  store: PurchaseAnalyticsIdempotencyStore,
  input: {
    transactionId: string;
    eventId?: string;
    value: number | string;
    currency: "USD";
    landingPage?: string;
    source?: string;
    medium?: string;
    campaign?: string;
    referrer?: string;
    emitter: PurchaseAnalyticsEmissionRecord["emitter"];
  },
): Promise<PurchaseAnalyticsClaimResult> {
  const value = typeof input.value === "number" ? input.value : Number(input.value);
  if (!Number.isFinite(value)) {
    throw new Error("PURCHASE_ANALYTICS_VALUE_INVALID");
  }
  const idempotencyKey = buildPurchaseAnalyticsIdempotencyKey(input.transactionId);
  const record: PurchaseAnalyticsEmissionRecord = {
    idempotencyKey,
    transactionId: input.transactionId.trim(),
    eventId: input.eventId,
    value,
    currency: "USD",
    landingPage: input.landingPage,
    source: input.source,
    medium: input.medium,
    campaign: input.campaign,
    referrer: input.referrer,
    emittedAt: new Date().toISOString(),
    emitter: input.emitter,
  };
  return store.claim(record);
}

export async function emitPurchaseAnalyticsExactlyOnce(
  store: PurchaseAnalyticsIdempotencyStore,
  input: Parameters<typeof claimPurchaseAnalyticsEmission>[1],
  emit: (record: PurchaseAnalyticsEmissionRecord) => Promise<void> | void,
): Promise<{ status: "emitted" | "duplicate"; emissionDelta: 0 | 1; record: PurchaseAnalyticsEmissionRecord }> {
  const claim = await claimPurchaseAnalyticsEmission(store, input);
  if (claim.status === "duplicate") {
    return { status: "duplicate", emissionDelta: 0, record: claim.record };
  }
  await emit(claim.record);
  return { status: "emitted", emissionDelta: 1, record: claim.record };
}
