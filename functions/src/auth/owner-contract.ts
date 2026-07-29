import { HttpsError } from "firebase-functions/v2/https";

export const CANONICAL_OWNER_EMAIL = "barisbagirlar@gmail.com";

export type OwnerAuth = {
  uid: string;
  token: Record<string, unknown>;
};

export function isCanonicalOwner(
  auth: OwnerAuth,
  configuredOwnerUid = process.env.SUPER_ADMIN_UID?.trim()
): boolean {
  return Boolean(
    configuredOwnerUid &&
    auth.uid === configuredOwnerUid &&
    auth.token.ownerUid === configuredOwnerUid &&
    auth.token.email === CANONICAL_OWNER_EMAIL &&
    auth.token.email_verified === true &&
    auth.token.role === "super_admin" &&
    auth.token.owner === true
  );
}

export function requireCanonicalOwner(auth: OwnerAuth): void {
  const configuredOwnerUid = process.env.SUPER_ADMIN_UID?.trim();
  if (!configuredOwnerUid) {
    throw new HttpsError(
      "failed-precondition",
      "Canonical owner identity is not configured."
    );
  }

  if (!isCanonicalOwner(auth, configuredOwnerUid)) {
    throw new HttpsError(
      "permission-denied",
      "Canonical owner authorization is required."
    );
  }
}
