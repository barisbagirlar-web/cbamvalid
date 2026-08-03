#!/usr/bin/env node

const baseUrl = new URL(process.argv[2] || process.env.LIVE_BASE_URL || "https://cbamvalid.com");
const attempts = Number(process.env.LIVE_ASSET_CHECK_ATTEMPTS || 6);
const delayMs = Number(process.env.LIVE_ASSET_CHECK_DELAY_MS || 5000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeAssetUrl(value) {
  const decoded = value.replace(/&amp;/g, "&");
  return new URL(decoded, baseUrl).toString();
}

function expectedMime(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith(".css")) return "css";
  if (pathname.endsWith(".js")) return "js";
  return "other";
}

function mimeIsValid(kind, contentType) {
  const type = String(contentType || "").toLowerCase();
  if (kind === "css") return type.includes("text/css");
  if (kind === "js") {
    return type.includes("javascript") || type.includes("ecmascript");
  }
  return false;
}

async function fetchText(url) {
  const response = await fetch(url, {
    redirect: "follow",
    cache: "no-store",
    headers: {
      "cache-control": "no-cache, no-store, max-age=0",
      pragma: "no-cache",
      "user-agent": "CBAMValid-Live-Asset-Integrity-Check/1.0",
    },
  });
  return { response, text: await response.text() };
}

async function verifyOnce() {
  const pageUrl = new URL(baseUrl);
  pageUrl.searchParams.set("__asset_integrity", `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const { response: pageResponse, text: html } = await fetchText(pageUrl);
  const pageType = pageResponse.headers.get("content-type") || "";

  if (!pageResponse.ok) {
    throw new Error(`HTML_HTTP_${pageResponse.status}`);
  }
  if (!pageType.toLowerCase().includes("text/html")) {
    throw new Error(`HTML_MIME_INVALID:${pageType || "missing"}`);
  }

  const assets = new Set();
  const pattern = /(?:src|href)=["']([^"']*\/_next\/static\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi;
  for (const match of html.matchAll(pattern)) assets.add(normalizeAssetUrl(match[1]));

  const kinds = [...assets].map(expectedMime);
  if (!kinds.includes("js")) throw new Error("NO_NEXT_JS_ASSET_IN_HTML");
  if (!kinds.includes("css")) throw new Error("NO_NEXT_CSS_ASSET_IN_HTML");

  for (const assetUrl of assets) {
    const kind = expectedMime(assetUrl);
    const { response, text } = await fetchText(assetUrl);
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok) {
      throw new Error(`ASSET_HTTP_${response.status}:${assetUrl}`);
    }
    if (!mimeIsValid(kind, contentType)) {
      throw new Error(`ASSET_MIME_INVALID:${contentType || "missing"}:${assetUrl}`);
    }
    if (/^\s*(?:not found|404\b)/i.test(text)) {
      throw new Error(`ASSET_BODY_IS_404:${assetUrl}`);
    }
    if (text.length < 8) {
      throw new Error(`ASSET_BODY_TOO_SMALL:${assetUrl}`);
    }
  }

  return assets.size;
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt += 1) {
  try {
    const count = await verifyOnce();
    console.log("LIVE_NEXT_ASSET_INTEGRITY=PASS");
    console.log(`LIVE_BASE_URL=${baseUrl.origin}`);
    console.log(`VERIFIED_ASSET_COUNT=${count}`);
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.error(`LIVE_NEXT_ASSET_ATTEMPT_${attempt}=FAIL`);
    console.error(error instanceof Error ? error.message : String(error));
    if (attempt < attempts) await sleep(delayMs);
  }
}

console.error("LIVE_NEXT_ASSET_INTEGRITY=FAIL");
console.error(lastError instanceof Error ? lastError.stack : String(lastError));
process.exit(1);
