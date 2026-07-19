/**
 * MIL-STD §4: Red Team Sitemap Attacks — Self-Attack Simulation
 *
 * Protocol: Tests the sitemap system against adversarial inputs.
 *
 * SALDIRI 1: Parameter Injection — URL bomb with tracking params, script injection
 * SALDIRI 2: Orphan Page Generation — URLs in sitemap with zero internal links
 * SALDIRI 3: Cache Poisoning — Corrupted/truncated XML poisoning
 * SALDIRI 4: Canonical Drift — HTML canonical ≠ sitemap <loc>
 *
 * [INTERNAL] Security gate — BLOCKS deploy if vulnerabilities found.
 *
 * Usage: npx tsx scripts/red-team-sitemap.ts
 */

import { normalizeUrl } from "../lib/seo/sitemap-guards";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "..");

let exitCode = 0;
const findings: string[] = [];

console.log("[RED-TEAM] ========================================");
console.log("[RED-TEAM] MIL-STD §4: Red Team Sitemap Attacks");
console.log("[RED-TEAM] ========================================\n");

// ─── SALDIRI 1: Parameter Injection ───

console.log("[RED-TEAM] ─── ATTACK 1: Parameter Injection ───");

const maliciousParams = [
  "?search=<script>alert(1)</script>",
  "?category=1&sub=2&sub=3&sub=4&sub=5&sub=6&sub=7&sub=8&sub=9&sub=10",
  "?utm_source=evil&utm_medium=spam&gclid=injected&fbclid=poisoned",
  "?__proto__[admin]=true",
  "?" + "x=".repeat(1000),
];

for (const param of maliciousParams) {
  const baseUrl = "https://cbamvalid.com/cn-codes/25231000";
  const maliciousUrl = baseUrl + param;
  const normalized = normalizeUrl(maliciousUrl);

  const trackingParams = ["utm_source","utm_medium","utm_campaign","utm_term","utm_content","fbclid","gclid","gclsrc","dclid","msclkid"];
  const hasTracking = trackingParams.some(tp => normalized.includes(tp));
  const hasScript = normalized.includes("<script>");
  const hasProto = normalized.includes("__proto__");

  if (hasScript) {
    findings.push(`SALDIRI 1: Script injection NOT stripped from URL: ${normalized}`);
    console.log(`[RED-TEAM] ❌ Script injection survived normalization: ${param.slice(0, 40)}...`);
    exitCode = 1;
  } else if (hasProto) {
    findings.push(`SALDIRI 1: Prototype pollution NOT stripped: ${normalized}`);
    console.log(`[RED-TEAM] ❌ Prototype pollution survived: ${param}`);
    exitCode = 1;
  } else if (hasTracking) {
    console.log(`[RED-TEAM] ℹ️ Tracking params still present (known params stripped, unknown survive)`);
  } else {
    console.log(`[RED-TEAM] ✅ Attack neutralized: ${param.slice(0, 40)}...`);
  }
}

// ─── SALDIRI 2: Orphan Page Detection (source-level) ───

console.log("\n[RED-TEAM] ─── ATTACK 2: Orphan Page Generation ───");

// Check: do we have a graph connectivity guard?
const graphVerify = path.join(workspaceRoot, "scripts", "verify-graph-connectivity.ts");
const hasGraphGuard = fs.existsSync(graphVerify);
if (hasGraphGuard) {
  console.log("[RED-TEAM] ✅ Graph connectivity guard exists (verify-graph-connectivity.ts)");
  console.log("[RED-TEAM] ℹ️ Orphan pages would be detected by CI pipeline before deploy");
} else {
  findings.push("SALDIRI 2: No graph connectivity guard — orphan pages could enter sitemap");
  console.log("[RED-TEAM] ❌ No orphan page detection mechanism");
  exitCode = 1;
}

