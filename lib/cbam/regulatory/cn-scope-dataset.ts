export interface CNDatasetRecord {
  cnCode: string;
  description: string;
  sector: "STEEL" | "ALUMINIUM" | "CEMENT" | "FERTILIZER" | "ELECTRICITY" | "HYDROGEN";
  legalSource: string;
  effectiveDate: string;
  datasetVersion: string;
}

export interface CNResolutionResult {
  inScope: boolean;
  sector: "STEEL" | "ALUMINIUM" | "CEMENT" | "FERTILIZER" | "ELECTRICITY" | "HYDROGEN" | "UNKNOWN";
  record?: CNDatasetRecord;
  reason: "IN_SCOPE" | "OUT_OF_SCOPE" | "ADVISORY_REVIEW" | "SOURCE_REQUIRED" | "MALFORMED";
}

export const OFFICIAL_CN_SCOPE_DATASET: CNDatasetRecord[] = [
  // Cement
  { cnCode: "2523", description: "Portland cement, aluminous cement, slag cement, supersulphate cement and similar hydraulic cements", sector: "CEMENT", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  // Electricity
  { cnCode: "27160000", description: "Electrical energy", sector: "ELECTRICITY", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  // Hydrogen
  { cnCode: "28041000", description: "Hydrogen", sector: "HYDROGEN", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  // Fertilizers
  { cnCode: "28080000", description: "Nitric acid; sulphonitric acids", sector: "FERTILIZER", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "2814", description: "Ammonia, anhydrous or in aqueous solution", sector: "FERTILIZER", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "28271000", description: "Ammonium chloride", sector: "FERTILIZER", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "3102", description: "Mineral or chemical fertilisers, nitrogenous", sector: "FERTILIZER", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "3105", description: "Mineral or chemical fertilisers containing two or three of the fertilising elements nitrogen, phosphorus and potassium (excluding 3105 60 00)", sector: "FERTILIZER", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  // Iron and Steel
  { cnCode: "72", description: "Iron and steel (excluding certain subheadings)", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7301", description: "Sheet piling of iron or steel", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7302", description: "Railway or tramway track construction material of iron or steel", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7303", description: "Tubes, pipes and hollow profiles, of cast iron", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7304", description: "Tubes, pipes and hollow profiles, seamless, of iron or steel", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7305", description: "Other tubes and pipes of iron or steel", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7306", description: "Other tubes, pipes and hollow profiles of iron or steel", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7307", description: "Tube or pipe fittings of iron or steel", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7308", description: "Structures and parts of structures of iron or steel", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7309", description: "Reservoirs, tanks, vats and similar containers of iron or steel, capacity > 300l", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7310", description: "Tanks, casks, drums, cans, boxes and similar containers of iron or steel, capacity <= 300l", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7311", description: "Containers for compressed or liquefied gas, of iron or steel", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7318", description: "Screws, bolts, nuts, coach screws, screw hooks, rivets, cotters, cotter pins, washers of iron or steel", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7326", description: "Other articles of iron or steel", sector: "STEEL", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  // Aluminium
  { cnCode: "7601", description: "Unwrought aluminium", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7603", description: "Aluminium powders and flakes", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7604", description: "Aluminium bars, rods and profiles", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7605", description: "Aluminium wire", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7606", description: "Aluminium plates, sheets and strip, thickness > 0.2mm", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7607", description: "Aluminium foil, thickness <= 0.2mm", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7608", description: "Aluminium tubes and pipes", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7609", description: "Aluminium tube or pipe fittings", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7610", description: "Aluminium structures and parts of structures", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7611", description: "Aluminium reservoirs, tanks, vats, capacity > 300l", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7612", description: "Aluminium casks, drums, cans, boxes, capacity <= 300l", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7613", description: "Aluminium containers for compressed or liquefied gas", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7614", description: "Stranded wire, cables, plaited bands and the like, of aluminium", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
  { cnCode: "7616", description: "Other articles of aluminium", sector: "ALUMINIUM", legalSource: "Regulation (EU) 2023/956, Annex I", effectiveDate: "2023-10-01", datasetVersion: "v1.0.0" },
];

export function resolveCNCodeScope(cnCode: string): CNResolutionResult {
  if (!cnCode || typeof cnCode !== "string") {
    return { inScope: false, sector: "UNKNOWN", reason: "MALFORMED" };
  }
  const cleanCode = cnCode.replace(/\s+/g, "");
  if (!/^\d{8}$/.test(cleanCode)) {
    return { inScope: false, sector: "UNKNOWN", reason: "MALFORMED" };
  }

  // Explicitly exclude 31056000
  if (cleanCode === "31056000") {
    return { inScope: false, sector: "UNKNOWN", reason: "OUT_OF_SCOPE" };
  }

  // Find matching record with longest prefix matching
  let bestMatch: CNDatasetRecord | undefined;
  for (const record of OFFICIAL_CN_SCOPE_DATASET) {
    if (cleanCode.startsWith(record.cnCode)) {
      if (!bestMatch || record.cnCode.length > bestMatch.cnCode.length) {
        bestMatch = record;
      }
    }
  }

  if (bestMatch) {
    return {
      inScope: true,
      sector: bestMatch.sector,
      record: bestMatch,
      reason: "IN_SCOPE",
    };
  }

  // Downstream complex goods logic check:
  // If it starts with covered materials chapters but isn't listed, it is ADVISORY_REVIEW
  const chapter = cleanCode.substring(0, 2);
  const coveredChapters = ["72", "73", "76", "25", "27", "28", "31"];
  
  if (coveredChapters.includes(chapter)) {
    return {
      inScope: false,
      sector: "UNKNOWN",
      reason: "ADVISORY_REVIEW",
    };
  }

  // Unlisted downstream containing materials (machinery/vehicles 84, 85, 87)
  if (["84", "85", "87"].includes(chapter)) {
    return {
      inScope: false,
      sector: "UNKNOWN",
      reason: "SOURCE_REQUIRED",
    };
  }

  return {
    inScope: false,
    sector: "UNKNOWN",
    reason: "OUT_OF_SCOPE",
  };
}
