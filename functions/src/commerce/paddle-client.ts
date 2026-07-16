import { Paddle, Environment } from "@paddle/paddle-node-sdk";

const apiKey = process.env.PADDLE_API_KEY?.trim() || "";
const configuredEnvironment = process.env.PADDLE_ENV?.trim().toLowerCase();
const sandbox = configuredEnvironment
  ? configuredEnvironment === "sandbox"
  : process.env.NEXT_PUBLIC_PADDLE_SANDBOX === "true" || process.env.NODE_ENV !== "production";

export const paddle = new Paddle(apiKey || "unconfigured", {
  environment: sandbox ? Environment.sandbox : Environment.production,
});

export function isSandboxMode(): boolean {
  return sandbox;
}

export function assertPaddleConfigured(): void {
  if (!apiKey) throw new Error("PADDLE_API_KEY_MISSING");
  if (sandbox && !apiKey.startsWith("pdl_sdbx_")) {
    throw new Error("PADDLE_SANDBOX_KEY_MISMATCH");
  }
  if (!sandbox && apiKey.startsWith("pdl_sdbx_")) {
    throw new Error("PADDLE_PRODUCTION_KEY_MISMATCH");
  }
}