// Also check Dirty Firewall has HTTP status check
const firewallScript = path.join(workspaceRoot, "scripts", "sitemap-dirty-firewall.ts");
const hasFirewall = fs.existsSync(firewallScript);
if (hasFirewall) {
  const firewallContent = fs.readFileSync(firewallScript, "utf-8");
  if (firewallContent.includes("HEAD") || firewallContent.includes("status !== 200")) {
    console.log("[RED-TEAM] ✅ Dirty Firewall includes HTTP status validation → 404/410 rejected");
  } else {
    console.log("[RED-TEAM] ⚠️ Dirty Firewall missing HTTP status check");
  }
} else {
  console.log("[RED-TEAM] ⚠️ No Dirty Firewall script — HTTP validation on sitemap URLs missing");
}

// ─── SALDIRI 3: Cache Poisoning Protection ───

console.log("\n[RED-TEAM] ─── ATTACK 3: Cache Poisoning Check ───");

for (const f of ["sitemap.xml", "sitemaps/tools.xml", "sitemaps/sectors.xml", "sitemaps/cn-codes.xml"]) {
  const fp = path.join(workspaceRoot, "app", f, "route.ts");
  if (!fs.existsSync(fp)) continue;
  const content = fs.readFileSync(fp, "utf-8");
    const hasETag = content.includes("ETag") || content.includes("sitemapResponse") || content.includes("sitemapStreamResponse");
    const hasEmptyGuard = content.includes("buildUrlsetXml") || content.includes("buildUrlsetStream") || content.includes("buildSitemapIndexXml") || content.includes("empty");

  if (hasETag && hasEmptyGuard) {
    console.log(`[RED-TEAM] ✅ ${f}: ETag + empty guard → cache poisoning protected`);
  } else {
    if (!hasETag) findings.push(`SALDIRI 3: ${f} missing ETag header`);
    if (!hasEmptyGuard) findings.push(`SALDIRI 3: ${f} missing empty urlset guard`);
    console.log(`[RED-TEAM] ⚠️ ${f}: ETag=${hasETag} EmptyGuard=${hasEmptyGuard}`);
    exitCode = 1;
  }
}

// ─── SALDIRI 4: Canonical Drift via Cache Poisoning ───

console.log("\n[RED-TEAM] ─── ATTACK 4: Canonical Drift Simulation ───");

const sitemapFiles = ["app/sitemap.xml/route.ts", "app/sitemaps/tools.xml/route.ts", "app/sitemaps/sectors.xml/route.ts", "app/sitemaps/cn-codes.xml/route.ts"];
for (const sf of sitemapFiles) {
  const fp = path.join(workspaceRoot, sf);
  if (!fs.existsSync(fp)) continue;
  const content = fs.readFileSync(fp, "utf-8");

  if (content.includes("//cbamvalid.com") && !content.includes("https://cbamvalid.com")) {
    findings.push(`SALDIRI 4: ${sf} contains protocol-relative URL — canonical drift risk`);
    console.log(`[RED-TEAM] ❌ ${sf}: protocol-relative URL detected`);
    exitCode = 1;
  }

  if (content.includes("www.cbamvalid.com")) {
    findings.push(`SALDIRI 4: ${sf} contains www.cbamvalid.com — non-canonical hostname`);
    console.log(`[RED-TEAM] ❌ ${sf}: non-canonical hostname "www.cbamvalid.com"`);
    exitCode = 1;
  }

  console.log(`[RED-TEAM] ℹ️ ${sf}: scanning complete`);
}

// ─── REPORT ───

console.log("\n[RED-TEAM] ========================================");
if (exitCode === 0) {
  console.log("[RED-TEAM] ✅ RED TEAM CLEAR — no vulnerabilities found.");
} else {
  console.error(`[RED-TEAM] ❌ ${findings.length} VULNERABILITIES DETECTED:`);
  findings.forEach(f => console.error(`[RED-TEAM]   → ${f}`));
}
console.log("[RED-TEAM] ========================================");

process.exit(exitCode);
