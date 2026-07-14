export interface RegulatorySource {
  sourceId: string;
  title: string;
  issuingBody: string;
  canonicalOfficialUrl: string;
  documentType: string;
  publicationDate: string;
  effectiveDate: string;
  lastCheckedAt: string;
  version: string;
  applicability: string;
  supersedes?: string;
  status: "active" | "deprecated" | "draft";
  notes?: string;
}

export const regulatorySources: Record<string, RegulatorySource> = {
  "eu-2023-1773": {
    sourceId: "eu-2023-1773",
    title: "Implementing Regulation (EU) 2023/1773",
    issuingBody: "European Commission",
    canonicalOfficialUrl: "https://eur-lex.europa.eu/eli/reg_impl/2023/1773/oj",
    documentType: "Implementing Regulation",
    publicationDate: "2023-09-15",
    effectiveDate: "2023-10-01",
    lastCheckedAt: new Date().toISOString().split("T")[0],
    version: "1.0",
    applicability: "Rules for the reporting of embedded emissions during the transitional period.",
    status: "active",
    notes: "Primary source for the transitional reporting methodology."
  },
  "eu-default-values": {
    sourceId: "eu-default-values",
    title: "Default Values for the Transitional Period",
    issuingBody: "European Commission - DG TAXUD",
    canonicalOfficialUrl: "https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en",
    documentType: "Guidance Document",
    publicationDate: "2023-12-22",
    effectiveDate: "2024-01-01",
    lastCheckedAt: new Date().toISOString().split("T")[0],
    version: "2023-12",
    applicability: "Used strictly when actual verified data is unavailable.",
    status: "active"
  }
};
