import "server-only";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";

const isSandbox = process.env.NEXT_PUBLIC_PADDLE_SANDBOX === "true";
const apiKey = process.env.PADDLE_API_KEY || "";

if (!apiKey && process.env.NODE_ENV !== "development") {
  console.warn("PADDLE_API_KEY is not set. Paddle API calls will fail.");
}

export const paddleClient = new Paddle(apiKey, {
  environment: isSandbox ? Environment.sandbox : Environment.production,
});
