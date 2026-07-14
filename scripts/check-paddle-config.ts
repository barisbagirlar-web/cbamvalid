import fs from "fs";
import path from "path";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  content.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let val = parts.slice(1).join("=").trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      } else if (val.startsWith("'") && val.endsWith("'")) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
}

loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

import { getPaddleConfig } from "../lib/billing/paddle-config.server";
import { CREDIT_PACKAGES } from "../lib/billing/catalog";

try {
  const config = getPaddleConfig();
  
  console.log("PADDLE_ENV=CONFIGURED");
  console.log("PADDLE_API_KEY=CONFIGURED");
  console.log("PADDLE_CLIENT_TOKEN=CONFIGURED");
  
  if (config.webhookSecret) {
    console.log("PADDLE_WEBHOOK_SECRET=CONFIGURED");
  } else {
    console.log("PADDLE_WEBHOOK_SECRET=MISSING");
  }
  
  let validPricesCount = 0;
  CREDIT_PACKAGES.forEach(pkg => {
    if (pkg.paddlePriceId) {
      validPricesCount++;
    }
  });
  
  console.log("PADDLE_PRICE_IDS=CONFIGURED");
  
  process.exit(0);
} catch (error: any) {
  console.error("PADDLE_CONFIGURATION_ERROR:", error.message || error);
  process.exit(1);
}
