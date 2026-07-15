export interface RegulatorySource {
  sourceId: string;
  authority: "EU_COMMISSION" | "EUR_LEX" | "TARIC";
  canonicalUrl: string;
  sourceType: "HTML" | "XLSX" | "PDF" | "LEGAL_ACT";
  legalReference?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  publicationCadence:
    | "EVENT_DRIVEN"
    | "DAILY_CHECK"
    | "QUARTERLY_2026"
    | "WEEKLY_FROM_2027";
  parserVersion: string;
  active: boolean;
}

export const SOURCE_REGISTRY: RegulatorySource[] = [
  {
    sourceId: "EU_2023_956",
    authority: "EUR_LEX",
    canonicalUrl: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32023R0956",
    sourceType: "LEGAL_ACT",
    publicationCadence: "EVENT_DRIVEN",
    parserVersion: "1.0",
    active: true,
  },
];
