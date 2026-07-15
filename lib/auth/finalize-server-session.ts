import type { User } from "firebase/auth";

const SESSION_MARKER = "cbamvalid:server-session-established";

export function clearServerSessionMarker(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_MARKER);
}

export function hasServerSessionMarker(): boolean {
  return typeof window !== "undefined" && sessionStorage.getItem(SESSION_MARKER) === "true";
}

function markServerSession(): void {
  if (typeof window !== "undefined") sessionStorage.setItem(SESSION_MARKER, "true");
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
  markServerSession();
}

export async function ensureServerSession(user: User): Promise<void> {
  if (hasServerSessionMarker()) return;
  const statusResponse = await fetch("/api/auth/session", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (statusResponse.ok) {
    const payload: unknown = await statusResponse.json().catch(() => null);
    const uid = payload && typeof payload === "object"
      ? (payload as { data?: { uid?: unknown } }).data?.uid
      : undefined;
    if (uid === user.uid) {
      markServerSession();
      return;
    }
  }
  await finalizeServerSession(user);
}
