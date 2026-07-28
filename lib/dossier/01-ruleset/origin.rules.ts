/**
 * Country-of-origin scope — hard gate for CBAM applicability.
 * EU-27 = intra-EU trade (out of scope).
 * Annex III parties integrated into the EU carbon market = excluded.
 *
 * [MISSING] Additional Annex III territories beyond ISO-2 states must be
 * transcribed from Regulation (EU) 2023/956 Annex III by a human — do not guess.
 */
import type { RegulationKey } from "./regulations.registry";

export const EU27 = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
  "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
] as const;

export type Eu27Code = (typeof EU27)[number];

/**
 * Confirmed Annex III country ISO-2 codes from Regulation (EU) 2023/956.
 * Territories (non-ISO-2 named places) are intentionally omitted until human-verified.
 */
export const ANNEX_III_EXCLUDED: readonly string[] = ["IS", "LI", "NO", "CH"];

export type OriginScope =
  | { readonly inScope: true }
  | {
      readonly inScope: false;
      readonly code: "EU_INTERNAL" | "ANNEX_III_EXCLUDED" | "INVALID_ISO2";
      readonly legalBasis: readonly RegulationKey[];
      readonly plainLanguage: string;
    };

const EU27_SET = new Set<string>(EU27);
const ANNEX_III_SET = new Set(ANNEX_III_EXCLUDED);

export function assessOrigin(iso2Raw: string): OriginScope {
  const iso2 = String(iso2Raw || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso2)) {
    return {
      inScope: false,
      code: "INVALID_ISO2",
      legalBasis: ["CBAM_BASE"],
      plainLanguage:
        "Installation country of origin must be a two-letter ISO 3166-1 alpha-2 code.",
    };
  }
  if (EU27_SET.has(iso2)) {
    return {
      inScope: false,
      code: "EU_INTERNAL",
      legalBasis: ["CBAM_BASE"],
      plainLanguage:
        `Country of origin ${iso2} is an EU Member State. Intra-EU movements are outside CBAM scope. CBAM applies to goods originating in third countries.`,
    };
  }
  if (ANNEX_III_SET.has(iso2)) {
    return {
      inScope: false,
      code: "ANNEX_III_EXCLUDED",
      legalBasis: ["CBAM_BASE"],
      plainLanguage:
        `Country of origin ${iso2} is listed in Annex III of Regulation (EU) 2023/956 (countries and territories excluded from CBAM). Dossier generation is refused.`,
    };
  }
  return { inScope: true };
}

export function assertOriginInScope(iso2: string): void {
  const scope = assessOrigin(iso2);
  if (!scope.inScope) {
    throw new Error(`CBAM_ORIGIN_OUT_OF_SCOPE:${scope.code}:${iso2}`);
  }
}
