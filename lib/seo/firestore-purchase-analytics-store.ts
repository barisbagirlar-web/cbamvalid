import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import {
  SEO_ANALYTICS_IDEMPOTENCY_COLLECTION,
  type PurchaseAnalyticsEmissionRecord,
  type PurchaseAnalyticsClaimResult,
  type PurchaseAnalyticsIdempotencyStore,
} from "./purchase-analytics-idempotency";

/**
 * Firestore-backed create-if-absent store.
 * Document ID = idempotencyKey (analytics_purchase:${transactionId}).
 */
export function createFirestorePurchaseAnalyticsStore(): PurchaseAnalyticsIdempotencyStore {
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
