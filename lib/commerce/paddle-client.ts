import { Paddle, Environment } from "@paddle/paddle-node-sdk";

const apiKey = process.env.PADDLE_API_KEY || "";
const isSandbox = process.env.NEXT_PUBLIC_PADDLE_SANDBOX === "true" || process.env.NODE_ENV !== "production";

if (!apiKey) {
  console.warn("[PADDLE] Warning: PADDLE_API_KEY environment variable is not defined.");
}

export const paddle = new Paddle(apiKey, {
  environment: isSandbox ? Environment.sandbox : Environment.production,
});

export function isSandboxMode(): boolean {
  return isSandbox;
}
