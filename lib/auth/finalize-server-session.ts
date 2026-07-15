import type { User } from "firebase/auth";

const SESSION_MARKER = "cbamvalid:server-session-established";

export function clearServerSessionMarker(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_MARKER);
}

export function hasServerSessionMarker(): boolean {
  return typeof window !== "undefined" && sessionStorage.getItem(SESSION_MARKER) === "true";
}

export async function finalizeServerSession(user: User): Promise<void> {
  const idToken = await user.getIdToken(true);
  const response = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const message = payload && typeof payload === "object"
      ? (payload as { error?: { message?: unknown } }).error?.message
      : undefined;
    throw new Error(typeof message === "string" ? message : "Failed to finalize server session.");
  }
  if (typeof window !== "undefined") sessionStorage.setItem(SESSION_MARKER, "true");
}
