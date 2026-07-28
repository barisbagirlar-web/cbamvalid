/**
 * Legal act registry — SSOT for every citation in dossier artifacts.
 * Fields marked null are [MISSING] pending human EUR-Lex transcription.
 * gate:legal-refs must fail closed when a cited entry has null celex/eli/oj.
 */

export type RegulationKey =
  | "CBAM_BASE"
  | "IR_VERIFICATION"
  | "IR_METHODOLOGY"
  | "IR_FREE_ALLOCATION"
  | "IR_DEFAULT_VALUES"
  | "ETS_MRV";

export interface RegulationEntry {
  readonly key: RegulationKey;
  readonly short: string;
  readonly role: string;
  readonly celex: string | null;
  readonly eli: string | null;
  readonly oj: string | null;
  readonly adopted: string | null;
}

export const REGULATIONS = {
  CBAM_BASE: {
    key: "CBAM_BASE",
    short: "Regulation (EU) 2023/956",
    celex: "32023R0956",
    eli: "http://data.europa.eu/eli/reg/2023/956/oj",
    oj: "OJ L 130, 16.5.2023, p. 52",
    adopted: "2023-05-10",
    role: "CBAM framework regulation; Annex I goods scope; Annex II direct-only sectors; Annex III excluded origins",
  },
  IR_VERIFICATION: {
    key: "IR_VERIFICATION",
    short: "Commission Implementing Regulation (EU) 2025/2546",
    celex: "32025R2546",
    eli: "http://data.europa.eu/eli/reg_impl/2025/2546/oj",
    oj: "OJ L, 2025/2546, 22.12.2025",
    adopted: "2025-12-10",
    role: "Verification principles and requirements; accredited verifier obligations",
  },
  IR_METHODOLOGY: {
    key: "IR_METHODOLOGY",
    short: "Commission Implementing Regulation (EU) 2025/2547",
    adopted: "2025-12-10",
    celex: "32025R2547",
    eli: "http://data.europa.eu/eli/reg_impl/2025/2547/oj",
    oj: "OJ L, 2025/2547, 22.12.2025",
    role: "Methods for the calculation of emissions embedded in goods",
  },
  IR_FREE_ALLOCATION: {
    key: "IR_FREE_ALLOCATION",
    short: "Commission Implementing Regulation (EU) 2025/2620",
    /** [MISSING] Confirm CELEX/ELI/OJ from EUR-Lex before citing in sealed packages. */
    celex: null,
    eli: null,
    oj: null,
    adopted: null,
    role: "Free allocation adjustment to CBAM certificates to be surrendered",
  },
  IR_DEFAULT_VALUES: {
    key: "IR_DEFAULT_VALUES",
    short: "Commission Implementing Regulation (EU) 2025/2621",
    /** [MISSING] Confirm CELEX/ELI/OJ from EUR-Lex before citing in sealed packages. */
    celex: null,
    eli: null,
    oj: null,
    adopted: null,
    role: "Default values and mark-ups",
  },
  ETS_MRV: {
    key: "ETS_MRV",
    short: "Commission Implementing Regulation (EU) 2018/2066",
    celex: "32018R2066",
    eli: "http://data.europa.eu/eli/reg_impl/2018/2066/oj",
    oj: null,
    adopted: null,
    role: "EU ETS monitoring and reporting methodology; basis for CBAM tiers",
  },
} as const satisfies Record<RegulationKey, RegulationEntry>;

export function cite(key: RegulationKey, article?: string): string {
  const entry = REGULATIONS[key];
  if (!entry) throw new Error(`UNKNOWN_REGULATION_KEY:${key}`);
  return article ? `${entry.short}, ${article}` : entry.short;
}

export function citeWithRole(key: RegulationKey): { citation: string; role: string; complete: boolean } {
  const entry = REGULATIONS[key];
  const complete = entry.celex !== null && entry.eli !== null;
  return { citation: entry.short, role: entry.role, complete };
}

/** Cover-page applicable act stack (only entries with complete bibliographic fields). */
export function applicableActStack(): ReadonlyArray<{ key: RegulationKey; short: string; role: string }> {
  return (Object.keys(REGULATIONS) as RegulationKey[])
    .map((key) => REGULATIONS[key])
    .filter((e) => e.celex !== null && e.eli !== null)
    .map((e) => ({ key: e.key, short: e.short, role: e.role }));
}

export function assertCitationComplete(key: RegulationKey): void {
  const entry = REGULATIONS[key];
  if (entry.celex === null || entry.eli === null) {
    throw new Error(`LEGAL_REF_INCOMPLETE:${key}`);
  }
}
