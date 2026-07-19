import { Environment, Paddle } from "@paddle/paddle-node-sdk";

let cachedClient: Paddle | null = null;

export function isSandboxMode(): boolean {
  const configured = process.env.PADDLE_ENVIRONMENT;
  if (configured === "sandbox") return true;
  if (configured === "production") return false;
  if (process.env.NODE_ENV === "production") throw new Error("PADDLE_ENVIRONMENT_MISSING");
  return true;
}

export function getPaddleClient(): Paddle {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.PADDLE_API_KEY;
  if (!apiKey) throw new Error("PADDLE_API_KEY_MISSING");
  const sandbox = isSandboxMode();
  if (sandbox && !apiKey.startsWith("pdl_sdbx_")) throw new Error("PADDLE_SANDBOX_API_KEY_INVALID");
  if (!sandbox && apiKey.startsWith("pdl_sdbx_")) throw new Error("PADDLE_PRODUCTION_API_KEY_INVALID");
  cachedClient = new Paddle(apiKey, {
    environment: sandbox ? Environment.sandbox : Environment.production,
  });
  return cachedClient;
}
