import { Decimal } from "decimal.js";
import { AuditReadyCase, InputDatum } from "../schema";

export type QualityControlStatus = "PASS" | "WARNING" | "BLOCKER" | "NOT_APPLICABLE";

export interface QualityControlResult {
  ruleId: string;
  name: string;
  status: QualityControlStatus;
  message?: string;
  remediationCode?: string;
}

const ALLOCATION_TOLERANCE = new Decimal("0.000001");

function decimal(value: unknown): Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const parsed = new Decimal(value as Decimal.Value);
    return parsed.isFinite() ? parsed : null;
  } catch {
    return null;
  }
}

function finiteNonNegative(value: unknown): boolean {
  const parsed = decimal(value);
  return parsed !== null && parsed.gte(0);
}

function finitePositive(value: unknown): boolean {
  const parsed = decimal(value);
  return parsed !== null && parsed.gt(0);
}

function unitOf(datum: InputDatum, fallback: string): string {
  return datum.canonicalUnit || datum.rawUnit || fallback;
}

function supportedEvidence(caseData: AuditReadyCase, path: string, datum: InputDatum): boolean {
  if (!datum.evidenceId) return false;
  const record = caseData.evidenceRegister.find((item) => item.evidenceId === datum.evidenceId);
  return Boolean(
    record &&
    record.linkedInputs.includes(path) &&
    record.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/`) &&
    /^[a-f0-9]{64}$/i.test(record.fileHash) &&
    record.sizeBytes > 0 &&
    record.reviewStatus === "APPROVED" &&
    (record.supportStatus === "SUPPORTED" || record.supportStatus === "PARTIALLY_SUPPORTED")
  );
}

function hasAcceptedMethodologyDecision(caseData: AuditReadyCase, topic: string): boolean {
  return caseData.methodologyDecisions.some((decision) =>
    decision.topic === topic &&
    decision.reviewStatus === "ACCEPTED" &&
    decision.reason.trim().length > 0 &&
    decision.legalOrTechnicalBasis.trim().length > 0 &&
    decision.rulesetVersion.trim().length > 0 &&
    decision.evidenceIds.every((evidenceId) =>
      caseData.evidenceRegister.some((evidence) => evidence.evidenceId === evidenceId)
    )
  );
}

export function runQualityControls(caseData: AuditReadyCase): QualityControlResult[] {
  const results: QualityControlResult[] = [];
  const add = (ruleId: string, name: string, status: QualityControlStatus, message?: string, remediationCode?: string) => {
    results.push({ ruleId, name, status, message, remediationCode });
  };

  const identityFields = [
    String(caseData.exporterIdentity.legalName.value || "").trim(),
    String(caseData.installation.name.value || "").trim(),
    String(caseData.installation.country.value || "").trim(),
    String(caseData.installation.productionRoute.value || "").trim(),
    String(caseData.installation.systemBoundaries || "").trim(),
  ];
  add(
    "QC_00",
    "Operator, installation and system-boundary identity",
    identityFields.every(Boolean) ? "PASS" : "BLOCKER",
    identityFields.every(Boolean) ? undefined : "Exporter/operator name, installation name, country, production route and system-boundary statement are all required.",
    identityFields.every(Boolean) ? undefined : "REM_COMPLETE_INSTALLATION_IDENTITY"
  );

  const eori = String(caseData.importerIdentity.eoriNumber.value || "").trim();
  if (!eori) add("QC_01", "EORI presence", "BLOCKER", "EORI number is missing.", "REM_PROVIDE_EORI");
  else if (!/^[A-Z]{2}[A-Z0-9]{6,15}$/i.test(eori)) add("QC_01", "EORI format", "BLOCKER", "EORI must contain a two-letter country prefix followed by 6–15 alphanumeric characters.", "REM_CORRECT_EORI_FORMAT");
  else if (!supportedEvidence(caseData, "importerIdentity.eoriNumber", caseData.importerIdentity.eoriNumber)) add("QC_01", "EORI evidence", "BLOCKER", "EORI is not linked to internally approved evidence.", "REM_LINK_AND_APPROVE_EORI_EVIDENCE");
  else add("QC_01", "EORI format and evidence", "PASS");

  const year = Number(caseData.reportingPeriod.year.value);
  add(
    "QC_02",
    "Definitive-period reporting year",
    Number.isInteger(year) && year >= 2026 && year <= 2100 ? "PASS" : "BLOCKER",
    Number.isInteger(year) && year >= 2026 && year <= 2100 ? undefined : "Enter a valid definitive-period reporting year from 2026 onward.",
    Number.isInteger(year) && year >= 2026 && year <= 2100 ? undefined : "REM_CORRECT_REPORTING_YEAR"
  );

  if (caseData.goods.length === 0) {
    add("QC_03", "Goods definition", "BLOCKER", "No goods are defined.", "REM_ADD_GOOD");
  } else {
    caseData.goods.forEach((good, index) => {
      const cnPath = `goods.${index}.cnCode`;
      const productionPath = `goods.${index}.productionVolume`;
      const cnCode = String(good.cnCode.value || "");
      if (!/^\d{8}$/.test(cnCode)) add(`QC_03_${index + 1}`, `Good ${index + 1} CN code`, "BLOCKER", "CN code must contain exactly eight digits.", "REM_CORRECT_CN_CODE");
      else if (!supportedEvidence(caseData, cnPath, good.cnCode)) add(`QC_03_${index + 1}`, `Good ${index + 1} CN code evidence`, "BLOCKER", "CN code is not linked to internally approved customs evidence.", "REM_LINK_AND_APPROVE_CN_EVIDENCE");
      else add(`QC_03_${index + 1}`, `Good ${index + 1} CN code and evidence`, "PASS");

      if (!finitePositive(good.productionVolume.value)) add(`QC_04_${index + 1}`, `Good ${index + 1} production quantity`, "BLOCKER", "Production quantity must be finite and greater than zero.", "REM_CORRECT_PRODUCTION_QUANTITY");
      else if (!["t", "kg"].includes(unitOf(good.productionVolume, "t"))) add(`QC_04_${index + 1}`, `Good ${index + 1} production unit`, "BLOCKER", "Production quantity must use tonnes or kilograms.", "REM_CORRECT_PRODUCTION_UNIT");
      else if (!supportedEvidence(caseData, productionPath, good.productionVolume)) add(`QC_04_${index + 1}`, `Good ${index + 1} production evidence`, "BLOCKER", "Production quantity is not linked to internally approved evidence.", "REM_LINK_AND_APPROVE_PRODUCTION_EVIDENCE");
      else add(`QC_04_${index + 1}`, `Good ${index + 1} production quantity and evidence`, "PASS");

      add(
        `QC_05_${index + 1}`,
        `Good ${index + 1} sector mapping`,
        ["IRON_AND_STEEL", "ALUMINIUM", "CEMENT", "FERTILISERS", "HYDROGEN", "ELECTRICITY"].includes(good.sector) ? "PASS" : "BLOCKER",
        ["IRON_AND_STEEL", "ALUMINIUM", "CEMENT", "FERTILISERS", "HYDROGEN", "ELECTRICITY"].includes(good.sector) ? undefined : "The selected sector is unsupported by the active calculation engine.",
        "REM_SELECT_SUPPORTED_SECTOR"
      );
    });
  }

  if (caseData.goods.length <= 1) {
    add("QC_05A", "Goods emissions allocation", caseData.goods.length === 1 ? "PASS" : "NOT_APPLICABLE");
  } else {
    const shares = caseData.goods.map((good, index) => ({ index, share: decimal(good.allocationShare?.value), datum: good.allocationShare }));
    if (shares.some(({ share }) => share === null || share.lte(0) || share.gt(1))) {
      add("QC_05A", "Goods emissions allocation shares", "BLOCKER", "Every good requires a positive decimal allocation share not exceeding 1.", "REM_ENTER_GOOD_ALLOCATION_SHARES");
    } else {
      const sum = shares.reduce((total, item) => total.plus(item.share!), new Decimal(0));
      if (sum.minus(1).abs().gt(ALLOCATION_TOLERANCE)) add("QC_05A", "Goods emissions allocation reconciliation", "BLOCKER", `Allocation shares sum to ${sum.toString()} instead of 1.`, "REM_RECONCILE_GOOD_ALLOCATION_SHARES");
      else if (shares.some(({ index, datum }) => !datum || !supportedEvidence(caseData, `goods.${index}.allocationShare`, datum))) add("QC_05A", "Goods emissions allocation evidence", "BLOCKER", "Every allocation share must be linked to internally approved evidence.", "REM_LINK_AND_APPROVE_ALLOCATION_EVIDENCE");
      else if (!hasAcceptedMethodologyDecision(caseData, "GOODS_EMISSIONS_ALLOCATION")) add("QC_05A", "Goods emissions allocation method", "BLOCKER", "The allocation method is not documented as an accepted methodology decision.", "REM_DOCUMENT_ALLOCATION_METHOD");
      else add("QC_05A", "Goods emissions allocation and reconciliation", "PASS");
    }
  }

  const materialInputs: Array<{ ruleId: string; path: string; name: string; datum: InputDatum; units: string[]; fallback: string }> = [
    { ruleId: "QC_06", path: "directEmissions", name: "Direct emissions", datum: caseData.directEmissions, units: ["tCO2e"], fallback: "tCO2e" },
    { ruleId: "QC_07", path: "electricityConsumed", name: "Electricity consumed", datum: caseData.electricityConsumed, units: ["MWh"], fallback: "MWh" },
    { ruleId: "QC_08", path: "gridEmissionFactor", name: "Grid emission factor", datum: caseData.gridEmissionFactor, units: ["tCO2e/MWh"], fallback: "tCO2e/MWh" },
  ];
  for (const item of materialInputs) {
    if (!finiteNonNegative(item.datum.value)) add(item.ruleId, item.name, "BLOCKER", `${item.name} must be a finite, non-negative number.`, `REM_CORRECT_${item.ruleId}`);
    else if (!item.units.includes(unitOf(item.datum, item.fallback))) add(item.ruleId, `${item.name} unit`, "BLOCKER", `${item.name} uses an unsupported unit.`, `REM_CORRECT_${item.ruleId}_UNIT`);
    else if (!supportedEvidence(caseData, item.path, item.datum)) add(item.ruleId, `${item.name} evidence`, "BLOCKER", `${item.name} is not linked to internally approved evidence.`, `REM_LINK_AND_APPROVE_${item.ruleId}_EVIDENCE`);
    else if (item.datum.sourceType === "ESTIMATED" && !hasAcceptedMethodologyDecision(caseData, `ESTIMATE:${item.path}`)) add(item.ruleId, `${item.name} source method`, "BLOCKER", `${item.name} uses an estimate without an accepted methodology decision.`, `REM_DOCUMENT_${item.ruleId}_METHOD`);
    else add(item.ruleId, `${item.name} value, unit and evidence`, "PASS");
  }

  if (caseData.precursors.length === 0) {
    add(
      "QC_09",
      "Precursor scope decision",
      hasAcceptedMethodologyDecision(caseData, "PRECURSOR_SCOPE") ? "PASS" : "BLOCKER",
      hasAcceptedMethodologyDecision(caseData, "PRECURSOR_SCOPE") ? undefined : "No precursor records are declared and no accepted precursor-scope decision is recorded.",
      "REM_CONFIRM_PRECURSOR_SCOPE"
    );
  } else {
    caseData.precursors.forEach((precursor, index) => {
      const paths = [
        [`precursors.${index}.quantity`, precursor.quantity, "quantity", ["t", "kg"]],
        [`precursors.${index}.directEmissions`, precursor.directEmissions, "direct emissions", ["tCO2e"]],
        [`precursors.${index}.indirectEmissions`, precursor.indirectEmissions, "indirect emissions", ["tCO2e"]],
      ] as const;
      paths.forEach(([path, datum, label, units]) => {
        if (!finiteNonNegative(datum.value) || (label === "quantity" && !finitePositive(datum.value))) add(`QC_09_${index + 1}_${label.replace(/\s/g, "_")}`, `Precursor ${index + 1} ${label}`, "BLOCKER", `Precursor ${label} is invalid.`, "REM_CORRECT_PRECURSOR_DATA");
        else if (!units.includes(unitOf(datum, label === "quantity" ? "t" : "tCO2e"))) add(`QC_09_${index + 1}_${label.replace(/\s/g, "_")}`, `Precursor ${index + 1} ${label} unit`, "BLOCKER", `Precursor ${label} uses an unsupported unit.`, "REM_CORRECT_PRECURSOR_UNIT");
        else if (!supportedEvidence(caseData, path, datum)) add(`QC_09_${index + 1}_${label.replace(/\s/g, "_")}`, `Precursor ${index + 1} ${label} evidence`, "BLOCKER", `Precursor ${label} is not linked to internally approved evidence.`, "REM_LINK_AND_APPROVE_PRECURSOR_EVIDENCE");
        else add(`QC_09_${index + 1}_${label.replace(/\s/g, "_")}`, `Precursor ${index + 1} ${label}`, "PASS");
      });
    });
  }

  const hashes = new Set<string>();
  let duplicateHash = false;
  let invalidEvidence = false;
  caseData.evidenceRegister.forEach((evidence) => {
    const hash = evidence.fileHash.toLowerCase();
    if (hashes.has(hash)) duplicateHash = true;
    hashes.add(hash);
    if (!/^[a-f0-9]{64}$/.test(hash) || evidence.sizeBytes <= 0 || !evidence.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/`) || evidence.linkedInputs.length === 0 || evidence.reviewStatus !== "APPROVED" || !["SUPPORTED", "PARTIALLY_SUPPORTED"].includes(evidence.supportStatus)) invalidEvidence = true;
  });
  if (caseData.evidenceRegister.length === 0) add("QC_10", "Evidence register", "BLOCKER", "Evidence register is empty.", "REM_UPLOAD_EVIDENCE");
  else if (invalidEvidence) add("QC_10", "Evidence metadata and internal approval", "BLOCKER", "One or more evidence records have invalid integrity, linkage, support or internal review status.", "REM_REVIEW_AND_APPROVE_EVIDENCE");
  else if (duplicateHash) add("QC_10", "Duplicate source documents", "BLOCKER", "Duplicate evidence hashes were detected.", "REM_REMOVE_DUPLICATE_EVIDENCE");
  else add("QC_10", "Evidence register integrity", "PASS");

  const openFindings = caseData.gapAssessment.filter((gap) => gap.resolutionStatus !== "RESOLVED");
  if (openFindings.some((gap) => gap.isBlocking || ["BLOCKER", "CRITICAL", "MAJOR"].includes(gap.severity))) add("QC_12", "Recorded material findings", "BLOCKER", "The dossier contains unresolved blocking, critical or major findings.", "REM_RESOLVE_MATERIAL_FINDINGS");
  else if (openFindings.length > 0) add("QC_12", "Recorded open findings", "WARNING", "The dossier contains unresolved minor or advisory findings.", "REM_REVIEW_OPEN_FINDINGS");
  else add("QC_12", "Recorded findings", "PASS");

  const invalidDecisions = caseData.methodologyDecisions.filter((decision) => decision.reviewStatus !== "ACCEPTED" || !decision.reason.trim() || !decision.legalOrTechnicalBasis.trim() || !decision.rulesetVersion.trim() || decision.evidenceIds.some((id) => !caseData.evidenceRegister.some((evidence) => evidence.evidenceId === id)));
  add(
    "QC_13",
    "Methodology decision governance",
    invalidDecisions.length === 0 ? "PASS" : "BLOCKER",
    invalidDecisions.length === 0 ? undefined : `${invalidDecisions.length} methodology decisions are incomplete, unaccepted or reference missing evidence.`,
    invalidDecisions.length === 0 ? undefined : "REM_COMPLETE_METHODOLOGY_DECISIONS"
  );

  return results;
}
