import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "config", "cbam-commercial-product.json");
const targetPath = path.join(root, "functions", "src", "generated", "cbam-commercial-product.json");

const requiredKeys = [
  "schemaVersion",
  "productCode",
  "slug",
  "displayName",
  "currency",
  "priceMinor",
  "creditsGranted",
  "creditsRequiredToUnlock",
  "releasesPerPack",
  "subscription",
  "correctionWindowDays",
  "maxCustomsLines",
  "maxInstallations",
  "maxCnCodes",
  "active",
];

if (!fs.existsSync(sourcePath)) throw new Error("COMMERCIAL_CONTRACT_SOURCE_MISSING");
const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
for (const key of requiredKeys) {
  if (!(key in source)) throw new Error(`COMMERCIAL_CONTRACT_FIELD_MISSING:${key}`);
}
if (source.schemaVersion !== "CBAMVALID-COMMERCE-1.0") throw new Error("COMMERCIAL_CONTRACT_SCHEMA_VERSION_INVALID");
if (source.currency !== "USD") throw new Error("COMMERCIAL_CONTRACT_CURRENCY_INVALID");
if (!Number.isInteger(source.priceMinor) || source.priceMinor <= 0) throw new Error("COMMERCIAL_CONTRACT_PRICE_INVALID");
if (!Number.isInteger(source.creditsGranted) || source.creditsGranted <= 0) throw new Error("COMMERCIAL_CONTRACT_CREDITS_INVALID");
if (!Number.isInteger(source.creditsRequiredToUnlock) || source.creditsRequiredToUnlock <= 0) throw new Error("COMMERCIAL_CONTRACT_UNLOCK_COST_INVALID");
if (!Number.isInteger(source.releasesPerPack) || source.releasesPerPack <= 0) throw new Error("COMMERCIAL_CONTRACT_RELEASES_INVALID");
if (source.creditsGranted !== source.creditsRequiredToUnlock) throw new Error("COMMERCIAL_CONTRACT_PURCHASE_UNLOCK_MISMATCH");
if (source.subscription !== false) throw new Error("COMMERCIAL_CONTRACT_SUBSCRIPTION_PROHIBITED");

const canonical = `${JSON.stringify(source, null, 2)}\n`;
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, canonical, "utf8");
console.log("COMMERCIAL_CONTRACT_SYNC=PASS");
console.log(`PRODUCT_CODE=${source.productCode}`);
console.log(`PRICE_MINOR=${source.priceMinor}`);
console.log(`CREDITS_GRANTED=${source.creditsGranted}`);
console.log(`RELEASES_PER_PACK=${source.releasesPerPack}`);
