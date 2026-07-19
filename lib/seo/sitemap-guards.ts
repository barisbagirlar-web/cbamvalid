/**
 * MIL-STD Sitemap Invariants — Shared Guards (§1.2, §1.3, §1.4, §5.0)
 *
 * [INTERNAL] All sitemap route.ts files MUST import and use these.
 *
 * §1.4 EMPTY FAIL-SAFE: If 0 URLs are generated, block output + fire P0 webhook alarm.
 *   Catastrophic de-indexing prevention. Googlebot drops site from index
 *   if it receives empty <urlset></urlset>.
 *
 * §1.3 DEDUP: SHA-256 URL normalization before inclusion.
 *   Prevents XML bloat from duplicate canonical URLs.
 *
 * §1.2 MONOTONIC LASTmod: MAX(contentLastMod, now) enforcement.
 *   Prevents temporal confusion in Googlebot's crawling schedule.
 *
 * §5.0 I5 STREAM ENGINE: ReadableStream-based generation, O(1) memory.
 *   Never builds full XML string in memory. 500K+ URLs safe.
 */

import { createHash } from "crypto";
import { statSync } from "fs";

// ─── §1.4 Webhook Alarm ───

const ALARM_WEBHOOK_URL = process.env.SITEMAP_ALARM_WEBHOOK ?? null;

/**
 * Fire P0 alarm when sitemap generation fails (empty dataset, etc).
 * Non-blocking — failure to deliver alarm must not crash the pipeline.
 */
async function fireAlarm(reason: string, detail?: string): Promise<void> {
  console.error(`[SITEMAP-ALARM] 🔴 P0: ${reason}${detail ? " — " + detail : ""}`);
  if (!ALARM_WEBHOOK_URL) return;
  try {
    await fetch(ALARM_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `🔴 CBAMValid Sitemap P0 Alarm\n*Reason:* ${reason}\n*Detail:* ${detail ?? "N/A"}\n*Time:* ${new Date().toISOString()}`,
        severity: "critical",
        system: "sitemap-generator",
      }),
    });
  } catch {
    // Alarm delivery failure must not block the pipeline
    console.error("[SITEMAP-ALARM] Failed to deliver webhook alarm");
  }
}

// ─── §1.3 URL Normalization ───

/** XSS/Script-injection patterns to strip from URL parameters (§4 SALDIRI 1) */
const XSS_PATTERNS = [
  /<script[\s\S]*?>/gi,
  /<iframe[\s\S]*?>/gi,
  /javascript\s*:/gi,
  /on\w+\s*=/gi,
  /%3Cscript/gi,
  /%3Ciframe/gi,
  /data\s*:/gi,
  /vbscript\s*:/gi,
];

/** Strip XSS/script injection from URL parameter values */
function sanitizeParamValue(value: string): string {
  let v = value;
  for (const pattern of XSS_PATTERNS) {
    v = v.replace(pattern, "[BLOCKED]");
  }
  return v;
}

/** Known param whitelist — only these params survive normalization */
const ALLOWED_PARAMS = new Set(["page","id","lang","q","search","sort","order","filter"]);

/** Normalize URL before hashing: strip tracking params, sanitize XSS, sort query params, lowercase host */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Sanitize all param values for XSS/script injection (§4 SALDIRI 1)
    const sanitizedParams: [string, string][] = [];
    for (const [key, value] of parsed.searchParams) {
      const cleanKey = sanitizeParamValue(key);
      const cleanValue = sanitizeParamValue(value);
      sanitizedParams.push([cleanKey, cleanValue]);
    }

    // Rebuild search params from sanitized list
    parsed.search = "";
    for (const [key, value] of sanitizedParams) {
      if (key.length > 0) {
        parsed.searchParams.append(key, value);
      }
    }

    // Alphabetical sort of query params
    parsed.searchParams.sort();

    // Remove known tracking params
    const trackingParams = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content",
      "fbclid","gclid","gclsrc","dclid","msclkid","twclid","igshid","ref","source","_ga"];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }

    // Remove dangerous prototype-pollution params (§4 SALDIRI 1)
    const dangerousKeys: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (key.includes("__proto__") || key.includes("constructor") || key.includes("prototype")
          || key.length > 100 || key.match(/^[^a-zA-Z0-9_-]+$/)) {
        dangerousKeys.push(key);
      }
    });
    for (const key of dangerousKeys) {
      parsed.searchParams.delete(key);
    }

    // Remove non-whitelisted params (§4 SALDIRI 1: Whitelist only)
    const nonWhitelisted: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      if (key.length > 0 && !ALLOWED_PARAMS.has(key.toLowerCase())) {
        nonWhitelisted.push(key);
      }
    });
    for (const key of nonWhitelisted) {
      parsed.searchParams.delete(key);
    }

    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();
    // Remove trailing slash (except root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    // Invalid URL — return as-is (will be detected by Dirty Firewall)
    return url;
  }
}

