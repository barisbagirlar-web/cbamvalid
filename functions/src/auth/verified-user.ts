import { HttpsError } from "firebase-functions/v2/https";

type CallableAuth = {
  uid: string;
  token: Record<string, unknown>;
};

export function requireVerifiedUser(auth: CallableAuth): void {
  const email = typeof auth.token.email === "string" ? auth.token.email.trim() : "";
  if (!email || auth.token.email_verified !== true) {
    throw new HttpsError(
      "failed-precondition",
      "EMAIL_VERIFICATION_REQUIRED: Verify your email address before purchasing or sealing a report."
    );
  }
}
