import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type CwvThresholds = { lcpP75Ms: number; inpP75Ms: number; clsP75: number };
type RawSeoConfig = { thresholds?: Partial<CwvThresholds> & Record<string, unknown> };
type CwvConfig = { thresholds: CwvThresholds };

export type FieldCwvInput = {
  sourceType: "field" | "lab";
  source: string;
  measuredAt: string;
  lcpP75Ms: number;
  inpP75Ms: number;
  clsP75: number;
  softNavigationInpIncluded?: boolean;
  remediationPr?: string | null;
};

export type FieldCwvResult = {
  status: "PASS" | "WARN" | "BLOCK" | "SKIP_NO_DATA";
  partial: boolean;
  confidence: "high" | "low";
  reason: string;
  thresholds: CwvThresholds;
  field: FieldCwvInput | null;
  breaches: string[];
};

function parseArgs(argv: string[]) {
  const value = (name: string) => {
    const index = argv.indexOf(name);
    return index >= 0 ? argv[index + 1] : undefined;
  };
  return {
    site: value("--site") ?? "cbamvalid",
    fieldJsonPath: value("--field-json"),
  };
}

function loadConfig(site: string): CwvConfig {
  const path = resolve(process.cwd(), "sites", site, "seo.config.json");
  const raw = JSON.parse(readFileSync(path, "utf8")) as RawSeoConfig;
  const thresholds = {
    lcpP75Ms: raw.thresholds?.lcpP75Ms,
    inpP75Ms: raw.thresholds?.inpP75Ms,
    clsP75: raw.thresholds?.clsP75,
  };
  for (const [name, value] of Object.entries(thresholds)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      throw new Error(`Phase 07 CWV config error: ${name} must be a non-negative finite number`);
    }
  }
  return { thresholds: thresholds as CwvThresholds };
}

function parseFieldInput(path?: string): FieldCwvInput | null {
  const raw = path
    ? readFileSync(resolve(process.cwd(), path), "utf8")
    : process.env.SEO_FIELD_CWV_JSON;
  if (!raw) return null;
  return JSON.parse(raw) as FieldCwvInput;
}

function validFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function evaluateFieldCwv(
  thresholds: CwvThresholds,
  field: FieldCwvInput | null,
): FieldCwvResult {
  if (!field) {
    return {
      status: "SKIP_NO_DATA",
      partial: true,
      confidence: "low",
      reason: "No CrUX/PSI field p75 dataset is connected; lab metrics are not substituted for field truth.",
      thresholds,
      field: null,
      breaches: [],
    };
  }
  if (field.sourceType !== "field") {
    return {
      status: "SKIP_NO_DATA",
      partial: true,
      confidence: "low",
      reason: `Input source ${field.source} is not field data; refusing lab-to-field substitution.`,
      thresholds,
      field: null,
      breaches: [],
    };
  }
  if (
    !field.source.trim() ||
    !field.measuredAt.trim() ||
    !validFinite(field.lcpP75Ms) ||
    !validFinite(field.inpP75Ms) ||
    !validFinite(field.clsP75)
  ) {
    throw new Error("Phase 07 CWV field input is incomplete or invalid");
  }

  const breaches: string[] = [];
  if (field.lcpP75Ms > thresholds.lcpP75Ms) breaches.push("LCP");
  if (field.inpP75Ms > thresholds.inpP75Ms) breaches.push("INP");
  if (field.clsP75 > thresholds.clsP75) breaches.push("CLS");

  if (breaches.length === 0) {
    return {
      status: "PASS",
      partial: false,
      confidence: "high",
      reason: "Field p75 CWV metrics are within configured thresholds.",
      thresholds,
      field,
      breaches,
    };
  }

  const remediationPr = field.remediationPr?.trim();
  if (!remediationPr) {
    return {
      status: "BLOCK",
      partial: false,
      confidence: "high",
      reason: `INV-7.2 ${breaches.join(", ")} field threshold exceeded without a remediation PR reference.`,
      thresholds,
      field,
      breaches,
    };
  }

  return {
    status: "WARN",
    partial: false,
    confidence: "high",
    reason: `Field threshold exceeded for ${breaches.join(", ")}; remediation is tracked at ${remediationPr}.`,
    thresholds,
    field,
    breaches,
  };
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const config = loadConfig(args.site);
    const field = parseFieldInput(args.fieldJsonPath);
    const result = evaluateFieldCwv(config.thresholds, field);
    console.log(`SEO_CWV_FIELD_RESULT=${JSON.stringify(result)}`);
    process.exitCode = result.status === "BLOCK" ? 1 : result.status === "WARN" ? 2 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 4;
  }
}

if (process.argv[1]?.endsWith("cwv-field-gate.ts")) {
  void main();
}
