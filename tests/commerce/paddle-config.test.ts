import { afterEach, describe, expect, it } from "vitest";
import { getPaddleConfig } from "../../lib/billing/paddle-config.server";

const KEYS = [
  "PADDLE_ENV",
  "PADDLE_API_KEY",
  "NEXT_PUBLIC_PADDLE_ENV",
  "NEXT_PUBLIC_PADDLE_SANDBOX",
  "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
  "NEXT_PUBLIC_PADDLE_PRICE_ID",
  "PADDLE_WEBHOOK_SECRET",
  "PADDLE_WEBHOOK_SECRET_KEY",
] as const;

const ORIGINAL = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

function setBaseSandbox() {
  process.env.PADDLE_ENV = "sandbox";
  process.env.NEXT_PUBLIC_PADDLE_ENV = "sandbox";
  process.env.NEXT_PUBLIC_PADDLE_SANDBOX = "true";
  process.env.PADDLE_API_KEY = "pdl_sdbx_apikey_example";
  process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "test_example";
  process.env.NEXT_PUBLIC_PADDLE_PRICE_ID = "pri_01sandboxexample";
  process.env.PADDLE_WEBHOOK_SECRET = "pdl_ntfset_example";
}

afterEach(() => {
  for (const key of KEYS) {
    const value = ORIGINAL[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Paddle environment boundary", () => {
  it("accepts a complete sandbox credential set", () => {
    setBaseSandbox();
    const config = getPaddleConfig();
    expect(config.environment).toBe("sandbox");
    expect(config.isSandbox).toBe(true);
    expect(config.apiBaseUrl).toBe("https://sandbox-api.paddle.com");
  });

  it("accepts a complete live credential set", () => {
    process.env.PADDLE_ENV = "production";
    process.env.NEXT_PUBLIC_PADDLE_ENV = "production";
    process.env.NEXT_PUBLIC_PADDLE_SANDBOX = "false";
    process.env.PADDLE_API_KEY = "pdl_live_apikey_example";
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "live_example";
    process.env.NEXT_PUBLIC_PADDLE_PRICE_ID = "pri_01liveexample";

    const config = getPaddleConfig();
    expect(config.environment).toBe("production");
    expect(config.isSandbox).toBe(false);
    expect(config.apiBaseUrl).toBe("https://api.paddle.com");
  });

  it("rejects mixed sandbox API and live client credentials", () => {
    setBaseSandbox();
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "live_example";
    expect(() => getPaddleConfig()).toThrow(/different Paddle environments/);
  });

  it("rejects environment flags that disagree with credentials", () => {
    setBaseSandbox();
    process.env.PADDLE_ENV = "production";
    expect(() => getPaddleConfig()).toThrow(/flags do not match/);
  });

  it("rejects malformed client tokens and price IDs", () => {
    setBaseSandbox();
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "pdl_sdbx_apikey_wrong_kind";
    expect(() => getPaddleConfig()).toThrow(/Client token must start/);

    setBaseSandbox();
    process.env.NEXT_PUBLIC_PADDLE_PRICE_ID = "price_wrong";
    expect(() => getPaddleConfig()).toThrow(/must start with pri_/);
  });
});
