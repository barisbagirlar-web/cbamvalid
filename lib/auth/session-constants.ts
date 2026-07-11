export const SESSION_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-cbam_session"
    : "cbam_session_dev";

export const CSRF_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Host-cbam_csrf"
    : "cbam_csrf_dev";
export const CSRF_HEADER_NAME = "X-CSRF-Token";
export const SESSION_DURATION_SECONDS = 432000; // 5 days
