const INVALID_SESSION_CODES = new Set([
  "auth/session-cookie-expired",
  "auth/session-cookie-revoked",
  "auth/invalid-session-cookie",
  "auth/invalid-id-token",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/argument-error",
  "auth/invalid-argument",
]);

const INVALID_ID_TOKEN_CODES = new Set([
  "auth/invalid-id-token",
  "auth/id-token-expired",
  "auth/id-token-revoked",
  "auth/argument-error",
  "auth/invalid-argument",
  "auth/user-disabled",
  "auth/user-not-found",
]);

export function getFirebaseErrorCode(
  error: unknown
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }

  return "unknown";
}

export function isInvalidSessionError(
  error: unknown
): boolean {
  return INVALID_SESSION_CODES.has(
    getFirebaseErrorCode(error)
  );
}

export function isInvalidIdTokenError(
  error: unknown
): boolean {
  return INVALID_ID_TOKEN_CODES.has(
    getFirebaseErrorCode(error)
  );
}

export class AuthServiceUnavailableError extends Error {
  constructor(
    message = "AUTH_SERVICE_UNAVAILABLE"
  ) {
    super(message);
    this.name = "AuthServiceUnavailableError";
  }
}
