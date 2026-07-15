import { User } from "firebase/auth";

export async function finalizeServerSession(user: User): Promise<void> {
  const idToken = await user.getIdToken(true);
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ idToken }),
  });
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || "Failed to finalize server session.");
  }

  if (typeof window !== "undefined") {
    (window as any).__sessionEstablished = true;
  }
}