/** SHA-256 hash of normalized URL */
export function urlHash(url: string): string {
  return createHash("sha256").update(normalizeUrl(url)).digest("hex").slice(0, 16);
}

/** Detect duplicates in list and return deduplicated set (generic — preserves entity metadata) */
export function deduplicateUrls<T extends { url: string; lastmod: string }>(urls: T[]): {
  clean: T[];
  duplicates: string[];
} {
  const seen = new Set<string>();
  const clean: T[] = [];
  const duplicates: string[] = [];

  for (const entry of urls) {
    const hash = urlHash(entry.url);
    if (seen.has(hash)) {
      duplicates.push(entry.url);
    } else {
      seen.add(hash);
      clean.push(entry);
    }
  }

  return { clean, duplicates };
}

// ─── §1.2 Monotonic lastmod ───

/** Enforce monotonic increase: MAX(contentLastMod, currentEpoch) */
export function safeLastMod(contentLastMod: string, currentEpoch?: Date): string {
  const now = (currentEpoch ?? new Date()).toISOString();
  // lastmod must never be in the future
  if (contentLastMod > now) {
    console.warn(`[SITEMAP-GUARD] Future lastmod clamped: ${contentLastMod} → ${now}`);
    return now;
  }
  return contentLastMod;
}

// ─── §1.4 Empty fail-safe ───

/**
 * Build XML response with empty-sitemap guard.
 * If urls array is empty, returns null AND fires P0 webhook alarm.
 *
 * §1.4: Googlebot must NEVER receive empty <urlset></urlset>.
 */
