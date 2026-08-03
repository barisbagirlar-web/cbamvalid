#!/usr/bin/env node

const baseUrl = String(process.env.LIVE_BASE_URL || process.argv[2] || "https://cbamvalid.com").replace(/\/$/, "");
const target = `${baseUrl}/?checkout-release-verify=${Date.now()}`;

const response = await fetch(target, {
  redirect: "manual",
  headers: { "cache-control": "no-cache" },
});

if (!response.ok && response.status !== 304) {
  throw new Error(`LIVE_CHECKOUT_RELEASE_HTTP_${response.status}`);
}

const csp = response.headers.get("content-security-policy") || "";
if (!csp.includes("https://public.profitwell.com")) {
  throw new Error("LIVE_CHECKOUT_RELEASE_CSP_MISSING_PROFITWELL");
}

console.log("LIVE_CHECKOUT_RELEASE_CSP=PASS");
console.log(`LIVE_CHECKOUT_RELEASE_URL=${baseUrl}`);
