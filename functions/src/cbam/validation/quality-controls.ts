import { Decimal } from "decimal.js";
import type { AuditReadyCase, InputDatum } from "../schema";

export type QualityControlStatus = "PASS" | "WARNING" | "BLOCKER" | "NOT_APPLICABLE";
/**
 * BLOCKER = hard structural failure — report cannot be generated without this.
 * WARNING = data/evidence gap — report generates but field is annotated as incomplete.
 */
export interface QualityControlResult { ruleId: string; name: string; status: QualityControlStatus; message?: string; remediationCode?: string; isHardBlocker?: boolean; }
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
  // Hard blocker = structural; must be resolved before any report can be generated.
  // Warning = evidence/data gap; report generates but section is annotated as incomplete.
  const addHard = (ruleId: string, name: string, status: QualityControlStatus, message?: string, remediationCode?: string) =>
    results.push({ ruleId, name, status, message, remediationCode, isHardBlocker: status === "BLOCKER" });
  const addWarn = (ruleId: string, name: string, pass: boolean, message?: string, remediationCode?: string) =>
    results.push({ ruleId, name, status: pass ? "PASS" : "WARNING", message: pass ? undefined : message, remediationCode, isHardBlocker: false });

  // ── Hard structural controls ────────────────────────────────────────────────
  const identityComplete = [caseData.importerIdentity.legalName.value, caseData.exporterIdentity.legalName.value, caseData.installation.name.value, caseData.installation.country.value, caseData.installation.productionRoute.value, caseData.installation.systemBoundaries].every((value) => String(value || "").trim());
  addHard("QC_00", "Operator, installation and boundary identity", identityComplete ? "PASS" : "BLOCKER", identityComplete ? undefined : "Importer, exporter, installation, country, route and boundary statement are required.", "REM_COMPLETE_CASE_IDENTITY");

  const eori = String(caseData.importerIdentity.eoriNumber.value || "").trim();
  if (!/^[A-Z]{2}[A-Z0-9]{6,15}$/i.test(eori)) addHard("QC_01", "EORI format", "BLOCKER", "EORI requires a two-letter country prefix and 6–15 alphanumeric characters.", "REM_CORRECT_EORI");
  else addWarn("QC_01", "EORI evidence", supportedEvidence(caseData, "importerIdentity.eoriNumber", caseData.importerIdentity.eoriNumber), "EORI is not linked to approved, supported and malware-clean evidence.", "REM_LINK_EORI_EVIDENCE");

  const year = Number(caseData.reportingPeriod.year.value);
  addHard("QC_02", "Definitive-period reporting year", Number.isInteger(year) && year >= 2026 && year <= 2100 ? "PASS" : "BLOCKER", Number.isInteger(year) && year >= 2026 && year <= 2100 ? undefined : "Reporting year must be an integer from 2026 through 2100.", "REM_CORRECT_REPORTING_YEAR");

  if (caseData.goods.length === 0) addHard("QC_03", "Goods definition", "BLOCKER", "At least one good is required.", "REM_ADD_GOOD");

  // ── Per-good controls ───────────────────────────────────────────────────────
  caseData.goods.forEach((good, index) => {
    const cnPath = `goods.${index}.cnCode`;
    const productionPath = `goods.${index}.productionVolume`;
    const cnCode = String(good.cnCode.value || "");
    const cnFormatOk = /^\d{8}$/.test(cnCode);
    if (!cnFormatOk) addHard(`QC_03_${index}`, `Good ${index + 1} CN code`, "BLOCKER", "CN code must contain exactly eight digits.", "REM_CORRECT_CN_CODE");
    else addWarn(`QC_03_${index}`, `Good ${index + 1} CN evidence`, supportedEvidence(caseData, cnPath, good.cnCode), "CN code requires approved customs evidence.", "REM_LINK_CN_EVIDENCE");

    const prodOk = finitePositive(good.productionVolume.value);
    const prodUnitOk = prodOk && ["t", "kg"].includes(unitOf(good.productionVolume, "t"));
    if (!prodOk) addHard(`QC_04_${index}`, `Good ${index + 1} production`, "BLOCKER", "Production must be finite and greater than zero.", "REM_CORRECT_PRODUCTION");
    else if (!prodUnitOk) addHard(`QC_04_${index}`, `Good ${index + 1} production unit`, "BLOCKER", "Production unit must be tonnes or kilograms.", "REM_CORRECT_PRODUCTION_UNIT");
    else addWarn(`QC_04_${index}`, `Good ${index + 1} production evidence`, supportedEvidence(caseData, productionPath, good.productionVolume), "Production requires approved evidence.", "REM_LINK_PRODUCTION_EVIDENCE");

    addHard(`QC_05_${index}`, `Good ${index + 1} sector`, ["IRON_AND_STEEL", "ALUMINIUM", "CEMENT", "FERTILISERS", "HYDROGEN", "ELECTRICITY"].includes(good.sector) ? "PASS" : "BLOCKER", undefined, "REM_SELECT_SUPPORTED_SECTOR");
  });

  // ── Allocation (hard when values invalid, warn when evidence missing) ────────
  if (caseData.goods.length <= 1) {
    results.push({ ruleId: "QC_05A", name: "Goods emissions allocation", status: caseData.goods.length === 1 ? "PASS" : "NOT_APPLICABLE", isHardBlocker: false });
  } else {
    const shares = caseData.goods.map((good) => decimal(good.allocationShare?.value));
    if (shares.some((share) => share === null || share.lte(0) || share.gt(1))) addHard("QC_05A", "Allocation shares", "BLOCKER", "Each good requires an allocation share greater than zero and not exceeding one.", "REM_ENTER_ALLOCATION_SHARES");
    else {
      const total = (shares as Decimal[]).reduce((sum, share) => sum.plus(share), new Decimal(0));
      if (total.minus(1).abs().gt(ALLOCATION_TOLERANCE)) addHard("QC_05A", "Allocation reconciliation", "BLOCKER", `Allocation shares sum to ${total.toString()} instead of 1.`, "REM_RECONCILE_ALLOCATION");
      else addWarn("QC_05A", "Allocation evidence and methodology",
        !caseData.goods.some((good, index) => !good.allocationShare || !supportedEvidence(caseData, `goods.${index}.allocationShare`, good.allocationShare)) && acceptedMethod(caseData, "GOODS_EMISSIONS_ALLOCATION"),
        "Every allocation share requires approved evidence and an accepted methodology decision.", "REM_LINK_ALLOCATION_EVIDENCE");
    }
  }

  // ── Material emission inputs (value hard-blocks; evidence is a warning) ──────
  const materialInputs: Array<[string, string, InputDatum, string[]]> = [
    ["QC_06", "directEmissions", caseData.directEmissions, ["tCO2e"]],
    ["QC_07", "electricityConsumed", caseData.electricityConsumed, ["MWh"]],
    ["QC_08", "gridEmissionFactor", caseData.gridEmissionFactor, ["tCO2e/MWh"]],
  ];
  for (const [ruleId, path, datum, units] of materialInputs) {
    if (!finiteNonNegative(datum.value)) addHard(ruleId, path, "BLOCKER", `${path} must be finite and non-negative.`, `REM_CORRECT_${ruleId}`);
    else if (!units.includes(unitOf(datum, units[0]))) addHard(ruleId, `${path} unit`, "BLOCKER", `${path} uses an unsupported unit.`, `REM_CORRECT_${ruleId}_UNIT`);
    else {
      const evidenceOk = supportedEvidence(caseData, path, datum);
      const methodOk = datum.sourceType !== "ESTIMATED" || acceptedMethod(caseData, `ESTIMATE:${path}`);
      addWarn(ruleId, `${path} evidence and methodology`, evidenceOk && methodOk,
        !evidenceOk ? `${path} requires approved evidence.` : `${path} uses an estimate without an accepted methodology decision.`,
        evidenceOk ? `REM_DOCUMENT_${ruleId}_METHOD` : `REM_LINK_${ruleId}_EVIDENCE`);
    }
  }

  // ── Precursors (warning — declared but partially incomplete) ─────────────────
  if (caseData.precursors.length === 0) {
    addWarn("QC_09", "Precursor scope", acceptedMethod(caseData, "PRECURSOR_SCOPE"),
      "Declare precursors or document an accepted no-precursor decision.", "REM_CONFIRM_PRECURSOR_SCOPE");
  } else {
    caseData.precursors.forEach((precursor, index) => {
      const records: Array<[string, InputDatum, boolean, string[]]> = [
        [`precursors.${index}.quantity`, precursor.quantity, true, ["t", "kg"]],
        [`precursors.${index}.directEmissions`, precursor.directEmissions, false, ["tCO2e"]],
        [`precursors.${index}.indirectEmissions`, precursor.indirectEmissions, false, ["tCO2e"]],
      ];
      records.forEach(([path, datum, positive, units]) => {
        const valid = positive ? finitePositive(datum.value) : finiteNonNegative(datum.value);
        addWarn(`QC_09_${path}`, path, valid && units.includes(unitOf(datum, units[0])) && supportedEvidence(caseData, path, datum),
          valid ? `${path} requires approved evidence.` : `${path} is invalid.`, "REM_CORRECT_PRECURSOR");
      });
    });
  }

  // ── Evidence register integrity (warning when empty or integrity issues) ─────
  const hashes = new Set<string>(); let invalidEvidence = false; let duplicateHash = false;
  for (const evidence of caseData.evidenceRegister) {
    const hash = evidence.fileHash.toLowerCase();
    if (hashes.has(hash)) duplicateHash = true;
    hashes.add(hash);
    if (!caseData.caseId || !evidence.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/${evidence.evidenceId}/`) || !/^[a-f0-9]{64}$/.test(hash) || evidence.sizeBytes <= 0 || evidence.reviewStatus !== "APPROVED" || evidence.malwareScanStatus !== "CLEAN" || !["SUPPORTED", "PARTIALLY_SUPPORTED", "NOT_REQUIRED"].includes(evidence.supportStatus)) invalidEvidence = true;
  }
  addWarn("QC_10", "Evidence register",
    caseData.evidenceRegister.length > 0 && !duplicateHash && !invalidEvidence,
    caseData.evidenceRegister.length === 0 ? "Evidence register is empty." : "Evidence has duplicate hashes, invalid ownership metadata, incomplete review or non-clean malware status.",
    "REM_UPLOAD_EVIDENCE");

  // ── Carbon price payment proof (warning — optional mechanism) ────────────────
  for (const record of caseData.carbonPriceRecords) {
    addWarn(`QC_11_${record.id}`, "Carbon price proof",
      Boolean(record.proofOfPaymentEvidenceId && caseData.evidenceRegister.some((evidence) => evidence.evidenceId === record.proofOfPaymentEvidenceId && evidence.reviewStatus === "APPROVED" && evidence.malwareScanStatus === "CLEAN")),
      "Carbon-price reduction requires approved payment evidence.", "REM_LINK_CARBON_PRICE_EVIDENCE");
  }
  if (caseData.carbonPriceRecords.length === 0) results.push({ ruleId: "QC_11", name: "Carbon price records", status: "NOT_APPLICABLE", isHardBlocker: false });
  return results;
}