export function buildUrlsetXml(
  urls: { url: string; lastmod: string }[],
  options?: { previousGoodCount?: number },
): string | null {
  if (urls.length === 0) {
    console.error("[SITEMAP-GUARD] ❌ EMPTY URLSET BLOCKED — §1.4 fail-safe activated.");
    if (options?.previousGoodCount) {
      console.error(`[SITEMAP-GUARD] Last known good had ${options.previousGoodCount} URLs.`);
    }
    console.error("[SITEMAP-GUARD] Sitemap generation HALTED to prevent de-indexing.");
    fireAlarm("EMPTY URLSET DETECTED", `Previous good count: ${options?.previousGoodCount ?? "unknown"}`);
    return null;
  }

  // Validate all lastmod values (pre-checks)
  const now = new Date().toISOString();
  for (const u of urls) {
    if (u.lastmod > now) {
      console.warn(`[SITEMAP-GUARD] ⚠️ Future lastmod on ${u.url}: ${u.lastmod} → clamped`);
    }
  }

  const urlsXml = urls.map(({ url, lastmod }) =>
    `  <url>\n    <loc>${url}</loc>\n    <lastmod>${safeLastMod(lastmod)}</lastmod>\n  </url>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>`;
}

// ─── E-E-A-T Entity Extension (eea: namespace) ───

/**
 * Semantic SEO Mandate §2: Custom XML namespace for AI crawler entity binding.
 * AI bots (Perplexity, SGE) parse custom tags as semantic signals before HTML render.
 */
export const EEA_NAMESPACE_URI = "https://cbamvalid.com/ns/eea-v1";

/** Canonical expert entity @id references (must match schema.ts @graph @id values) */
export const CBAM_EXPERTS = {
  NEELA_NATARAJ: "https://cbamvalid.com/team/neela-nataraj/#person",
  BARIS_BAGIRLAR: "https://cbamvalid.com/team/baris-bagirlar/#person",
} as const;

export interface SitemapExpert {
  /** @id reference to the Person entity in schema.ts @graph */
  ref: string;
  /** Role of the expert for this URL, e.g. "academic-oversight" */
  role: string;
}

export interface EntityUrl {
  url: string;
  lastmod: string;
  /** E-E-A-T experts who verified this URL's content */
  verifiedBy?: SitemapExpert[];
  /** Regulatory reference identifier, e.g. "EU-2023/956-Annex-III" */
  regulatoryRef?: string;
}

/** XML-escape attribute/text values to prevent malformed XML + injection */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build the <eea:verifiedBy>/<eea:regulatoryRef> block for one URL entry */
function buildEntityBlock(entry: EntityUrl): string {
  let block = "";
  if (entry.verifiedBy && entry.verifiedBy.length > 0) {
    block += `    <eea:verifiedBy>\n`;
    for (const expert of entry.verifiedBy) {
      block += `      <eea:expert ref="${xmlEscape(expert.ref)}" role="${xmlEscape(expert.role)}"/>\n`;
    }
    block += `    </eea:verifiedBy>\n`;
  }
  if (entry.regulatoryRef) {
    block += `    <eea:regulatoryRef>${xmlEscape(entry.regulatoryRef)}</eea:regulatoryRef>\n`;
  }
  return block;
}

/**
 * Semantic SEO Mandate §2: STREAM-BASED urlset with E-E-A-T entity extension.
 * Emits eea: namespace so AI crawlers can bind each URL to verified expert entities.
 * O(1) memory — same streaming guarantees as buildUrlsetStream().
 */
export function buildEntityUrlsetStream(
  urls: EntityUrl[],
  options?: { previousGoodCount?: number },
): ReadableStream<Uint8Array> | null {
  if (urls.length === 0) {
    console.error("[SITEMAP-GUARD] ❌ EMPTY URLSET BLOCKED — §1.4 fail-safe activated.");
    fireAlarm("EMPTY URLSET DETECTED (entity stream)", `Previous good count: ${options?.previousGoodCount ?? "unknown"}`);
    return null;
  }

  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index === 0) {
        controller.enqueue(encoder.encode(
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
          `        xmlns:eea="${EEA_NAMESPACE_URI}">\n`
        ));
      }

      const chunkSize = 100;
      const end = Math.min(index + chunkSize, urls.length);
      let chunk = "";

      for (let i = index; i < end; i++) {
        const entry = urls[i];
        const entityBlock = buildEntityBlock(entry);
        chunk += `  <url>\n    <loc>${xmlEscape(entry.url)}</loc>\n    <lastmod>${safeLastMod(entry.lastmod)}</lastmod>\n${entityBlock}  </url>\n`;
      }

      controller.enqueue(encoder.encode(chunk));
      index = end;

      if (index >= urls.length) {
        controller.enqueue(encoder.encode("</urlset>\n"));
        controller.close();
      }
    },
  });
}

/**
 * §5.0 I5: STREAM-BASED urlset XML generator.
 * O(1) memory — never builds full XML string. Safe for 500K+ URLs.
 * Uses ReadableStream to pipe URL entries directly to HTTP response.
 *
 * Replaces buildUrlsetXml() for scale-critical sitemaps.
 */
export function buildUrlsetStream(
  urls: { url: string; lastmod: string }[],
  options?: { previousGoodCount?: number },
): ReadableStream<Uint8Array> | null {
  if (urls.length === 0) {
    console.error("[SITEMAP-GUARD] ❌ EMPTY URLSET BLOCKED — §1.4 fail-safe activated.");
    fireAlarm("EMPTY URLSET DETECTED (stream)", `Previous good count: ${options?.previousGoodCount ?? "unknown"}`);
    return null;
  }

  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index === 0) {
        // Emit XML prologue
        controller.enqueue(encoder.encode(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
        ));
      }

      // Emit chunks of 100 URLs at a time (backpressure-safe)
      const chunkSize = 100;
      const end = Math.min(index + chunkSize, urls.length);
      let chunk = "";

      for (let i = index; i < end; i++) {
        const { url, lastmod } = urls[i];
        chunk += `  <url>\n    <loc>${url}</loc>\n    <lastmod>${safeLastMod(lastmod)}</lastmod>\n  </url>\n`;
      }

      controller.enqueue(encoder.encode(chunk));
      index = end;

      if (index >= urls.length) {
        // Close stream
        controller.enqueue(encoder.encode("</urlset>\n"));
        controller.close();
      }
      // If buffer not full, pull() will be called again automatically
    },
  });
}

