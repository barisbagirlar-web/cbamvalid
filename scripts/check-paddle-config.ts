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
import { CANONICAL_PRICING } from "../lib/billing/pricing-config";

const requireWebhook = process.argv.includes("--require-webhook");
const verifyCatalog = process.argv.includes("--verify-catalog");
const requireProduction = process.argv.includes("--require-production");

type PaddlePriceResponse = {
  data?: {
    id?: string;
    product_id?: string;
    type?: string;
    status?: string;
    billing_cycle?: unknown;
    unit_price?: {
      amount?: string;
      currency_code?: string;
    } | null;
    product?: {
      id?: string;
      name?: string;
      status?: string;
    };
  };
  error?: unknown;
  meta?: { request_id?: string };
};

async function verifyPaddleCatalog(config: ReturnType<typeof getPaddleConfig>): Promise<void> {
  const response = await fetch(
    `${config.apiBaseUrl}/prices/${encodeURIComponent(config.priceId)}?include=product`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
      },
    }
  );

  const payload = (await response.json()) as PaddlePriceResponse;
  if (!response.ok || !payload.data) {
    throw new Error(
      `PADDLE_CATALOG_ERROR: Price lookup failed (${response.status}); request_id=${payload.meta?.request_id ?? "unknown"}.`
    );
  }

  const price = payload.data;
  const expectedAmount = String(CANONICAL_PRICING.amountMinor);

  if (price.id !== config.priceId) {
    throw new Error("PADDLE_CATALOG_ERROR: Returned price ID does not match configured price ID.");
  }
  if (price.status !== "active") {
    throw new Error(`PADDLE_CATALOG_ERROR: Configured price is not active (${price.status ?? "missing"}).`);
  }
  if (price.type !== "standard") {
    throw new Error(`PADDLE_CATALOG_ERROR: Configured price must be a standard catalog price (${price.type ?? "missing"}).`);
  }
  if (price.billing_cycle !== null) {
    throw new Error("PADDLE_CATALOG_ERROR: Working File Software Unlock must be one-time, not recurring.");
  }
  if (price.unit_price?.amount !== expectedAmount) {
    throw new Error(
      `PADDLE_CATALOG_ERROR: Paddle amount ${price.unit_price?.amount ?? "missing"} does not match website amount ${expectedAmount}.`
    );
  }
  if (price.unit_price?.currency_code !== CANONICAL_PRICING.currency) {
    throw new Error(
      `PADDLE_CATALOG_ERROR: Paddle currency ${price.unit_price?.currency_code ?? "missing"} does not match ${CANONICAL_PRICING.currency}.`
    );
  }
  if (price.product && price.product.status !== "active") {
    throw new Error(`PADDLE_CATALOG_ERROR: Related product is not active (${price.product.status ?? "missing"}).`);
  }

  console.log(`PADDLE_CATALOG_PRICE_AMOUNT=${price.unit_price.amount}`);
  console.log(`PADDLE_CATALOG_PRICE_CURRENCY=${price.unit_price.currency_code}`);
  console.log(`PADDLE_CATALOG_PRODUCT_ID=${price.product_id ?? price.product?.id ?? "unknown"}`);
  console.log(`PADDLE_CATALOG_PRODUCT_NAME=${price.product?.name ?? "not-included"}`);
  console.log("PADDLE_CATALOG_PRICE_PARITY=PASS");
}

async function main(): Promise<void> {
  const config = getPaddleConfig();

  console.log(`PADDLE_ENV=${config.environment}`);
  console.log(`PADDLE_API_BASE=${config.apiBaseUrl}`);
  console.log("PADDLE_API_KEY=CONFIGURED");
  console.log("PADDLE_CLIENT_TOKEN=CONFIGURED");
  console.log("PADDLE_CREDENTIAL_PARITY=PASS");

  if (requireProduction && config.isSandbox) {
    throw new Error("PADDLE_CONFIGURATION_ERROR: Production credentials are required for this check.");
  }

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
  console.log(`WEBSITE_PRICE_AMOUNT=${CANONICAL_PRICING.amountMinor}`);
  console.log(`WEBSITE_PRICE_CURRENCY=${CANONICAL_PRICING.currency}`);
  console.log("PADDLE_SINGLE_PRODUCT_CONTRACT=PASS");

  if (verifyCatalog) {
    await verifyPaddleCatalog(config);
  } else {
    console.log("PADDLE_CATALOG_PRICE_PARITY=SKIPPED_USE_--verify-catalog");
  }

  console.log(
    `PADDLE_LAUNCH_MODE=${config.isSandbox ? "TEST_ONLY_NO_REAL_MONEY" : "LIVE_CREDENTIALS_CONFIGURED"}`
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("PADDLE_CONFIGURATION_ERROR:", message);
  process.exit(1);
});
