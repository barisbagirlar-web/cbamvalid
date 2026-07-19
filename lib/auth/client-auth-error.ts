export function firebaseAuthErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

export function firebaseAuthErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

export function googleSignInMessage(error: unknown): string {
  const code = firebaseAuthErrorCode(error);
  const messages: Record<string, string> = {
    "auth/popup-blocked": "Sign-in popup was blocked. Enable popups for this site and retry.",
    "auth/popup-closed-by-user": "Sign-in popup was closed before completion.",
    "auth/cancelled-popup-request": "The previous sign-in request was cancelled.",
    "auth/account-exists-with-different-credential": "This email already uses a different sign-in method.",
    "auth/unauthorized-domain": "This domain is not authorized for Google sign-in.",
  };
  return messages[code] || firebaseAuthErrorMessage(error, "Unable to start Google sign-in.");
}
