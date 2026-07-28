/**
 * Fail closed if functions catalog amount diverges from pricing-config SSOT.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const pricingSrc = readFileSync(join(root, "lib/billing/pricing-config.ts"), "utf8");
const catalogSrc = readFileSync(join(root, "functions/src/commerce/catalog.ts"), "utf8");

const pricingMinor = pricingSrc.match(/amountMinor:\s*(\d+)/);
const catalogMinor = catalogSrc.match(/PACK_AMOUNT_MINOR_USD\s*=\s*(\d+)/);
const displayPrice = pricingSrc.match(/displayPrice:\s*"(\d+)"/);

if (!pricingMinor || !catalogMinor || !displayPrice) {
  console.error("PADDLE_AMOUNT_GUARD=FAIL reason=PARSE");
  process.exit(1);
}

const a = Number(pricingMinor[1]);
const b = Number(catalogMinor[1]);
if (a !== b) {
  console.error(`PADDLE_AMOUNT_GUARD=FAIL pricing=${a} catalog=${b}`);
  process.exit(1);
}

if (a !== Number(displayPrice[1]) * 100) {
  console.error(`PADDLE_AMOUNT_GUARD=FAIL displayPrice_mismatch minor=${a} display=${displayPrice[1]}`);
  process.exit(1);
}

console.log(`PADDLE_AMOUNT_GUARD=PASS amountMinor=${a} displayPrice=${displayPrice[1]}`);
console.log("PADDLE_DASHBOARD_NOTE=Run npm run prove:paddle-amount to prove live/sandbox catalog equals amountMinor");
