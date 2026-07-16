type CallableAuth = {
  uid: string;
  token: Record<string, unknown>;
};

export class VerifiedUserRequiredError extends Error {
  readonly code = "failed-precondition";

  constructor() {
    super("EMAIL_VERIFICATION_REQUIRED: Verify your email address before purchasing or sealing a report.");
    this.name = "VerifiedUserRequiredError";
  }
}

export function requireVerifiedUser(auth: CallableAuth): void {
  const email = typeof auth.token.email === "string" ? auth.token.email.trim() : "";
  if (!email || auth.token.email_verified !== true) {
    throw new VerifiedUserRequiredError();
  }
}
