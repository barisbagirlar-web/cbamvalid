/**
 * Production CSP SSOT.
 * Scripts: nonce + strict-dynamic (no unsafe-inline / unsafe-eval in production).
 * Styles: framework/public surfaces currently emit inline <style> blocks and React
 * style="" attributes, so element/attribute allowances are explicit and isolated.
 * Do not mix a style nonce with 'unsafe-inline': CSP3 browsers ignore the inline
 * allowance when a nonce/hash is present in the same directive.
 * Emulator hosts and Paddle sandbox CDN are environment-gated only.
 */

export type CspBuildInput = {
  nonce: string;
  isDevelopment: boolean;
  allowFirebaseEmulator: boolean;
  paddleSandbox: boolean;
};

export function isPaddleSandboxEnvironment(
  paddleEnv: string | undefined = process.env.PADDLE_ENV,
  publicPaddleEnv: string | undefined = process.env.NEXT_PUBLIC_PADDLE_ENV,
): boolean {
  const server = String(paddleEnv || "")
    .trim()
    .toLowerCase();
  const pub = String(publicPaddleEnv || "")
    .trim()
    .toLowerCase();
  return server === "sandbox" || pub === "sandbox";
}

export function buildContentSecurityPolicy(input: CspBuildInput): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${input.nonce}'`,
    "'strict-dynamic'",
    "https://apis.google.com",
    "https://www.gstatic.com",
    "https://www.google.com",
    "https://www.googletagmanager.com",
    "https://paddle.com",
    "https://cdn.paddle.com",
    "https://public.profitwell.com",
  ];
  if (input.paddleSandbox) {
    scriptSrc.push("https://sandbox-cdn.paddle.com");
  }
  if (input.isDevelopment) {
    scriptSrc.push("'unsafe-eval'");
  }

  const styleOrigins = [
    "'self'",
    "https://fonts.googleapis.com",
    "https://cdn.paddle.com",
  ];
  if (input.paddleSandbox) {
    styleOrigins.push("https://sandbox-cdn.paddle.com");
  }

  const connectSrc = [
    "'self'",
    "https://*.googleapis.com",
    "https://*.firebaseio.com",
    "https://*.paddle.com",
    "https://*.profitwell.com",
    "https://*.cloudfunctions.net",
    "https://www.google-analytics.com",
    "https://www.googletagmanager.com",
  ];
  if (input.allowFirebaseEmulator) {
    connectSrc.push("http://127.0.0.1:5001", "http://localhost:5001");
  }

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    `style-src ${styleOrigins.join(" ")}`,
    `style-src-elem ${[...styleOrigins, "'unsafe-inline'"].join(" ")}`,
    "style-src-attr 'unsafe-inline'",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src ${connectSrc.join(" ")}`,
    "img-src 'self' data: blob: https:",
    "frame-src 'self' https://*.paddle.com https://*.firebaseapp.com https://www.google.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function createRequestCspNonce(): string {
  return Buffer.from(crypto.randomUUID()).toString("base64");
}
