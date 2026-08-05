import { Paddle, Environment } from "@paddle/paddle-node-sdk";

const apiKey = process.env.PADDLE_API_KEY || "";

/**
 * Environment selection must never fall back to sandbox in production.
 * The credential prefix (pdl_live_ / pdl_sdbx_) is the source of truth, and
 * explicit environment flags may only narrow it — never override a live key.
 */
function resolveEnvironment(): Environment {
  if (apiKey.startsWith("pdl_sdbx_")) {
    return Environment.sandbox;
  }
  if (apiKey.startsWith("pdl_live_")) {
    return Environment.production;
  }
  // No credential prefix (unset/invalid): defer to explicit flags, defaulting
  // to production so a missing config cannot silently route to the sandbox API.
  if (
    process.env.NEXT_PUBLIC_PADDLE_SANDBOX === "true" ||
    String(process.env.NEXT_PUBLIC_PADDLE_ENV || "").trim().toLowerCase() === "sandbox"
  ) {
    return Environment.sandbox;
  }
  return Environment.production;
}

if (!apiKey) {
  console.warn("[PADDLE] Warning: PADDLE_API_KEY environment variable is not defined.");
}

const environment = resolveEnvironment();
const isSandbox = environment === Environment.sandbox;

export const paddle = new Paddle(apiKey, {
  environment,
});

export function isSandboxMode(): boolean {
  return isSandbox;
}
