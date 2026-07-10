export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-cbam_session"
    : "cbam_session_dev";

function readPositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number(value ?? fallback);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("AUTH_SESSION_TTL_INVALID");
  }

  return parsed;
}

export const SESSION_TTL_SECONDS =
  readPositiveInteger(
    process.env.AUTH_SESSION_TTL_SECONDS,
    432000
  );

if (
  SESSION_TTL_SECONDS < 300 ||
  SESSION_TTL_SECONDS > 1_209_600
) {
  throw new Error("AUTH_SESSION_TTL_OUT_OF_RANGE");
}

export const SESSION_MAX_AUTH_AGE_SECONDS =
  readPositiveInteger(
    process.env.AUTH_SESSION_MAX_AUTH_AGE_SECONDS,
    300
  );

export function sessionCookieOptions(
  maxAge = SESSION_TTL_SECONDS
) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    priority: "high" as const,
  };
}

export function expiredSessionCookieOptions() {
  return {
    ...sessionCookieOptions(0),
    expires: new Date(0),
  };
}
