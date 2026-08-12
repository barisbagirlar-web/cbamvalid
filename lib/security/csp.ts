/**
 * Production CSP SSOT.
 * Nonce + strict-dynamic for scripts; style-src keeps 'unsafe-inline' for React
 * style attributes (nonce does not cover style=""). Emulator and Paddle sandbox
 * hosts are environment-gated and must not appear in production.
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

  const styleSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
    "https://cdn.paddle.com",
  ];
  if (input.paddleSandbox) {
    styleSrc.push("https://sandbox-cdn.paddle.com");
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
    `style-src ${styleSrc.join(" ")}`,
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
