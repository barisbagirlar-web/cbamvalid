/**
 * Sandbox environment detection.
 *
 * The hosted QA sandbox is a separate Firebase project (cbam-desk-sandbox)
 * deployed with APP_ENV=sandbox. Production (cbam-desk) never sets this flag,
 * so every sandbox-only surface (QA index, synthetic badge) must gate on
 * `isSandboxApp()` and return 404 / render nothing in production.
 */
export function isSandboxApp(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "sandbox";
}

export const SANDBOX_BADGE_LABEL = "QA SANDBOX — SYNTHETIC DATA — NOT FOR SUBMISSION";
