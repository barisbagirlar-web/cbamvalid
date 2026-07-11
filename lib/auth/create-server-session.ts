import type { User } from "firebase/auth";
import { signOut } from "firebase/auth";
import { firebaseAuth as auth } from "@/lib/firebase/client";

export async function createServerSession(user: User): Promise<void> {
  const idToken = await user.getIdToken(true);

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
      requestId?: string;
    } | null;

    const errMsg = payload?.error || `Session creation failed: ${response.status}`;
    console.error("[SESSION_CREATION_FAILED]", {
      status: response.status,
      error: payload?.error,
      requestId: payload?.requestId,
    });
    throw new Error(errMsg);
  }
}

export async function finalizeServerSession(user: User): Promise<void> {
  await createServerSession(user);
  window.location.assign("/dashboard");
}
