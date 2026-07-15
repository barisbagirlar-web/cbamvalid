import { HttpsError } from "firebase-functions/v2/https";

type CallableAuth = {
  uid: string;
  token: Record<string, unknown>;
};

export function isOwnerSuperAdmin(auth: CallableAuth): boolean {
  const expectedUid = process.env.OWNER_ADMIN_UID?.trim() || "";
  const expectedEmail = process.env.OWNER_ADMIN_EMAIL?.trim().toLowerCase() || "";
  const email = typeof auth.token.email === "string" ? auth.token.email.toLowerCase() : "";
  return Boolean(
    expectedUid &&
    expectedEmail &&
    auth.uid === expectedUid &&
    email === expectedEmail &&
    auth.token.email_verified === true &&
    auth.token.role === "super_admin" &&
    auth.token.owner === true
  );
}

export function requireOwnerSuperAdmin(auth: CallableAuth): void {
  if (!isOwnerSuperAdmin(auth)) {
    throw new HttpsError("permission-denied", "Requires exact owner super-admin privileges.");
  }
}
