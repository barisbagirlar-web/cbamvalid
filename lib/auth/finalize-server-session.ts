import type { User } from "firebase/auth";
import { CSRF_HEADER_NAME } from "./session-constants";

/**
 * Validates, registers and synchronizes the client session with the server.
 * Uses a 15-second abort timeout and strictly redirects only after getSession confirmation.
 */
export async function finalizeServerSession(user: User): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    // 1. Retrieve the client ID token from Firebase
    const idToken = await user.getIdToken(true);

    // 2. Retrieve a CSRF token from the server
    const csrfRes = await fetch("/api/auth/csrf", {
      method: "GET",
      credentials: "same-origin",
      signal: controller.signal,
    });

    if (!csrfRes.ok) {
      throw new Error(`CSRF token retrieval failed with status: ${csrfRes.status}`);
    }

    const { csrfToken } = await csrfRes.json();
    if (!csrfToken || typeof csrfToken !== "string") {
      throw new Error("Invalid CSRF token payload received");
    }

    // 3. Post the ID token with CSRF token to establish session cookie
    const sessionPostRes = await fetch("/api/auth/session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [CSRF_HEADER_NAME]: csrfToken,
      },
      credentials: "same-origin",
      body: JSON.stringify({ idToken }),
      signal: controller.signal,
    });

    if (!sessionPostRes.ok) {
      const errorPayload = await sessionPostRes.json().catch(() => null);
      throw new Error(errorPayload?.error || `Session creation failed with status: ${sessionPostRes.status}`);
    }

    // 4. Verify the session state before navigating
    const sessionGetRes = await fetch("/api/auth/session", {
      method: "GET",
      credentials: "same-origin",
      signal: controller.signal,
    });

    if (!sessionGetRes.ok) {
      throw new Error(`Session verification failed with status: ${sessionGetRes.status}`);
    }

    const verification = await sessionGetRes.json();
    if (verification.authenticated !== true) {
      throw new Error("Session registration could not be verified by server");
    }

    clearTimeout(timeoutId);

    // 5. Success: navigate to protected zone
    window.location.replace("/dashboard");
  } catch (error) {
    clearTimeout(timeoutId);
    const err = error as Error;
    if (err.name === "AbortError") {
      throw new Error("Session registration timed out. Please check your connection and try again.");
    }
    throw error;
  }
}
