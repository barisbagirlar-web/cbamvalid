import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { createCallable } from "../wrapper";
import { adminAuth, adminDb } from "../firebase-admin";
import { getUserOrganisationId } from "../auth/organisation-access";

const AssignableReviewRoles = z.enum(["INTERNAL_REVIEWER", "DATA_OWNER"]);

/**
 * FAZ 13 — customer-organisation role assignment.
 *
 * Grants the customer organisation the authority to assign its own
 * Internal Reviewer / DATA_OWNER role to a member of the same organisation
 * (peer-to-peer in-org approval). Self-approval is preserved:
 *   - the caller must belong to an organisation;
 *   - the target must be a member of the SAME organisation;
 *   - the target can never be the caller themselves.
 * The target user's Firestore `role` is updated through the Admin SDK, so the
 * client-side Firestore rule that blocks self-editing `role` is not bypassed by
 * the end user directly — this callable is the only customer-facing path.
 */
export const assignOrganisationReviewer = createCallable(
  {
    schema: z.object({
      targetUserId: z.string().trim().min(1).max(128).optional(),
      targetEmail: z.string().trim().toLowerCase().email().optional(),
      role: AssignableReviewRoles,
    }),
  },
  async ({ targetUserId, targetEmail, role }, { auth }) => {
    const callerUid = auth.uid;

    if (targetUserId && targetEmail) {
      throw new HttpsError(
        "invalid-argument",
        "Provide either targetUserId or targetEmail, not both."
      );
    }

    let resolvedTargetUserId = targetUserId;
    if (targetEmail) {
      try {
        const userRecord = await adminAuth.getUserByEmail(targetEmail);
        resolvedTargetUserId = userRecord.uid;
      } catch {
        throw new HttpsError("not-found", "TARGET_USER_NOT_FOUND");
      }
    }
    if (!resolvedTargetUserId) {
      throw new HttpsError("invalid-argument", "TARGET_USER_OR_EMAIL_REQUIRED");
    }

    if (resolvedTargetUserId === callerUid) {
      throw new HttpsError(
        "permission-denied",
        "SELF_ROLE_ASSIGNMENT_FORBIDDEN"
      );
    }

    const callerOrganisationId = await getUserOrganisationId(callerUid);
    if (!callerOrganisationId) {
      throw new HttpsError(
        "failed-precondition",
        "CALLER_ORGANISATION_REQUIRED"
      );
    }

    const [targetUserSnap, callerUserSnap] = await Promise.all([
      adminDb.collection("users").doc(resolvedTargetUserId).get(),
      adminDb.collection("users").doc(callerUid).get(),
    ]);
    if (!targetUserSnap.exists) {
      throw new HttpsError("not-found", "TARGET_USER_NOT_FOUND");
    }

    const targetOrganisationId = getUserOrganisationIdFromSnapshot(targetUserSnap.data());
    if (targetOrganisationId !== callerOrganisationId) {
      throw new HttpsError(
        "permission-denied",
        "TARGET_NOT_IN_CALLER_ORGANISATION"
      );
    }

    const callerRole = String(callerUserSnap.exists ? callerUserSnap.data()?.role ?? "" : "").toUpperCase();
    if (!["INTERNAL_REVIEWER", "DATA_OWNER", "SUPER_ADMIN", "ADMIN"].includes(callerRole)) {
      throw new HttpsError(
        "permission-denied",
        "CALLER_REVIEWER_ROLE_REQUIRED"
      );
    }

    const now = new Date().toISOString();
    await adminDb.collection("users").doc(resolvedTargetUserId).set(
      {
        role,
        roleAssignedBy: callerUid,
        roleAssignedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    console.log("event=ORGANISATION_REVIEWER_ASSIGNED", {
      assignerUid: callerUid,
      targetUid: resolvedTargetUserId,
      role,
      organisationId: callerOrganisationId,
    });

    return { success: true };
  }
);

function getUserOrganisationIdFromSnapshot(
  data: FirebaseFirestore.DocumentData | undefined
): string | null {
  const value = data?.organisationId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
