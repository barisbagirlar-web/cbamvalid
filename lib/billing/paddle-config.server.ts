export type PaddleEnvironment = "sandbox" | "production";

export interface PaddleConfig {
  environment: PaddleEnvironment;
  isSandbox: boolean;
  apiBaseUrl: "https://sandbox-api.paddle.com" | "https://api.paddle.com";
  apiKey: string;
  clientToken: string;
  priceId: string;
  webhookSecret: string;
}

function detectSandboxFromApiKey(apiKey: string): boolean | null {
  if (apiKey.startsWith("pdl_sdbx_")) return true;
  if (apiKey.startsWith("pdl_live_")) return false;
  return null;
}

function detectSandboxFromClientToken(clientToken: string): boolean | null {
  if (clientToken.startsWith("test_")) return true;
  if (clientToken.startsWith("live_")) return false;
  return null;
}

function parseEnvironmentFlag(value: string | undefined): PaddleEnvironment | null {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "sandbox") return "sandbox";
  if (normalized === "production" || normalized === "live") return "production";
  throw new Error(
    "PADDLE_CONFIGURATION_ERROR: Paddle environment must be sandbox or production."
  );
}

export function getPaddleConfig(): PaddleConfig {
  const apiKey = String(process.env.PADDLE_API_KEY || "").trim();
  const clientToken = String(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "").trim();
  const priceId = String(process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "").trim();
  const webhookSecret = String(
    process.env.PADDLE_WEBHOOK_SECRET_KEY || process.env.PADDLE_WEBHOOK_SECRET || ""
  ).trim();

  if (!apiKey || !clientToken || !priceId) {
    throw new Error(
      "PADDLE_CONFIGURATION_ERROR: Missing PADDLE_API_KEY, NEXT_PUBLIC_PADDLE_CLIENT_TOKEN, or NEXT_PUBLIC_PADDLE_PRICE_ID."
    );
  }
  if (!priceId.startsWith("pri_")) {
    throw new Error("PADDLE_CONFIGURATION_ERROR: Paddle price ID must start with pri_.");
  }

  const keySandbox = detectSandboxFromApiKey(apiKey);
  if (keySandbox === null) {
    throw new Error(
      "PADDLE_CONFIGURATION_ERROR: API key must be a pdl_sdbx_ or pdl_live_ credential."
    );
  }

  const tokenSandbox = detectSandboxFromClientToken(clientToken);
  if (tokenSandbox === null) {
    throw new Error(
      "PADDLE_CONFIGURATION_ERROR: Client token must start with test_ or live_."
    );
  }
  if (keySandbox !== tokenSandbox) {
    throw new Error(
      "PADDLE_CONFIGURATION_ERROR: API key and client token belong to different Paddle environments."
    );
  }

  const serverEnvironment = parseEnvironmentFlag(process.env.PADDLE_ENV);
  const publicEnvironment = parseEnvironmentFlag(process.env.NEXT_PUBLIC_PADDLE_ENV);
  const legacySandboxFlag = String(process.env.NEXT_PUBLIC_PADDLE_SANDBOX || "").trim();
  const legacyEnvironment: PaddleEnvironment | null =
    legacySandboxFlag === "true"
      ? "sandbox"
      : legacySandboxFlag === "false"
        ? "production"
        : null;
  const credentialEnvironment: PaddleEnvironment = keySandbox ? "sandbox" : "production";

  for (const configuredEnvironment of [
    serverEnvironment,
    publicEnvironment,
    legacyEnvironment,
  ]) {
    if (configuredEnvironment && configuredEnvironment !== credentialEnvironment) {
      throw new Error(
        "PADDLE_CONFIGURATION_ERROR: Paddle environment flags do not match the supplied credentials."
      );
    }
  }

  return {
    environment: credentialEnvironment,
    isSandbox: keySandbox,
    apiBaseUrl: keySandbox
      ? "https://sandbox-api.paddle.com"
      : "https://api.paddle.com",
    apiKey,
    clientToken,
    priceId,
    webhookSecret,
  };
}
