/**
 * FAZ 13 — customer-organisation review access.
 *
 * A customer organisation may self-assign an Internal Reviewer / DATA_OWNER
 * from within the same organisation (peer-to-peer in-org approval). This keeps
 * the USD 449 product self-service: the seal flow no longer requires CBAMValid
 * personnel to approve evidence, accept methodology decisions or clear scans.
 *
 * Security model:
 *   - Self-approval stays forbidden: a case owner can never approve their own
 *     evidence or accept their own methodology decision.
 *   - Approval requires the actor to be a member of the same organisation as
 *     the case owner AND hold an internal-review role.
 *   - Admin / ownerAdmin / production-smoke identities remain unaffected.
 */

import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "../firebase-admin";
import { isProductionSmokeIdentity } from "./production-smoke-identity";

export const INTERNAL_REVIEW_ROLES = [
  "INTERNAL_REVIEWER",
  "DATA_OWNER",
  "SUPER_ADMIN",
] as const;

export async function getUserOrganisationId(uid: string): Promise<string | null> {
  const doc = await adminDb.collection("users").doc(uid).get();
  const value = doc.exists ? doc.data()?.organisationId : null;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function getUserRole(uid: string): Promise<string> {
  const doc = await adminDb.collection("users").doc(uid).get();
  return String(doc.exists ? doc.data()?.role ?? "" : "").toUpperCase();
}

function isAdminToken(auth: { uid: string; token: Record<string, unknown> }): boolean {
  return auth.token.admin === true || auth.token.ownerAdmin === true;
}

/**
 * True when the actor is a member of the same organisation as the target user.
 * A null organisationId on either side never matches.
 */
export async function isSameOrganisation(
  actorUid: string,
  targetUid: string
): Promise<boolean> {
  if (actorUid === targetUid) return true;
  const [actorOrg, targetOrg] = await Promise.all([
    getUserOrganisationId(actorUid),
    getUserOrganisationId(targetUid),
  ]);
  return Boolean(actorOrg && targetOrg && actorOrg === targetOrg);
}

/**
 * Assert the caller may review evidence / accept methodology on a case owned by
 * `caseOwnerUid`. Self-approval is blocked; only a peer reviewer from the same
 * organisation (or admin / production-smoke identity) passes.
 */
export async function requireOrganisationReviewerAccess(
  auth: { uid: string; token: Record<string, unknown> },
  caseOwnerUid: string
): Promise<void> {
  if (isAdminToken(auth)) return;
  if (await isProductionSmokeIdentity(auth)) return;

  if (auth.uid === caseOwnerUid) {
    throw new HttpsError("permission-denied", "EVIDENCE_SELF_APPROVAL_FORBIDDEN");
  }

  const role = await getUserRole(auth.uid);
  if (!(INTERNAL_REVIEW_ROLES as readonly string[]).includes(role)) {
    throw new HttpsError("permission-denied", "ORGANISATION_REVIEWER_ROLE_REQUIRED");
  }

  if (!(await isSameOrganisation(auth.uid, caseOwnerUid))) {
    throw new HttpsError("permission-denied", "CROSS_ORGANISATION_ACCESS_FORBIDDEN");
  }
}

/**
 * Assert the caller may view a case owned by `caseOwnerUid` (own case or a
 * peer case within the same organisation while holding an internal-review role).
 */
export async function requireOrganisationCaseReadAccess(
  auth: { uid: string; token: Record<string, unknown> },
  caseOwnerUid: string
): Promise<void> {
  if (isAdminToken(auth)) return;
  if (auth.uid === caseOwnerUid) return;

  const role = await getUserRole(auth.uid);
  if (!(INTERNAL_REVIEW_ROLES as readonly string[]).includes(role)) {
    throw new HttpsError("permission-denied", "CASE_ACCESS_FORBIDDEN");
  }

  if (!(await isSameOrganisation(auth.uid, caseOwnerUid))) {
    throw new HttpsError("permission-denied", "CROSS_ORGANISATION_ACCESS_FORBIDDEN");
  }
}
