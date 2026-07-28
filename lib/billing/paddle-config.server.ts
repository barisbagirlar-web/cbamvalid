export interface PaddleConfig {
  isSandbox: boolean;
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

export function getPaddleConfig(): PaddleConfig {
  const apiKey = process.env.PADDLE_API_KEY || "";
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "";
  const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "";
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET_KEY || process.env.PADDLE_WEBHOOK_SECRET || "";

  if (!apiKey || !clientToken || !priceId) {
    throw new Error("PADDLE_CONFIGURATION_ERROR: Missing required Paddle configuration variables.");
  }

  const keySandbox = detectSandboxFromApiKey(apiKey);
  const flagSandbox =
    process.env.NEXT_PUBLIC_PADDLE_SANDBOX === "true" ||
    process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox";
  // API key environment is authoritative when detectable — prevents sandbox key → live API 403.
  const isSandbox = keySandbox === null ? flagSandbox : keySandbox;

  if (keySandbox === true && process.env.NEXT_PUBLIC_PADDLE_SANDBOX === "false") {
    console.warn(
      "[PADDLE-CONFIG-WARNING]: Sandbox API key detected while NEXT_PUBLIC_PADDLE_SANDBOX=false. Using sandbox API."
    );
  }
  if (keySandbox === false && flagSandbox) {
    throw new Error("PADDLE_CONFIGURATION_ERROR: Live API key cannot be used with sandbox client configuration.");
  }
  if (isSandbox && clientToken && clientToken.startsWith("pdl_live_")) {
    throw new Error("PADDLE_CONFIGURATION_ERROR: Live client token cannot be used in sandbox mode.");
  }
  if (!isSandbox && clientToken.startsWith("pdl_sdbx_apikey_")) {
    throw new Error("PADDLE_CONFIGURATION_ERROR: Sandbox client token cannot be used in production.");
  }

  return {
    isSandbox,
    apiKey,
    clientToken,
    priceId,
    webhookSecret,
  };
}
