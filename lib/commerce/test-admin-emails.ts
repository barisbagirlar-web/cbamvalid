/**
 * Client-safe mirror of the owner-approved test-administrator allowlist.
 *
 * The authoritative allowlist lives in
 * `functions/src/commerce/test-admin-access.ts` (which provisions synthetic
 * entitlements server-side). This mirror is used by Next.js routes and client
 * pages so a test administrator is never blocked by the public-launch checkout
 * gate. KEEP ALIGNED with the functions copy.
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
