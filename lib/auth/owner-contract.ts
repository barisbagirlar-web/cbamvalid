import "server-only";

export const CANONICAL_OWNER_EMAIL = "barisbagirlar@gmail.com";

export function requireCanonicalOwnerClaims(
  claims: Record<string, unknown> & { uid: string },
  configuredOwnerUid = process.env.SUPER_ADMIN_UID
): void {
  const ownerUid = configuredOwnerUid?.trim();
  if (!ownerUid) throw new Error("SUPER_ADMIN_UID_NOT_CONFIGURED");

  if (
    claims.uid !== ownerUid ||
    claims.ownerUid !== ownerUid ||
    claims.email !== CANONICAL_OWNER_EMAIL ||
    claims.email_verified !== true ||
    claims.role !== "super_admin" ||
    claims.owner !== true
  ) {
    throw new Error("CANONICAL_OWNER_REQUIRED");
  }
}
