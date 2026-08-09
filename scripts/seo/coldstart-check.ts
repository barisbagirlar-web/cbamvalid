import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ExitCode, isObject, parseJsonFile } from "./preflight";

export function evaluateColdStart(gscDataDays: number, minDataDays: number): boolean {
  if (!Number.isInteger(gscDataDays) || gscDataDays < 0) throw new Error("gscDataDays must be a non-negative integer");
  if (!Number.isInteger(minDataDays) || minDataDays < 1) throw new Error("minDataDays must be a positive integer");
  return gscDataDays < minDataDays;
}

function parseArgs(argv: string[]): { site: string | null; gscDays: number | null; dryRun: boolean } {
  let site: string | null = null;
  let gscDays: number | null = null;
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--site") site = argv[index + 1] ?? null;
    if (argv[index] === "--gsc-days") {
      const raw = argv[index + 1];
      if (raw !== undefined && /^\d+$/.test(raw)) gscDays = Number.parseInt(raw, 10);
    }
    if (argv[index] === "--dry-run") dryRun = true;
  }
  if (gscDays === null && process.env.GSC_DATA_DAYS && /^\d+$/.test(process.env.GSC_DATA_DAYS)) {
    gscDays = Number.parseInt(process.env.GSC_DATA_DAYS, 10);
  }
  return { site, gscDays, dryRun };
}

export function runColdStartCheck(argv: string[]): ExitCode {
  const args = parseArgs(argv);
  if (!args.site) {
    console.error("COLDSTART_CONFIG_ERROR --site is required");
    return ExitCode.CONFIG;
  }
  const raw = parseJsonFile(`sites/${args.site}/seo.config.json`);
  if (!isObject(raw) || !isObject(raw.site) || raw.site.siteId !== args.site || !isObject(raw.thresholds)) {
    console.error("COLDSTART_CONFIG_ERROR invalid site configuration");
    return ExitCode.CONFIG;
  }
  const threshold = raw.thresholds.coldStartMinDataDays;
  if (!Number.isInteger(threshold) || (threshold as number) < 1) {
    console.error("COLDSTART_CONFIG_ERROR thresholds.coldStartMinDataDays must be a positive integer");
    return ExitCode.CONFIG;
  }
  if (args.gscDays === null) {
    console.error("COLDSTART_MISSING_DATA GSC history length is not available; coldStart cannot be inferred");
    return ExitCode.MISSING_DATA;
  }
  const coldStart = evaluateColdStart(args.gscDays, threshold as number);
  const confidence = coldStart ? "low" : "high";
  console.log(`COLDSTART_CHECK=PASS site=${args.site} gscDataDays=${args.gscDays} thresholdRef=thresholds.coldStartMinDataDays coldStart=${String(coldStart)} confidence=${confidence} dryRun=${String(args.dryRun)}`);
  return ExitCode.PASS;
}

const isMainModule = process.argv[1] ? resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
if (isMainModule) process.exitCode = runColdStartCheck(process.argv.slice(2));