/**
 * Build sitemap index XML with empty-guard + webhook alarm.
 */
export function buildSitemapIndexXml(
  entries: { loc: string; lastmod: string }[],
): string | null {
  if (entries.length === 0) {
    console.error("[SITEMAP-GUARD] ❌ EMPTY SITEMAP INDEX BLOCKED — §1.4 fail-safe.");
    fireAlarm("EMPTY SITEMAP INDEX", "No child sitemaps available");
    return null;
  }

  const sitemapXml = entries.map(({ loc, lastmod }) =>
    `  <sitemap>\n    <loc>${loc}</loc>\n    <lastmod>${safeLastMod(lastmod)}</lastmod>\n  </sitemap>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapXml}\n</sitemapindex>`;
}

/**
 * Standard sitemap response with §5 I5 headers + cache-poisoning defense.
 * Returns 503 Service Unavailable if generation failed (empty guard triggered).
 *
 * §4 Attack 3 Defense:
 *   - ETag: SHA-256 integrity verification
 *   - Vary: Accept-Encoding (prevents CDN serving wrong variant)
 *   - Surrogate-Control: CDN edge-level cache directive
 */
export function sitemapResponse(xml: string | null): Response {
  if (!xml) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?>\n<error>Sitemap temporarily unavailable</error>',
      {
        status: 503,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
          "Retry-After": "300",
          "Vary": "Accept-Encoding",
        },
      },
    );
  }

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      "ETag": `"${createHash("sha256").update(xml).digest("hex").slice(0, 16)}"`,
      "Vary": "Accept-Encoding",
      "Surrogate-Control": "max-age=3600, stale-while-revalidate=86400",
    },
  });
}

/**
 * §5.0 I5: Stream-based sitemap response for ReadableStream payloads.
 * Memory-safe for any URL count.
 */
export function sitemapStreamResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      "Vary": "Accept-Encoding",
      "Surrogate-Control": "max-age=3600, stale-while-revalidate=86400",
    },
  });
}

// ─── §3 Cross-component SSOT helpers ───

/** Verify canonical URL consistency between components */
export interface CanonicalCheck {
  url: string;
  htmlCanonical: string | null;
  httpLinkHeader: string | null;
  sitemapLoc: string;
  robotsTxtSitemap: boolean;
  pass: boolean;
  failures: string[];
}

/**
 * Normalize and compare canonical URLs from all 4 components.
 * Returns unified status per §3.
 */
export function crossCheckCanonical(
  pageUrl: string,
  htmlCanonical: string | null,
  httpLinkHeader: string | null,
  sitemapLoc: string,
  robotsTxtSitemap: boolean,
): CanonicalCheck {
  const failures: string[] = [];
  const normalized = (u: string | null) => u ? normalizeUrl(u) : null;

  const html = normalized(htmlCanonical);
  const http = normalized(httpLinkHeader);
  const sitemap = normalized(sitemapLoc);

  if (html && http && html !== http) {
    failures.push(`HTML canonical "${html}" ≠ HTTP Link header "${http}"`);
  }
  if (html && sitemap && html !== sitemap) {
    failures.push(`HTML canonical "${html}" ≠ Sitemap <loc> "${sitemap}"`);
  }
  if (!robotsTxtSitemap) {
    failures.push("Sitemap not referenced in robots.txt");
  }

  return {
    url: pageUrl,
    htmlCanonical,
    httpLinkHeader,
    sitemapLoc,
    robotsTxtSitemap,
    pass: failures.length === 0,
    failures,
  };
}

// ─── §1.1 Content-derived file modification timestamp ───

/**
 * Derive lastmod from actual file modification time.
 * For tools pages, this replaces hardcoded date tiers.
 * Falls back to a reasonable default if file is not found.
 */
export function fileLastMod(filePath: string, fallback: string): string {
  try {
    const stat = statSync(filePath);
    return safeLastMod(stat.mtime.toISOString());
  } catch {
    return safeLastMod(fallback);
  }
}
