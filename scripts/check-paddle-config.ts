import fs from "node:fs";
import path from "node:path";

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(path.join(process.cwd(), ".env"));
loadEnvFile(path.join(process.cwd(), ".env.local"));

async function main(): Promise<void> {
  const { getPaddleConfig } = await import("../lib/billing/paddle-config.server");
  const config = getPaddleConfig();

  console.log(`PADDLE_ENVIRONMENT=${config.environment.toUpperCase()}`);
  console.log("PADDLE_API_KEY=CONFIGURED");
  console.log("PADDLE_CLIENT_TOKEN=CONFIGURED");
  console.log("PADDLE_SERVER_PRICE_ID=CONFIGURED");
  console.log("PADDLE_WEBHOOK_SECRET=CONFIGURED");
  console.log(`PADDLE_WEBHOOK_ENDPOINT_EXPECTED=${config.expectedWebhookUrl}`);
  console.log(`PADDLE_WEBHOOK_URL_DECLARED=${config.configuredWebhookUrl ? "YES" : "NO"}`);
  console.log("PADDLE_DASHBOARD_ENDPOINT_VERIFIED=NO");
  console.log("PADDLE_CONFIG_STATIC_CHECK=PASS");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "PADDLE_CONFIGURATION_ERROR";
  console.error(`PADDLE_CONFIG_STATIC_CHECK=FAIL:${message}`);
  process.exitCode = 1;
});
