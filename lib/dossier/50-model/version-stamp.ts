/**
 * Version stamp SSOT — templates never embed version literals.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface VersionStamp {
  readonly product: string;
  readonly schema: string;
  readonly ruleset: { readonly id: string; readonly sha256: string };
  readonly releaseIteration: number;
}

export const DOSSIER_SCHEMA_VERSION = "CBAMVALID-DOSSIER-5.0";
export const RULESET_ID = "EU-CBAM-DEFINITIVE-2026";

export function buildVersionStamp(releaseIteration: number, productVersion?: string): VersionStamp {
  const product =
    productVersion ||
    (() => {
      try {
        const pkg = JSON.parse(
          readFileSync(resolve(process.cwd(), "package.json"), "utf8")
        ) as { version?: string };
        return pkg.version || "0.0.0";
      } catch {
        return "0.0.0";
      }
    })();

  const rulesetCanonical = JSON.stringify({
    id: RULESET_ID,
    schema: DOSSIER_SCHEMA_VERSION,
    product,
  });
  const sha256 = createHash("sha256").update(rulesetCanonical).digest("hex");

  if (!Number.isInteger(releaseIteration) || releaseIteration < 1) {
    throw new Error(`INVALID_RELEASE_ITERATION:${releaseIteration}`);
  }

  return {
    product,
    schema: DOSSIER_SCHEMA_VERSION,
    ruleset: { id: RULESET_ID, sha256 },
    releaseIteration,
  };
}

export function releaseHistoryNarrative(iteration: number): string {
  if (iteration === 1) return "This is the first sealed release.";
  return `This sealed release is iteration ${iteration}. Prior sealed releases are listed below with hashes.`;
}
