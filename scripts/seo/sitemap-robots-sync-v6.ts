import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { MetadataRoute } from "next";
import { buildRobotsPolicy } from "../../app/robots";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const STATIC_ROBOTS_PATH = resolve(ROOT, "public/robots.txt");
const HEADER: readonly string[] = [];

function list(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export function renderRobotsTxt(policy: MetadataRoute.Robots = buildRobotsPolicy()): string {
  const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
  const lines: string[] = [...HEADER];
  for (const rule of rules) {
    for (const agent of list(rule.userAgent)) lines.push(`User-agent: ${agent}`);
    for (const allow of list(rule.allow)) lines.push(`Allow: ${allow}`);
    for (const disallow of list(rule.disallow)) lines.push(`Disallow: ${disallow}`);
    lines.push("");
  }
  for (const sitemap of list(policy.sitemap)) lines.push(`Sitemap: ${sitemap}`);
  if (policy.host) lines.push(`Host: ${policy.host}`);
  return `${lines.join("\n")}\n`;
}

export function validateStaticRobotsParity(actual: string, expected = renderRobotsTxt()): string[] {
  return actual === expected ? [] : ["INV-3.2 public/robots.txt drifted from app/robots.ts SSOT"];
}

function main(): void {
  const args = new Set(process.argv.slice(2));
  const expected = renderRobotsTxt();
  if (args.has("--write")) {
    writeFileSync(STATIC_ROBOTS_PATH, expected, "utf8");
    console.log("SEO_V6_ROBOTS_SYNC=WRITTEN");
    return;
  }
  const actual = readFileSync(STATIC_ROBOTS_PATH, "utf8");
  const blocks = validateStaticRobotsParity(actual, expected);
  for (const block of blocks) console.error(`BLOCK ${block}`);
  if (blocks.length > 0) process.exit(1);
  console.log(args.has("--dry-run") ? "SEO_V6_ROBOTS_SYNC=PASS_DRY_RUN" : "SEO_V6_ROBOTS_SYNC=PASS");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
