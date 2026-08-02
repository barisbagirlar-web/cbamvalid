import fs from "fs";
import path from "path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

import { getPaddleConfig } from "../lib/billing/paddle-config.server";
import { CREDIT_PACKAGES } from "../lib/billing/catalog";

const requireWebhook = process.argv.includes("--require-webhook");

try {
  const config = getPaddleConfig();

  console.log(`PADDLE_ENV=${config.environment}`);
  console.log(`PADDLE_API_BASE=${config.apiBaseUrl}`);
  console.log("PADDLE_API_KEY=CONFIGURED");
  console.log("PADDLE_CLIENT_TOKEN=CONFIGURED");
  console.log("PADDLE_CREDENTIAL_PARITY=PASS");

  if (config.webhookSecret) {
    console.log("PADDLE_WEBHOOK_SECRET=CONFIGURED");
  } else if (requireWebhook) {
    throw new Error(
      "PADDLE_CONFIGURATION_ERROR: Webhook secret is required for end-to-end payment readiness."
    );
  } else {
    console.log("PADDLE_WEBHOOK_SECRET=MISSING_OPTIONAL_FOR_CHECKOUT_REQUIRED_FOR_FULFILLMENT");
  }

  const activePackages = CREDIT_PACKAGES.filter((pkg) => pkg.active);
  if (activePackages.length !== 1) {
    throw new Error(
      `PADDLE_CONFIGURATION_ERROR: Expected exactly one active package, found ${activePackages.length}.`
    );
  }
  if (activePackages[0].paddlePriceId !== config.priceId) {
    throw new Error(
      "PADDLE_CONFIGURATION_ERROR: Active catalog price does not match NEXT_PUBLIC_PADDLE_PRICE_ID."
    );
  }

  console.log(`PADDLE_PRICE_ID=${config.priceId.slice(0, 8)}...`);
  console.log("PADDLE_SINGLE_PRODUCT_CONTRACT=PASS");
  console.log(
    `PADDLE_LAUNCH_MODE=${config.isSandbox ? "TEST_ONLY_NO_REAL_MONEY" : "LIVE_CREDENTIALS_CONFIGURED"}`
  );
  process.exit(0);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("PADDLE_CONFIGURATION_ERROR:", message);
  process.exit(1);
}
