import fs from "fs";
import path from "path";

// Manually load .env variables
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const firstEq = trimmed.indexOf("=");
    if (firstEq === -1) return;
    const key = trimmed.slice(0, firstEq).trim();
    let value = trimmed.slice(firstEq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

import { getPaddleConfig } from "../lib/billing/paddle-config.server";

async function run() {
  try {
    const config = getPaddleConfig();
    console.log("Config loaded:", {
      isSandbox: config.isSandbox,
      apiKey: config.apiKey ? `${config.apiKey.slice(0, 15)}...` : "missing",
      clientToken: config.clientToken ? `${config.clientToken.slice(0, 15)}...` : "missing",
      priceId: config.priceId,
    });

    const transactionUrl = config.isSandbox
      ? "https://sandbox-api.paddle.com/transactions"
      : "https://api.paddle.com/transactions";

    console.log("Sending transaction request to:", transactionUrl);

    const paddleRes = await fetch(transactionUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [
          {
            price_id: config.priceId,
            quantity: 1,
          }
        ],
        custom_data: {
          uid: "test-user-uid",
          productCode: "CBAM_CREDIT_PACK_5",
          orderId: `ord_test_${Date.now()}`,
        }
      })
    });

    console.log("Response status:", paddleRes.status);
    const text = await paddleRes.text();
    console.log("Response body:", text);
  } catch (err: any) {
    console.error("Unexpected error:", err.message || err);
  }
}

run();
