import crypto from "node:crypto";
import admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { writeLedgerEntry } from "./ledger-service";
import { validateIdentifier } from "../firestore-validator";

/**
 * Owner-approved test-administrator allowlist.
 *
 * These accounts may exercise the full pay-at-lock flow without a real Paddle
 * payment or a credit balance, for controlled end-to-end testing only.
 * Fail-closed: exact verified email + explicit allowlist membership required;
 * every provisioned test entitlement is ledgered and marked syntheticTest.
 *
 * KEEP ALIGNED with `lib/commerce/test-admin-emails.ts` (client-safe mirror used
 * by Next.js routes/pages so test administrators are never blocked at checkout).
 */
export const TEST_ADMIN_EMAILS = Object.freeze([
  "barisbagirlar@gmail.com",
  "teb232@gmail.com",
]);

export function isTestAdminEmail(email: unknown): boolean {
  return (
    typeof email === "string" &&
    TEST_ADMIN_EMAILS.includes(email.trim().toLowerCase())
  );
}

export function isTestAdmin(
  token: Record<string, unknown> | undefined | null
): boolean {
  if (!token) return false;
  if (token.email_verified !== true) return false;
  return isTestAdminEmail(token.email);
}

/**
 * Effectively unlimited reseal capacity for controlled test administrators.
 * Kept as an explicit ceiling (not marketed) so the reserve/consume gates never
 * exhaust a test admin; UIs show "Unlimited" for syntheticTest entitlements.
 */
export const TEST_ADMIN_MAX_RELEASES = Number.MAX_SAFE_INTEGER;

export async function ensureTestAdminEntitlement(
  transaction: admin.firestore.Transaction,
  uid: string,
  email: string
): Promise<{ entitlementId: string; releasesRemaining: number; maxReleases: number }> {
  validateIdentifier("uid", uid);
  const digest = crypto
    .createHash("sha256")
    .update(`test-admin:${uid}`)
    .digest("hex")
    .slice(0, 40);
  const entitlementId = `ent_test_${digest}`;
  const maxReleases = TEST_ADMIN_MAX_RELEASES;
  const ref = adminDb.collection("entitlements").doc(entitlementId);

  const snapshot = await transaction.get(ref);
  if (snapshot.exists) {
    const data = (snapshot.data() || {}) as {
      releasesCount?: number;
      maxReleases?: number;
      status?: string;
    };
    const status = String(data.status || "AVAILABLE").toUpperCase();
    const needsRevive = status === "REVOKED" || status === "CONSUMED";
    const effectiveMax = Number(data.maxReleases || 0) < maxReleases ? maxReleases : Number(data.maxReleases || maxReleases);
    const effectiveCount = needsRevive ? 0 : Number(data.releasesCount || 0);

    if (needsRevive || effectiveMax !== Number(data.maxReleases || maxReleases)) {
      transaction.update(ref, {
        ...(needsRevive
          ? {
              status: "AVAILABLE",
              releasesCount: 0,
              releasesList: [],
            }
          : {}),
        ...(effectiveMax !== Number(data.maxReleases || maxReleases)
          ? { maxReleases: effectiveMax }
          : {}),
        updatedAt: new Date().toISOString(),
      });
    }

    return {
      entitlementId,
      releasesRemaining: Math.max(0, effectiveMax - effectiveCount),
      maxReleases: effectiveMax,
    };
  }

  const now = new Date().toISOString();
  const orderId = `TEST_ADMIN_${uid}`;
  await writeLedgerEntry(transaction, {
    uid,
    orderId,
    transactionId: orderId,
    eventId: `test_admin_provision_${digest}`,
    type: "ENTITLEMENT_ISSUED",
    quantity: 1,
    idempotencyKey: `entitlement:${orderId}:test_admin`,
    syntheticTest: true,
    environment: "sandbox",
  });
  transaction.set(ref, {
    entitlementId,
    uid,
    orderId,
    productCode: "pack_premium_dossier_v5",
    status: "AVAILABLE",
    quantity: 1,
    maxReleases,
    releasesCount: 0,
    releasesList: [],
    createdAt: now,
    updatedAt: now,
    billingModel: "TEST_ADMIN_BYPASS",
    syntheticTest: true,
    environment: "sandbox",
    provisionedForEmail: email,
  });

  return { entitlementId, releasesRemaining: maxReleases, maxReleases };
}
