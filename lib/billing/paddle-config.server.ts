import "server-only";

export interface PaddleConfig {
  environment: "sandbox" | "production";
  apiKey: string;
  clientToken: string;
  serverPriceId: string;
  webhookSecret: string;
  expectedWebhookUrl: string;
  configuredWebhookUrl: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim() || "";
  if (!value) throw new Error(`PADDLE_CONFIGURATION_ERROR:${name}_MISSING`);
  return value;
}

export function getPaddleConfig(): PaddleConfig {
  const environment = process.env.PADDLE_ENV?.trim().toLowerCase() === "production" ||
    process.env.NEXT_PUBLIC_PADDLE_SANDBOX !== "true" && process.env.NODE_ENV === "production"
    ? "production"
    : "sandbox";
  const apiKey = required("PADDLE_API_KEY");
  const clientToken = required("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
  const serverPriceId = required(
    environment === "production" ? "PADDLE_PRICE_ID_PRODUCTION" : "PADDLE_PRICE_ID_SANDBOX"
  );
  const webhookSecret = (
    process.env.PADDLE_WEBHOOK_SECRET?.trim() ||
    process.env.PADDLE_WEBHOOK_SECRET_KEY?.trim() ||
    ""
  );
  if (!webhookSecret) throw new Error("PADDLE_CONFIGURATION_ERROR:PADDLE_WEBHOOK_SECRET_MISSING");
  if (!/^pri_[A-Za-z0-9]+$/.test(serverPriceId)) {
    throw new Error("PADDLE_CONFIGURATION_ERROR:PRICE_ID_FORMAT_INVALID");
  }
  if (environment === "sandbox" && !apiKey.startsWith("pdl_sdbx_")) {
    throw new Error("PADDLE_CONFIGURATION_ERROR:SANDBOX_API_KEY_MISMATCH");
  }
  if (environment === "production" && apiKey.startsWith("pdl_sdbx_")) {
    throw new Error("PADDLE_CONFIGURATION_ERROR:PRODUCTION_API_KEY_MISMATCH");
  }

  const projectId = process.env.GCLOUD_PROJECT?.trim() || "cbam-desk";
  const expectedWebhookUrl = `https://europe-west1-${projectId}.cloudfunctions.net/paddleWebhook`;
  const configuredWebhookUrl = process.env.PADDLE_WEBHOOK_URL?.trim() || "";
  if (configuredWebhookUrl && configuredWebhookUrl !== expectedWebhookUrl) {
    throw new Error("PADDLE_CONFIGURATION_ERROR:WEBHOOK_URL_MISMATCH");
  }

  return {
    environment,
    apiKey,
    clientToken,
    serverPriceId,
    webhookSecret,
    expectedWebhookUrl,
    configuredWebhookUrl,
  };
}
