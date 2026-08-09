import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../../", import.meta.url)));
const REGISTRY_PATH = resolve(ROOT, "data/seo/registry/cbamvalid_seo_registry.json");
const NEXT_CONFIG_PATH = resolve(ROOT, "next.config.js");
const requireFromHere = createRequire(import.meta.url);

type NextConfigVariantControls = {
  trailingSlash?: boolean;
  skipTrailingSlashRedirect?: boolean;
};

type RouteRecord = {
  route: string;
  status: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateRouteVariants(
  routes: string[],
  controls: NextConfigVariantControls = {},
): string[] {
  const blocks: string[] = [];
  const seenCaseFolded = new Map<string, string>();

  for (const route of routes) {
    if (!route.startsWith("/")) {
      blocks.push(`INV-2.5 invalid route ${route}`);
      continue;
    }
    if (route !== "/" && route.endsWith("/")) blocks.push(`INV-2.5 trailing-slash canonical route recorded ${route}`);
    if (route !== route.toLowerCase()) blocks.push(`INV-2.5 mixed-case canonical route recorded ${route}`);
    const folded = route.toLowerCase();
    const previous = seenCaseFolded.get(folded);
    if (previous && previous !== route) blocks.push(`INV-2.5 case-fold duplicate routes ${previous} and ${route}`);
    seenCaseFolded.set(folded, route);
  }

  if (controls.trailingSlash === true) blocks.push("INV-2.5 trailingSlash=true conflicts with the non-trailing canonical route inventory");
  if (controls.skipTrailingSlashRedirect === true) blocks.push("INV-2.5 skipTrailingSlashRedirect=true disables automatic slash-variant normalization");

  return [...new Set(blocks)].sort();
}

export function loadLiveRegistryRoutes(input: unknown): string[] {
  if (!isObject(input) || !isObject(input.data) || !Array.isArray(input.data.records)) throw new Error("registry artifact shape invalid");
  const routes: string[] = [];
  input.data.records.forEach((record, index) => {
    if (!isObject(record) || typeof record.route !== "string" || typeof record.status !== "string") throw new Error(`registry record[${index}] invalid`);
    const row = record as unknown as RouteRecord;
    if (row.status === "live") routes.push(row.route);
  });
  return routes.sort();
}

export function runVariantAudit(): string[] {
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as unknown;
  const routes = loadLiveRegistryRoutes(registry);
  const nextRaw: unknown = requireFromHere(NEXT_CONFIG_PATH);
  if (!isObject(nextRaw)) throw new Error("next.config.js invalid");
  return validateRouteVariants(routes, {
    trailingSlash: typeof nextRaw.trailingSlash === "boolean" ? nextRaw.trailingSlash : undefined,
    skipTrailingSlashRedirect: typeof nextRaw.skipTrailingSlashRedirect === "boolean" ? nextRaw.skipTrailingSlashRedirect : undefined,
  });
}

function main(): void {
  const blocks = runVariantAudit();
  for (const block of blocks) console.error(`BLOCK ${block}`);
  if (blocks.length > 0) process.exit(1);
  console.log("SEO_V6_PHASE2_VARIANTS=PASS");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
