"use client";

import { firebaseAuth as auth } from "@/lib/firebase/client";

/**
 * Perform a fetch request attaching the user's Firebase ID token as a Bearer header.
 * Automatically retries once with a fresh token on 401.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No authenticated user found");
  }

  // Obtain cached ID token
  let token = await user.getIdToken();

  const getHeaders = (t: string) => {
    const headers = new Headers(init?.headers);
    headers.set("Authorization", `Bearer ${t}`);
    return headers;
  };

  let res = await fetch(input, {
    ...init,
    headers: getHeaders(token),
  });

  // Retry once with a force-refreshed token if unauthorized
  if (res.status === 401) {
    token = await user.getIdToken(true);
    res = await fetch(input, {
      ...init,
      headers: getHeaders(token),
    });
  }

  return res;
}
