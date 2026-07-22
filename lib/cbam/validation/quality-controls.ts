import { Decimal } from "decimal.js";
import type { AuditReadyCase, InputDatum } from "../schema";

export type QualityControlStatus = "PASS" | "WARNING" | "BLOCKER" | "NOT_APPLICABLE";
export interface QualityControlResult { ruleId: string; name: string; status: QualityControlStatus; message?: string; remediationCode?: string; }
const ALLOCATION_TOLERANCE = new Decimal("0.000001");

function decimal(value: unknown): Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  try { const parsed = new Decimal(value as Decimal.Value); return parsed.isFinite() ? parsed : null; } catch { return null; }
}
function finiteNonNegative(value: unknown): boolean { const parsed = decimal(value); return parsed !== null && parsed.gte(0); }
function finitePositive(value: unknown): boolean { const parsed = decimal(value); return parsed !== null && parsed.gt(0); }
function unitOf(datum: InputDatum, fallback: string): string { return datum.canonicalUnit || datum.rawUnit || fallback; }
function supportedEvidence(caseData: AuditReadyCase, path: string, datum: InputDatum): boolean {
  if (!datum.evidenceId || !caseData.caseId) return false;
  const record = caseData.evidenceRegister.find((item) => item.evidenceId === datum.evidenceId);
  return Boolean(record && record.linkedInputs.includes(path) && record.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/${record.evidenceId}/`) && /^[a-f0-9]{64}$/i.test(record.fileHash) && record.sizeBytes > 0 && record.reviewStatus === "APPROVED" && record.malwareScanStatus === "CLEAN" && (record.supportStatus === "SUPPORTED" || record.supportStatus === "PARTIALLY_SUPPORTED"));
}
function acceptedMethod(caseData: AuditReadyCase, topic: string): boolean {
  return caseData.methodologyDecisions.some((decision) => decision.topic === topic && decision.reviewStatus === "ACCEPTED" && decision.reason.trim().length > 0 && decision.legalOrTechnicalBasis.trim().length > 0 && decision.rulesetVersion.trim().length > 0 && decision.evidenceIds.every((evidenceId) => caseData.evidenceRegister.some((evidence) => evidence.evidenceId === evidenceId)));
}

export function runQualityControls(caseData: AuditReadyCase): QualityControlResult[] {
  const results: QualityControlResult[] = [];
  const add = (ruleId: string, name: string, status: QualityControlStatus, message?: string, remediationCode?: string) => results.push({ ruleId, name, status, message, remediationCode });
  const identityComplete = [caseData.importerIdentity.legalName.value, caseData.exporterIdentity.legalName.value, caseData.installation.name.value, caseData.installation.country.value, caseData.installation.productionRoute.value, caseData.installation.systemBoundaries].every((value) => String(value || "").trim());
  add("QC_00", "Operator, installation and boundary identity", identityComplete ? "PASS" : "BLOCKER", identityComplete ? undefined : "Importer, exporter, installation, country, route and boundary statement are required.", "REM_COMPLETE_CASE_IDENTITY");

  const eori = String(caseData.importerIdentity.eoriNumber.value || "").trim();
  if (!/^[A-Z]{2}[A-Z0-9]{6,15}$/i.test(eori)) add("QC_01", "EORI format", "BLOCKER", "EORI requires a two-letter country prefix and 6–15 alphanumeric characters.", "REM_CORRECT_EORI");
  else if (!supportedEvidence(caseData, "importerIdentity.eoriNumber", caseData.importerIdentity.eoriNumber)) add("QC_01", "EORI evidence", "BLOCKER", "EORI is not linked to approved, supported and malware-clean evidence.", "REM_LINK_EORI_EVIDENCE");
  else add("QC_01", "EORI format and evidence", "PASS");

  const year = Number(caseData.reportingPeriod.year.value);
  add("QC_02", "Definitive-period reporting year", Number.isInteger(year) && year >= 2023 && year <= 2100 ? "PASS" : "BLOCKER", Number.isInteger(year) && year >= 2023 && year <= 2100 ? undefined : "Reporting year must be an integer from 2023 through 2100.", "REM_CORRECT_REPORTING_YEAR");
  if (caseData.goods.length === 0) add("QC_03", "Goods definition", "BLOCKER", "At least one good is required.", "REM_ADD_GOOD");

  caseData.goods.forEach((good, index) => {
    const cnPath = `goods.${index}.cnCode`;
    const productionPath = `goods.${index}.productionVolume`;
    const cnCode = String(good.cnCode.value || "");
    if (!/^\d{8}$/.test(cnCode)) add(`QC_03_${index}`, `Good ${index + 1} CN code`, "BLOCKER", "CN code must contain exactly eight digits.", "REM_CORRECT_CN_CODE");
    else if (!supportedEvidence(caseData, cnPath, good.cnCode)) add(`QC_03_${index}`, `Good ${index + 1} CN evidence`, "BLOCKER", "CN code requires approved customs evidence.", "REM_LINK_CN_EVIDENCE");
    else add(`QC_03_${index}`, `Good ${index + 1} CN code and evidence`, "PASS");
    if (!finitePositive(good.productionVolume.value)) add(`QC_04_${index}`, `Good ${index + 1} production`, "BLOCKER", "Production must be finite and greater than zero.", "REM_CORRECT_PRODUCTION");
    else if (!["t", "kg"].includes(unitOf(good.productionVolume, "t"))) add(`QC_04_${index}`, `Good ${index + 1} production unit`, "BLOCKER", "Production unit must be tonnes or kilograms.", "REM_CORRECT_PRODUCTION_UNIT");
    else if (!supportedEvidence(caseData, productionPath, good.productionVolume)) add(`QC_04_${index}`, `Good ${index + 1} production evidence`, "BLOCKER", "Production requires approved evidence.", "REM_LINK_PRODUCTION_EVIDENCE");
    else add(`QC_04_${index}`, `Good ${index + 1} production and evidence`, "PASS");
    add(`QC_05_${index}`, `Good ${index + 1} sector`, ["IRON_AND_STEEL", "ALUMINIUM", "CEMENT", "FERTILISERS", "HYDROGEN", "ELECTRICITY"].includes(good.sector) ? "PASS" : "BLOCKER", undefined, "REM_SELECT_SUPPORTED_SECTOR");
  });

  if (caseData.goods.length <= 1) add("QC_05A", "Goods emissions allocation", caseData.goods.length === 1 ? "PASS" : "NOT_APPLICABLE");
  else {
    const shares = caseData.goods.map((good) => decimal(good.allocationShare?.value));
    if (shares.some((share) => share === null || share.lte(0) || share.gt(1))) add("QC_05A", "Allocation shares", "BLOCKER", "Each good requires an allocation share greater than zero and not exceeding one.", "REM_ENTER_ALLOCATION_SHARES");
    else {
      const total = (shares as Decimal[]).reduce((sum, share) => sum.plus(share), new Decimal(0));
      if (total.minus(1).abs().gt(ALLOCATION_TOLERANCE)) add("QC_05A", "Allocation reconciliation", "BLOCKER", `Allocation shares sum to ${total.toString()} instead of 1.`, "REM_RECONCILE_ALLOCATION");
      else if (caseData.goods.some((good, index) => !good.allocationShare || !supportedEvidence(caseData, `goods.${index}.allocationShare`, good.allocationShare))) add("QC_05A", "Allocation evidence", "BLOCKER", "Every allocation share requires approved evidence.", "REM_LINK_ALLOCATION_EVIDENCE");
      else if (!acceptedMethod(caseData, "GOODS_EMISSIONS_ALLOCATION")) add("QC_05A", "Allocation methodology", "BLOCKER", "Document and accept the goods allocation methodology.", "REM_DOCUMENT_ALLOCATION_METHOD");
      else add("QC_05A", "Allocation, evidence and reconciliation", "PASS");
    }
  }

  const materialInputs: Array<[string, string, InputDatum, string[]]> = [["QC_06", "directEmissions", caseData.directEmissions, ["tCO2e"]], ["QC_07", "electricityConsumed", caseData.electricityConsumed, ["MWh"]], ["QC_08", "gridEmissionFactor", caseData.gridEmissionFactor, ["tCO2e/MWh"]]];
  for (const [ruleId, path, datum, units] of materialInputs) {
    if (!finiteNonNegative(datum.value)) add(ruleId, path, "BLOCKER", `${path} must be finite and non-negative.`, `REM_CORRECT_${ruleId}`);
    else if (!units.includes(unitOf(datum, units[0]))) add(ruleId, `${path} unit`, "BLOCKER", `${path} uses an unsupported unit.`, `REM_CORRECT_${ruleId}_UNIT`);
    else if (!supportedEvidence(caseData, path, datum)) add(ruleId, `${path} evidence`, "BLOCKER", `${path} requires approved evidence.`, `REM_LINK_${ruleId}_EVIDENCE`);
    else if (datum.sourceType === "ESTIMATED" && !acceptedMethod(caseData, `ESTIMATE:${path}`)) add(ruleId, `${path} methodology`, "BLOCKER", `${path} uses an estimate without an accepted methodology decision.`, `REM_DOCUMENT_${ruleId}_METHOD`);
    else add(ruleId, `${path} value, unit and evidence`, "PASS");
  }

  if (caseData.precursors.length === 0) add("QC_09", "Precursor scope", acceptedMethod(caseData, "PRECURSOR_SCOPE") ? "PASS" : "BLOCKER", acceptedMethod(caseData, "PRECURSOR_SCOPE") ? undefined : "Declare precursors or document an accepted no-precursor decision.", "REM_CONFIRM_PRECURSOR_SCOPE");
  else caseData.precursors.forEach((precursor, index) => {
    const records: Array<[string, InputDatum, boolean, string[]]> = [[`precursors.${index}.quantity`, precursor.quantity, true, ["t", "kg"]], [`precursors.${index}.directEmissions`, precursor.directEmissions, false, ["tCO2e"]], [`precursors.${index}.indirectEmissions`, precursor.indirectEmissions, false, ["tCO2e"]]];
    records.forEach(([path, datum, positive, units]) => {
      const valid = positive ? finitePositive(datum.value) : finiteNonNegative(datum.value);
      add(`QC_09_${path}`, path, valid && units.includes(unitOf(datum, units[0])) && supportedEvidence(caseData, path, datum) ? "PASS" : "BLOCKER", valid ? undefined : `${path} is invalid.`, "REM_CORRECT_PRECURSOR");
    });
  });

  const hashes = new Set<string>(); let invalidEvidence = false; let duplicateHash = false;
  for (const evidence of caseData.evidenceRegister) {
    const hash = evidence.fileHash.toLowerCase(); if (hashes.has(hash)) duplicateHash = true; hashes.add(hash);
    if (!caseData.caseId || !evidence.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/${evidence.evidenceId}/`) || !/^[a-f0-9]{64}$/.test(hash) || evidence.sizeBytes <= 0 || evidence.reviewStatus !== "APPROVED" || evidence.malwareScanStatus !== "CLEAN" || !["SUPPORTED", "PARTIALLY_SUPPORTED", "NOT_REQUIRED"].includes(evidence.supportStatus)) invalidEvidence = true;
  }
  if (caseData.evidenceRegister.length === 0) add("QC_10", "Evidence register", "BLOCKER", "Evidence register is empty.", "REM_UPLOAD_EVIDENCE");
  else if (duplicateHash || invalidEvidence) add("QC_10", "Evidence integrity", "BLOCKER", "Evidence has duplicate hashes, invalid ownership metadata, incomplete review or non-clean malware status.", "REM_REVIEW_EVIDENCE");
  else add("QC_10", "Evidence integrity", "PASS");

  for (const record of caseData.carbonPriceRecords) {
    if (!record.proofOfPaymentEvidenceId || !caseData.evidenceRegister.some((evidence) => evidence.evidenceId === record.proofOfPaymentEvidenceId && evidence.reviewStatus === "APPROVED" && evidence.malwareScanStatus === "CLEAN")) add(`QC_11_${record.id}`, "Carbon price proof", "BLOCKER", "Carbon-price reduction requires approved payment evidence.", "REM_LINK_CARBON_PRICE_EVIDENCE");
  }
  if (caseData.carbonPriceRecords.length === 0) add("QC_11", "Carbon price records", "NOT_APPLICABLE");
  return results;
}
