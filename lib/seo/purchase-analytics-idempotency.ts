/**
 * Persistent purchase-analytics idempotency.
 * Key scheme mirrors commerce ledger: analytics_purchase:${transactionId}
 * Exactly-once emission across process restarts and concurrent instances.
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

/**
 * In-memory transactional store for unit tests (simulates Firestore doc create-if-absent).
 * Not for production.
 */
export function createMemoryPurchaseAnalyticsStore(): PurchaseAnalyticsIdempotencyStore & {
  readonly size: () => number;
  readonly reset: () => void;
} {
  const docs = new Map<string, PurchaseAnalyticsEmissionRecord>();
  let lock: Promise<void> = Promise.resolve();

  return {
    size: () => docs.size,
    reset: () => docs.clear(),
    async claim(record) {
      const run = lock.then(async () => {
        const existing = docs.get(record.idempotencyKey);
        if (existing) {
          return { status: "duplicate" as const, record: existing };
        }
        docs.set(record.idempotencyKey, record);
        return { status: "created" as const, record };
      });
      // Serialize claims to mimic transactional contention on the same key.
      lock = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
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

/**
 * Exactly-once emit: claim first, emit only on created.
 * Returns emission delta (1 or 0) for regression assertions.
 */
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
