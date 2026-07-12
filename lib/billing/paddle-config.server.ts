export interface PaddleConfig {
  isSandbox: boolean;
  apiKey: string;
  clientToken: string;
  priceId: string;
  webhookSecret: string;
}

export function getPaddleConfig(): PaddleConfig {
  const isSandbox = process.env.NEXT_PUBLIC_PADDLE_SANDBOX === "true";
  const apiKey = process.env.PADDLE_API_KEY || "";
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || "";
  const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID || "";
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET_KEY || process.env.PADDLE_WEBHOOK_SECRET || "";

  if (!apiKey || !clientToken || !priceId) {
    throw new Error("PADDLE_CONFIGURATION_ERROR: Missing required Paddle configuration variables.");
  }

  if (isSandbox) {
    if (apiKey && !apiKey.startsWith("pdl_sdbx_")) {
      console.warn("[PADDLE-CONFIG-WARNING]: NEXT_PUBLIC_PADDLE_SANDBOX is true but PADDLE_API_KEY does not start with pdl_sdbx_");
    }
  } else {
    if (apiKey && apiKey.startsWith("pdl_sdbx_")) {
      throw new Error("PADDLE_CONFIGURATION_ERROR: Sandbox API key cannot be used in production.");
    }
    if (clientToken && clientToken.startsWith("pdl_sdbx_apikey_")) {
      throw new Error("PADDLE_CONFIGURATION_ERROR: Sandbox client token cannot be used in production.");
    }
  }

  return {
    isSandbox,
    apiKey,
    clientToken,
    priceId,
    webhookSecret,
  };
}
