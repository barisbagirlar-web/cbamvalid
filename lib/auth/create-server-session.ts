"use client";

import type { User } from "firebase/auth";

let activeSessionRequest: Promise<void> | null = null;

async function executeSessionRequest(
  user: User
): Promise<void> {
  const idToken = await user.getIdToken(true);

  const response = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idToken,
    }),
  });

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => null)) as
      | {
          error?: string;
          requestId?: string;
        }
      | null;

    throw new Error(
      payload?.error ?? "AUTH_SESSION_CREATE_FAILED"
    );
  }
}

export function createServerSession(
  user: User
): Promise<void> {
  if (!activeSessionRequest) {
    activeSessionRequest = executeSessionRequest(user)
      .finally(() => {
        activeSessionRequest = null;
      });
  }

  return activeSessionRequest;
}
