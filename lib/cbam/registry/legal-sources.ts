export type LegalSourceType = "REGULATION" | "IMPLEMENTING_ACT" | "DELEGATED_ACT" | "GUIDANCE_DOCUMENT";
export type CbamPeriod = "TRANSITIONAL" | "DEFINITIVE";

export interface LegalSourceRecord {
  id: string;
  type: LegalSourceType;
  celexId: string;
  uri: string;
  title: string;
  period: CbamPeriod;
  effectiveDate: string;
  repealed: boolean;
  versionHash: string; // SHA-256 hash of the exact EUR-Lex payload
}

export const OFFICIAL_SOURCES: Record<string, LegalSourceRecord> = {
  // Original Regulation
  "REG_2023_956": {
    id: "REG_2023_956",
    type: "REGULATION",
    celexId: "32023R0956",
    uri: "https://eur-lex.europa.eu/eli/reg/2023/956/oj",
    title: "Regulation (EU) 2023/956 of the European Parliament and of the Council of 10 May 2023 establishing a carbon border adjustment mechanism",
    period: "TRANSITIONAL",
    effectiveDate: "2023-10-01",
    repealed: false,
    versionHash: "a1b2c3d4e5f6...", // Placeholder
  },
  // Transitional Implementing Act
  "IMPL_ACT_2023_1773": {
    id: "IMPL_ACT_2023_1773",
    type: "IMPLEMENTING_ACT",
    celexId: "32023R1773",
    uri: "https://eur-lex.europa.eu/eli/reg_impl/2023/1773/oj",
    title: "Implementing Regulation (EU) 2023/1773 for the transitional phase",
    period: "TRANSITIONAL",
    effectiveDate: "2023-10-01",
    repealed: true, // Replaced by definitive
    versionHash: "b2c3d4e5f6a1...",
  },
  // Definitive Implementing Act
  "IMPL_ACT_2025_2083": {
    id: "IMPL_ACT_2025_2083",
    type: "IMPLEMENTING_ACT",
    celexId: "32025R2083",
    uri: "https://eur-lex.europa.eu/eli/reg_impl/2025/2083/oj",
    title: "Implementing Regulation (EU) 2025/2083 for definitive period reporting",
    period: "DEFINITIVE",
    effectiveDate: "2026-01-01",
    repealed: false,
    versionHash: "c3d4e5f6a1b2...",
  },
  // Definitive Delegated Act
  "DEL_ACT_2025_2547": {
    id: "DEL_ACT_2025_2547",
    type: "DELEGATED_ACT",
    celexId: "32025R2547",
    uri: "https://eur-lex.europa.eu/eli/reg_del/2025/2547/oj",
    title: "Delegated Regulation (EU) 2025/2547 defining calculation methodology",
    period: "DEFINITIVE",
    effectiveDate: "2026-01-01",
    repealed: false,
    versionHash: "d4e5f6a1b2c3...",
  }
};
