import fs from "node:fs";
import path from "node:path";
import { COMMERCIAL_CONTRACT } from "../lib/billing/commercial-contract";

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_MISSING`);
  return value;
}

function priceId(name: string): string {
  const value = required(name);
  if (!/^pri_[A-Za-z0-9]+$/.test(value)) throw new Error(`${name}_INVALID`);
  return value;
}

loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

try {
  const environment = required("PADDLE_ENVIRONMENT");
  if (!new Set(["sandbox", "production"]).has(environment)) throw new Error("PADDLE_ENVIRONMENT_INVALID");
  const apiKey = required("PADDLE_API_KEY");
  const clientToken = required("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
  required("PADDLE_WEBHOOK_SECRET");
  const sandboxPriceId = priceId("PADDLE_PRICE_ID_SANDBOX");
  const productionPriceId = priceId("PADDLE_PRICE_ID_PRODUCTION");

  if (environment === "sandbox" && !apiKey.startsWith("pdl_sdbx_")) throw new Error("PADDLE_SANDBOX_API_KEY_INVALID");
  if (environment === "production" && apiKey.startsWith("pdl_sdbx_")) throw new Error("PADDLE_PRODUCTION_API_KEY_INVALID");
  if (environment === "sandbox" && !clientToken.startsWith("test_")) throw new Error("PADDLE_SANDBOX_CLIENT_TOKEN_INVALID");
  if (sandboxPriceId === productionPriceId) throw new Error("PADDLE_PRICE_ENVIRONMENTS_COLLIDE");

  console.log("PADDLE_CONFIGURATION=PASS");
  console.log(`PADDLE_ENVIRONMENT=${environment}`);
  console.log(`PRODUCT_CODE=${COMMERCIAL_CONTRACT.productCode}`);
  console.log(`PRICE_MINOR=${COMMERCIAL_CONTRACT.priceMinor}`);
  console.log(`CREDITS_GRANTED=${COMMERCIAL_CONTRACT.creditsGranted}`);
  console.log(`RELEASES_PER_PACK=${COMMERCIAL_CONTRACT.releasesPerPack}`);
} catch (error: unknown) {
  console.error("PADDLE_CONFIGURATION=FAIL");
  console.error(error instanceof Error ? error.message : "PADDLE_CONFIGURATION_UNKNOWN_FAILURE");
  process.exitCode = 1;
}
