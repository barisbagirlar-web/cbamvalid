import { CbamSector } from "../sectors/sector-adapter";
import { determineApplicability } from "../engine/applicability-engine";

export type ReadinessStatus =
  | "DRAFT"
  | "DATA_INCOMPLETE"
  | "CALCULATION_READY"
  | "PAYMENT_ELIGIBLE"
  | "REPORT_SEAL_ELIGIBLE"
  | "BLOCKED";

export interface EvidenceGapItem {
  itemName: string;
  severity: "Critical" | "Warning" | "Informational";
  whyItMatters: string;
  whereToObtain: string;
  acceptableSubstitute: string;
  blocksPayment: boolean;
  blocksSealing: boolean;
}

export interface ReadinessAssessment {
  status: ReadinessStatus;
  sector: CbamSector | "UNKNOWN";
  dataCompletenessPercentage: number;
  evidenceCompletenessPercentage: number;
  missingEvidenceCount: number;
  gapAnalysis: EvidenceGapItem[];
  isEligibleForPayment: boolean;
  isEligibleForSealing: boolean;
  remediationMessage?: string;
}

/**
 * Assesses exporter case inputs to calculate data completeness, missing evidence gaps, and payment eligibility
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function assessCaseReadiness(data: Record<string, any>): ReadinessAssessment {
  const gaps: EvidenceGapItem[] = [];
  let filledFields = 0;
  let totalFields = 0;

  const checkField = (val: unknown) => {
    totalFields++;
    if (val !== undefined && val !== null && val !== "" && val !== 0) {
      filledFields++;
      return true;
    }
    return false;
  };

  // Critical inputs check
  const hasExporterName = checkField(data.exporterName);
  const hasEori = checkField(data.declarantEORI);
  checkField(data.cnCode);
  const hasInstallationName = checkField(data.installationName);
  const hasProductionVolume = checkField(data.productionVolume);
  checkField(data.importYear);
  checkField(data.importQuarter);
  checkField(data.role);

  // Sector identification
  let sector: CbamSector | "UNKNOWN" = "UNKNOWN";
  if (data.cnCode && data.cnCode.length >= 2) {
    const chapter = data.cnCode.substring(0, 2);
    if (["72", "73"].includes(chapter)) sector = "IRON_AND_STEEL";
    else if (chapter === "76") sector = "ALUMINIUM";
    else if (chapter === "25") sector = "CEMENT";
    else if (chapter === "31") sector = "FERTILISERS";
    else if (chapter === "28") sector = "HYDROGEN";
    else if (chapter === "27") sector = "ELECTRICITY";
    else sector = "DOWNSTREAM_COMPLEX_GOODS";
  }

  // Validate CN scope
  let cnScopeValid = false;
  if (data.cnCode) {
    const app = determineApplicability({
      cnCode: data.cnCode,
      totalMassTonnes: Number(data.productionVolume || 0),
      role: data.role || "IMPORTER",
    });
    cnScopeValid = app.isApplicable;
  }

  // Sector-specific fields
  if (sector === "IRON_AND_STEEL" || sector === "ALUMINIUM" || sector === "DOWNSTREAM_COMPLEX_GOODS") {
    checkField(data.isComplexGood);
    if (data.isComplexGood) {
      checkField(data.precursorDirectEmissions);
      checkField(data.precursorIndirectEmissions);
    }
  }

  if (data.hasActualData) {
    checkField(data.directEmissions);
    checkField(data.electricityConsumed);
    checkField(data.gridEmissionFactor);
  }

  if (data.carbonPricePaid > 0) {
    checkField(data.carbonPricePaid);
  }

  const dataCompletenessPercentage = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;

  // Evidence Gap Assessment
  if (!hasExporterName) {
    gaps.push({
      itemName: "Exporter Legal Corporate Profile",
      severity: "Critical",
      whyItMatters: "Exporter credentials must match the shipping commercial invoice to establish provenance.",
      whereToObtain: "Corporate Registry or tax certification statement.",
      acceptableSubstitute: "Trade association registration license.",
      blocksPayment: true,
      blocksSealing: true,
    });
  }

  if (!hasEori) {
    gaps.push({
      itemName: "Declarant EORI Reference",
      severity: "Critical",
      whyItMatters: "The EU buyer cannot submit the data packet without a valid declarant registration code.",
      whereToObtain: "EU Customs Tariff authorization profile or EORI registry.",
      acceptableSubstitute: "Authorized agent representation letter.",
      blocksPayment: true,
      blocksSealing: true,
    });
  }

  if (!cnScopeValid) {
    gaps.push({
      itemName: "CBAM Applicable Goods Scope Classification",
      severity: "Critical",
      whyItMatters: "The provided CN classification code is not subject to current carbon border tax regulations.",
      whereToObtain: "Customs declaration documents, commercial invoices, or tariff code registries.",
      acceptableSubstitute: "Supplier material test classification files.",
      blocksPayment: true,
      blocksSealing: true,
    });
  }

  if (!hasInstallationName) {
    gaps.push({
      itemName: "Installation Facility Profile",
      severity: "Critical",
      whyItMatters: "Direct process emissions must be anchored to a specific production facility.",
      whereToObtain: "Production permit licenses or factory registry statement.",
      acceptableSubstitute: "ISO 14001 or equivalent environmental management certificate.",
      blocksPayment: true,
      blocksSealing: true,
    });
  }

  if (!hasProductionVolume) {
    gaps.push({
      itemName: "Installation Net Production Mass Volume",
      severity: "Critical",
      whyItMatters: "Embedded specific emissions ratios are calculated by dividing emissions over total net production volume.",
      whereToObtain: "Signed plant output statistics logs or ERP records.",
      acceptableSubstitute: "Independent production report statements.",
      blocksPayment: true,
      blocksSealing: true,
    });
  }

  if (data.hasActualData && !data.isVerified) {
    gaps.push({
      itemName: "Accredited Independent Verification Report",
      severity: "Warning",
      whyItMatters: "Unverified actual emissions data triggers verification warnings under EU Registry guidelines.",
      whereToObtain: "Contract an accredited environmental verifier for site inspection audits.",
      acceptableSubstitute: "National grid/agency signed energy and emission receipts.",
      blocksPayment: false,
      blocksSealing: false,
    });
  }

  if (data.isComplexGood && (!data.precursorDirectEmissions && !data.precursorIndirectEmissions)) {
    gaps.push({
      itemName: "Precursor Materials Declaration Sheet",
      severity: "Critical",
      whyItMatters: "Complex goods require input material trace records to prevent carbon omission leaks.",
      whereToObtain: "Ask suppliers for direct precursor declarations or material supply invoices.",
      acceptableSubstitute: "Official default values mapped to precursors category.",
      blocksPayment: true,
      blocksSealing: true,
    });
  }

  if (data.carbonPricePaid > 0) {
    gaps.push({
      itemName: "Carbon Pricing Scheme Payment Proof",
      severity: "Warning",
      whyItMatters: "Claimed price deductions must be supported by official receipts of carbon tax payments.",
      whereToObtain: "Ministry of Finance receipts, local ETS trade auction clearing statements.",
      acceptableSubstitute: "Environmental tax clearance certificate.",
      blocksPayment: false,
      blocksSealing: false,
    });

    if (!data.isVerified) {
      gaps.push({
        itemName: "Verified Carbon Price Evidence",
        severity: "Warning",
        whyItMatters: "Unverified carbon price paid evidence cannot be applied to reduce CBAM certificates due until verified by an accredited independent verifier.",
        whereToObtain: "Contract an accredited environmental verifier for site inspection audits.",
        acceptableSubstitute: "Local tax clearance certificate.",
        blocksPayment: false,
        blocksSealing: false,
      });
    }
  }

  const criticalGaps = gaps.filter((g) => g.blocksPayment);
  const sealingGaps = gaps.filter((g) => g.blocksSealing);

  const isEligibleForPayment = criticalGaps.length === 0;
  const isEligibleForSealing = sealingGaps.length === 0;

  // Determine readiness status state
  let status: ReadinessStatus = "DRAFT";
  if (gaps.length > 0) {
    status = isEligibleForPayment ? "PAYMENT_ELIGIBLE" : "DATA_INCOMPLETE";
  } else {
    status = "REPORT_SEAL_ELIGIBLE";
  }

  if (!cnScopeValid) {
    status = "BLOCKED";
  }

  const missingEvidenceCount = gaps.length;
  const evidenceCompletenessPercentage = gaps.length > 0 ? Math.round(((8 - gaps.length) / 8) * 100) : 100;

  return {
    status,
    sector,
    dataCompletenessPercentage,
    evidenceCompletenessPercentage,
    missingEvidenceCount,
    gapAnalysis: gaps,
    isEligibleForPayment,
    isEligibleForSealing,
    remediationMessage: isEligibleForPayment
      ? "Case data checks complete. Ready for entitlement sealing prepayment preview."
      : `Missing critical inputs: ${criticalGaps.map((g) => g.itemName).join(", ")}. Please complete these fields.`,
  };
}
