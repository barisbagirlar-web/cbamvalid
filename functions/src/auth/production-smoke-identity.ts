/**
 * Narrowly scoped production-smoke identity.
 *
 * MUST NOT grant requireAdmin / ownerAdmin capabilities.
 * Authorization is exact UID allowlist from server config (Secret Manager /
 * Firestore system/config.smokeTestUid) plus short-lived custom claim
 * smokeTestAllowed === true. Caller-controlled flags are ignored.
 */

import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";

export type AuthPrincipal = {
  uid: string;
  token: Record<string, unknown>;
};

/**
 * True only when UID matches server allowlist AND token carries smokeTestAllowed.
 * Does not imply admin.
 */
export async function isProductionSmokeIdentity(auth: AuthPrincipal): Promise<boolean> {
  console.log("[DEBUG ISPRODSMOKE] auth.uid:", auth.uid);
  console.log("[DEBUG ISPRODSMOKE] token claims:", JSON.stringify(auth.token));
  const claimAllowed = auth.token.smokeTestAllowed === true;
  console.log("[DEBUG ISPRODSMOKE] claimAllowed:", claimAllowed);
  if (!claimAllowed) return false;

  const configDoc = await adminDb.collection("system").doc("config").get();
  const allowedUid = configDoc.exists ? configDoc.data()?.smokeTestUid : null;
  console.log("[DEBUG ISPRODSMOKE] allowedUid:", allowedUid);
  if (typeof allowedUid !== "string" || allowedUid.length < 8) return false;
  return auth.uid === allowedUid;
}

/**
 * Assert production-smoke identity for smoke-scoped callables only.
 * Never use this as a substitute for requireAdmin.
 */
export async function assertProductionSmokeIdentity(auth: AuthPrincipal): Promise<void> {
  if (await isProductionSmokeIdentity(auth)) return;
  throw new HttpsError("permission-denied", "Requires production-smoke identity.");
}
