/**
 * Evidence class admissibility + independence / diversity rules (WP-07).
 */
export type EvidenceClass =
  | "LEGAL_IDENTITY"
  | "EORI"
  | "CN_CLASSIFICATION"
  | "PRODUCTION_VOLUME"
  | "DIRECT_EMISSIONS"
  | "ELECTRICITY"
  | "GRID_FACTOR"
  | "METERING_CALIBRATION"
  | "SUPPLEMENTARY_NOTE";

export const MAX_REQUIREMENT_CLASSES_PER_DOCUMENT = 3;

/** Minimum distinct evidence documents for Evidence dimension to reach 100%. */
export function minDistinctEvidenceForFullScore(requirementCount: number): number {
  return Math.max(5, Math.ceil(0.4 * requirementCount));
}

const TXT_ONLY_AS_SUPPLEMENT = new Set(["text/plain", "text/txt"]);

const ADMISSIBLE_MIME: Record<EvidenceClass, readonly string[]> = {
  LEGAL_IDENTITY: ["application/pdf", "image/jpeg", "image/png"],
  EORI: ["application/pdf", "image/jpeg", "image/png"],
  CN_CLASSIFICATION: ["application/pdf", "image/jpeg", "image/png"],
  PRODUCTION_VOLUME: [
    "application/pdf",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ],
  DIRECT_EMISSIONS: [
    "application/pdf",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ELECTRICITY: ["application/pdf", "image/jpeg", "image/png", "text/csv"],
  GRID_FACTOR: ["application/pdf", "text/html", "text/csv"],
  METERING_CALIBRATION: ["application/pdf"],
  SUPPLEMENTARY_NOTE: ["text/plain", "application/pdf"],
};

export function requirementClassForPath(inputPath: string): EvidenceClass {
  if (inputPath.includes("eoriNumber") || inputPath.includes("EORI")) return "EORI";
  if (inputPath.includes("cnCode")) return "CN_CLASSIFICATION";
  if (inputPath.includes("productionVolume")) return "PRODUCTION_VOLUME";
  if (inputPath.includes("directEmissions") && !inputPath.includes("precursors")) return "DIRECT_EMISSIONS";
  if (inputPath.includes("electricityConsumed")) return "ELECTRICITY";
  if (inputPath.includes("gridEmissionFactor")) return "GRID_FACTOR";
  if (
    inputPath.includes("legalName") ||
    inputPath.includes("address") ||
    inputPath.includes("installation.name")
  ) {
    return "LEGAL_IDENTITY";
  }
  if (inputPath.includes("calibration") || inputPath.includes("meter")) return "METERING_CALIBRATION";
  return "SUPPLEMENTARY_NOTE";
}

export function isMimeAdmissible(evidenceClass: EvidenceClass, mimeType: string): boolean {
  const mime = (mimeType || "").toLowerCase().split(";")[0].trim();
  const allowed = ADMISSIBLE_MIME[evidenceClass];
  if (TXT_ONLY_AS_SUPPLEMENT.has(mime) && evidenceClass !== "SUPPLEMENTARY_NOTE") {
    return false;
  }
  return allowed.includes(mime);
}

export function assessSingleSourceConcentration(
  evidenceIdToClasses: Map<string, Set<EvidenceClass>>,
  maxClasses: number = MAX_REQUIREMENT_CLASSES_PER_DOCUMENT
): { concentratedIds: string[]; finding: boolean } {
  const concentratedIds: string[] = [];
  for (const [id, classes] of evidenceIdToClasses) {
    if (classes.size > maxClasses) concentratedIds.push(id);
  }
  return { concentratedIds, finding: concentratedIds.length > 0 };
}

export function assessEvidenceDiversity(
  distinctDocumentCount: number,
  requirementCount: number
): { fullScoreAllowed: boolean; minimumRequired: number } {
  const minimumRequired = minDistinctEvidenceForFullScore(requirementCount);
  return {
    fullScoreAllowed: distinctDocumentCount >= minimumRequired,
    minimumRequired,
  };
}
