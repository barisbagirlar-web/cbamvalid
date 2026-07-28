/**
 * Prove Paddle catalog unit price matches pricing-config amountMinor.
 * Uses PADDLE_API_KEY + NEXT_PUBLIC_PADDLE_PRICE_ID from env / .env.local.
 * Exit 0 only when amount matches. Live 403 with sandbox key → EXTERNAL_BLOCKER note.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function loadEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const fileEnv = { ...loadEnvFile(join(root, ".env")), ...loadEnvFile(join(root, ".env.local")) };
const env = { ...fileEnv, ...process.env };

const pricingSrc = readFileSync(join(root, "lib/billing/pricing-config.ts"), "utf8");
const pricingMinor = pricingSrc.match(/amountMinor:\s*(\d+)/);
if (!pricingMinor) {
  console.error("PROVE_PADDLE=FAIL reason=PARSE_PRICING");
  process.exit(1);
}
const expected = pricingMinor[1];
const key = env.PADDLE_API_KEY;
const priceId = env.NEXT_PUBLIC_PADDLE_PRICE_ID;
if (!key || !priceId) {
  console.error("PROVE_PADDLE=FAIL reason=MISSING_ENV hasKey=%s hasPriceId=%s", !!key, !!priceId);
  process.exit(1);
}

const sandboxHint = String(env.NEXT_PUBLIC_PADDLE_SANDBOX || env.NEXT_PUBLIC_PADDLE_ENV || "").toLowerCase();
const preferSandbox =
  sandboxHint.includes("sandbox") || sandboxHint === "true" || sandboxHint === "1";

const targets = preferSandbox
  ? [
      ["sandbox", "https://sandbox-api.paddle.com"],
      ["live", "https://api.paddle.com"],
    ]
  : [
      ["live", "https://api.paddle.com"],
      ["sandbox", "https://sandbox-api.paddle.com"],
    ];

let matched = false;
let anyOk = false;

for (const [label, base] of targets) {
  const res = await fetch(`${base}/prices/${priceId}`, {
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  });
  const body = await res.json();
  const amount = body?.data?.unit_price?.amount;
  const currency = body?.data?.unit_price?.currency_code;
  const ok = res.ok && String(amount) === expected && String(currency).toUpperCase() === "USD";
  console.log(
    `PROVE_PADDLE_${label.toUpperCase()}=${ok ? "PASS" : res.ok ? "FAIL" : "BLOCKED"} http=${res.status} amount=${amount ?? "n/a"} currency=${currency ?? "n/a"} expected=${expected}`
  );
  if (res.ok) anyOk = true;
  if (ok) matched = true;
}

if (!anyOk) {
  console.error("PROVE_PADDLE=FAIL reason=NO_API_ACCESS");
  process.exit(1);
}

if (!matched) {
  console.error("PROVE_PADDLE=FAIL reason=AMOUNT_MISMATCH expected=%s", expected);
  process.exit(1);
}

console.log(`PROVE_PADDLE=PASS amountMinor=${expected} priceId=${priceId}`);
