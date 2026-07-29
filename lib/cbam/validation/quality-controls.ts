import { Decimal } from "decimal.js";
import type { AuditReadyCase, InputDatum } from "../schema";
import {
  GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH,
  GRID_EMISSION_FACTOR_SCALE_ERROR,
} from "../input-constraints";
import { getActiveRuleset } from "../registry/rulesets";
import { assessOrigin } from "../../dossier/01-ruleset/origin.rules";
import { CALCULATION_CONTRACT } from "../../dossier/01-ruleset/calculation.rules";

export type QualityControlStatus = "PASS" | "WARNING" | "BLOCKER" | "NOT_APPLICABLE";
export interface QualityControlResult { ruleId: string; name: string; status: QualityControlStatus; message?: string; remediationCode?: string; }
const ALLOCATION_TOLERANCE = new Decimal("0.000001");

function decimal(value: unknown): Decimal | null {
  if (value === null || value === undefined || value === "") return null;
  try { const parsed = new Decimal(value as Decimal.Value); return parsed.isFinite() ? parsed : null; } catch { return null; }
}
function finiteNonNegative(value: unknown): boolean { const parsed = decimal(value); return parsed !== null && parsed.gte(0); }
function finitePositive(value: unknown): boolean { const parsed = decimal(value); return parsed !== null && parsed.gt(0); }
function unitOf(datum: InputDatum, fallback: string): string { return datum.canonicalUnit || datum.unit || datum.rawUnit || fallback; }
function supportedEvidence(caseData: AuditReadyCase, path: string, datum: InputDatum): boolean {
  if (!datum.evidenceId || !caseData.caseId) return false;
  const record = caseData.evidenceRegister.find((item) => item.evidenceId === datum.evidenceId);
  return Boolean(record && record.linkedInputs.includes(path) && record.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/${record.evidenceId}/`) && /^[a-f0-9]{64}$/i.test(record.fileHash) && record.sizeBytes > 0 && record.reviewStatus === "APPROVED" && record.malwareScanStatus === "CLEAN" && record.supportStatus === "SUPPORTED");
}
function acceptedMethod(caseData: AuditReadyCase, topic: string): boolean {
  return caseData.methodologyDecisions.some((decision) => decision.topic === topic && decision.reviewStatus === "ACCEPTED" && decision.reason.trim().length > 0 && decision.legalOrTechnicalBasis.trim().length > 0 && decision.rulesetVersion.trim().length > 0 && decision.evidenceIds.every((evidenceId) => caseData.evidenceRegister.some((evidence) => evidence.evidenceId === evidenceId)));
}
function illustrativeScenarioActive(caseData: AuditReadyCase): boolean {
  return caseData.auditEvents.reduce((active, event) => {
    if (event.action === "ILLUSTRATIVE_SCENARIO_LOADED") return true;
    if (event.action === "ILLUSTRATIVE_SCENARIO_REPLACED") return false;
    return active;
  }, false);
}

export function runQualityControls(caseData: AuditReadyCase): QualityControlResult[] {
  const results: QualityControlResult[] = [];
  const add = (ruleId: string, name: string, status: QualityControlStatus, message?: string, remediationCode?: string) => results.push({ ruleId, name, status, message, remediationCode });
  const scenarioActive = illustrativeScenarioActive(caseData);
  add(
    "QC_SCENARIO",
    "Illustrative scenario replacement",
    scenarioActive ? "BLOCKER" : "NOT_APPLICABLE",
    scenarioActive
      ? "Illustrative values demonstrate the workflow but are not case evidence. Start with a blank case and enter case-specific data before sealing."
      : undefined,
    scenarioActive ? "REM_REPLACE_ILLUSTRATIVE_SCENARIO" : undefined
  );
  const identityComplete = [caseData.importerIdentity.legalName.value, caseData.exporterIdentity.legalName.value, caseData.installation.name.value, caseData.installation.country.value, caseData.installation.productionRoute.value, caseData.installation.systemBoundaries].every((value) => String(value || "").trim());
  add("QC_00", "Operator, installation and boundary identity", identityComplete ? "PASS" : "BLOCKER", identityComplete ? undefined : "Importer, exporter, installation, country, route and boundary statement are required.", "REM_COMPLETE_CASE_IDENTITY");

  const originScope = assessOrigin(String(caseData.installation.country.value || ""));
  add(
    "QC_00_ORIGIN",
    "Installation country of origin CBAM scope",
    originScope.inScope ? "PASS" : "BLOCKER",
    originScope.inScope ? undefined : originScope.plainLanguage,
    originScope.inScope ? undefined : "REM_CORRECT_ORIGIN_COUNTRY"
  );

  const eori = String(caseData.importerIdentity.eoriNumber.value || "").trim();
  if (!/^[A-Z]{2}[A-Z0-9]{6,15}$/i.test(eori)) add("QC_01", "EORI format", "BLOCKER", "EORI requires a two-letter country prefix and 6–15 alphanumeric characters.", "REM_CORRECT_EORI");
  else if (!supportedEvidence(caseData, "importerIdentity.eoriNumber", caseData.importerIdentity.eoriNumber)) add("QC_01", "EORI evidence", "BLOCKER", "EORI is not linked to approved, supported and malware-clean evidence.", "REM_LINK_EORI_EVIDENCE");
  else add("QC_01", "EORI format and evidence", "PASS");

  const year = Number(caseData.reportingPeriod.year.value);
  let yearPass = Number.isInteger(year) && year >= 2023 && year <= 2100;
  let yearMessage = yearPass ? undefined : "Reporting year must be an integer from 2023 through 2100.";
  if (yearPass) {
    try {
      getActiveRuleset(new Date(Date.UTC(year, 0, 1)));
    } catch (error) {
      yearPass = false;
      yearMessage = error instanceof Error ? error.message : String(error);
    }
  }
  add("QC_02", "Definitive-period reporting year", yearPass ? "PASS" : "BLOCKER", yearMessage, "REM_CORRECT_REPORTING_YEAR");
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
    const parsedValue = decimal(datum.value);
    if (parsedValue === null || parsedValue.lt(0)) add(ruleId, path, "BLOCKER", `${path} must be finite and non-negative.`, `REM_CORRECT_${ruleId}`);
    else if (!units.includes(unitOf(datum, units[0]))) add(ruleId, `${path} unit`, "BLOCKER", `${path} uses an unsupported unit.`, `REM_CORRECT_${ruleId}_UNIT`);
    else if (path === "gridEmissionFactor" && parsedValue.gt(GRID_EMISSION_FACTOR_MAX_TCO2E_PER_MWH)) add(ruleId, `${path} scale`, "BLOCKER", GRID_EMISSION_FACTOR_SCALE_ERROR, "REM_CORRECT_QC_08_SCALE");
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
    if (!caseData.caseId || !evidence.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/${evidence.evidenceId}/`) || !/^[a-f0-9]{64}$/.test(hash) || evidence.sizeBytes <= 0 || evidence.reviewStatus !== "APPROVED" || evidence.malwareScanStatus !== "CLEAN" || !["SUPPORTED", "NOT_REQUIRED"].includes(evidence.supportStatus)) invalidEvidence = true;
  }
  if (caseData.evidenceRegister.length === 0) add("QC_10", "Evidence register", "BLOCKER", "Evidence register is empty.", "REM_UPLOAD_EVIDENCE");
  else if (duplicateHash || invalidEvidence) add("QC_10", "Evidence integrity", "BLOCKER", "Evidence has duplicate hashes, invalid ownership metadata, incomplete review or non-clean malware status.", "REM_REVIEW_EVIDENCE");
  else add("QC_10", "Evidence integrity", "PASS");

  for (const [index, record] of caseData.carbonPriceRecords.entries()) {
    const reduction = decimal(record.eligibleCertificateReduction);
    const paymentEvidence = record.proofOfPaymentEvidenceId
      ? caseData.evidenceRegister.find(
          (evidence) => evidence.evidenceId === record.proofOfPaymentEvidenceId
        )
      : undefined;
    const fullySupportedPaymentEvidence = Boolean(
      paymentEvidence &&
      paymentEvidence.reviewStatus === "APPROVED" &&
      paymentEvidence.malwareScanStatus === "CLEAN" &&
      paymentEvidence.supportStatus === "SUPPORTED"
    );
    if (reduction === null || reduction.isNegative()) {
      add(`QC_11_${record.id}`, "Carbon price reduction", "BLOCKER", "Carbon-price reduction must be finite and non-negative.", "REM_CORRECT_CARBON_PRICE_REDUCTION");
    } else if (reduction.isZero()) {
      add(`QC_11_${record.id}`, "Carbon price reduction", "NOT_APPLICABLE");
    } else if (!fullySupportedPaymentEvidence) {
      add(`QC_11_${record.id}`, "Carbon price proof", "BLOCKER", "Carbon-price reduction requires approved, fully supported and malware-clean payment evidence.", "REM_LINK_CARBON_PRICE_EVIDENCE");
    } else if (CALCULATION_CONTRACT.carbonPricePolicy.status !== "PROVEN") {
      add(`QC_11_${record.id}`, "Carbon price regulatory policy", "BLOCKER", CALCULATION_CONTRACT.carbonPricePolicy.reason, "REM_WAIT_FOR_VERIFIED_CARBON_PRICE_POLICY");
    } else {
      add(`QC_11_${record.id}`, `Carbon price record ${index + 1}`, "PASS");
    }
  }
  if (caseData.carbonPriceRecords.length === 0) add("QC_11", "Carbon price records", "NOT_APPLICABLE");

  // Cross-artifact goods consistency — block stale methodology / lineage leakage
  const goodsCount = caseData.goods.length;
  let lineageOutOfBounds = false;
  for (const evidence of caseData.evidenceRegister) {
    for (const path of evidence.linkedInputs) {
      const match = /^goods\.(\d+)(?:\.|$)/.exec(path);
      if (!match) continue;
      const index = Number(match[1]);
      if (!Number.isInteger(index) || index < 0 || index >= goodsCount) {
        lineageOutOfBounds = true;
      }
    }
  }
  const allocationDecision = caseData.methodologyDecisions.find(
    (d) => d.topic === "GOODS_EMISSIONS_ALLOCATION" && d.reviewStatus === "ACCEPTED"
  );
  let methodologyGoodsMismatch = false;
  if (allocationDecision) {
    const text = `${allocationDecision.selectedMethod} ${allocationDecision.reason}`.toLowerCase();
    const claimsTwo = /\btwo goods\b|\b0\.6\b.*\b0\.4\b|\b0\.4\b.*\b0\.6\b/.test(text);
    const claimsSingle = /\bsingle good\b|\b100%\b|\bshare of 1\b/.test(text);
    if (claimsTwo && goodsCount !== 2) methodologyGoodsMismatch = true;
    if (claimsSingle && goodsCount !== 1) methodologyGoodsMismatch = true;
    if (goodsCount === 1 && claimsTwo) methodologyGoodsMismatch = true;
    if (goodsCount > 1 && !acceptedMethod(caseData, "GOODS_EMISSIONS_ALLOCATION")) {
      // already covered by QC_05A; keep consistency explicit
    }
  }
  if (lineageOutOfBounds || methodologyGoodsMismatch) {
    add(
      "QC_12",
      "Goods cross-artifact consistency",
      "BLOCKER",
      lineageOutOfBounds
        ? `Evidence lineage references goods index outside goods.length=${goodsCount}.`
        : `Methodology decision describes a goods population inconsistent with goods.length=${goodsCount}.`,
      "REM_ALIGN_GOODS_STATE"
    );
  } else {
    add("QC_12", "Goods cross-artifact consistency", "PASS");
  }

  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  const processes = caseData.productionProcesses || [];
  const streams = caseData.sourceStreamRegister || [];
  const emissionSources = caseData.emissionSourceRegister || [];
  const meters = caseData.meterRegister || [];
  const processIds = new Set(processes.map((process) => process.processId));
  const streamIds = new Set(streams.map((stream) => stream.streamId));
  const meterIds = new Set(meters.map((meter) => meter.meterId));

  const yearValue = Number(caseData.reportingPeriod.year.value);
  const quarterRaw = String(caseData.reportingPeriod.quarter.value || "").trim().toUpperCase();
  const quarterMatch = /^Q?([1-4])$/.exec(quarterRaw) || /^([1-4])$/.exec(quarterRaw);
  let periodStart = "";
  let periodEnd = "";
  if (Number.isInteger(yearValue) && yearValue >= 2023 && yearValue <= 2100) {
    if (quarterMatch) {
      const quarter = Number(quarterMatch[1]);
      const startMonth = (quarter - 1) * 3 + 1;
      const endMonth = startMonth + 2;
      const endDay = endMonth === 2 ? 28 : [4, 6, 9, 11].includes(endMonth) ? 30 : 31;
      periodStart = `${yearValue}-${String(startMonth).padStart(2, "0")}-01`;
      periodEnd = `${yearValue}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;
    } else {
      periodStart = `${yearValue}-01-01`;
      periodEnd = `${yearValue}-12-31`;
    }
  }

  function approvedCalibrationEvidence(evidenceId: string | undefined): boolean {
    if (!evidenceId) return false;
    const record = caseData.evidenceRegister.find((item) => item.evidenceId === evidenceId);
    return Boolean(
      record &&
      record.reviewStatus === "APPROVED" &&
      record.supportStatus === "SUPPORTED" &&
      record.malwareScanStatus === "CLEAN"
    );
  }

  function boundedUncertainty(value: unknown): boolean {
    const parsed = decimal(value);
    return parsed !== null && parsed.gte(0) && parsed.lte(100);
  }

  function boundedTier(value: unknown): boolean {
    const raw = String(value || "").trim();
    if (!raw) return false;
    const parsed = decimal(raw);
    return parsed !== null && parsed.gte(1) && parsed.lte(4) && parsed.equals(parsed.toDecimalPlaces(0));
  }

  function calibrationCoversPeriod(calibrationDate: string, validityEnd: string): boolean {
    if (!periodStart || !periodEnd) return false;
    if (!isoDate.test(calibrationDate) || !isoDate.test(validityEnd)) return false;
    return calibrationDate <= periodStart && validityEnd >= periodEnd && calibrationDate <= validityEnd;
  }

  if (processes.length === 0) {
    add("QC_13", "Production process register", "BLOCKER", "At least one production process is required before sealing.", "REM_ADD_PRODUCTION_PROCESS");
  } else {
    const duplicateProcessIds = processes.length !== processIds.size;
    let processInvalid = duplicateProcessIds;
    let attributedDirectSum = new Decimal(0);
    let attributedIndirectSum = new Decimal(0);
    let hasAllAttributed = true;
    for (const [index, process] of processes.entries()) {
      if (!process.name.trim()) {
        processInvalid = true;
        add(`QC_13_${index}`, `Production process ${index + 1} name`, "BLOCKER", "Process name is required.", "REM_COMPLETE_PRODUCTION_PROCESS");
        continue;
      }
      if (process.producedGoodIndexes.some((goodIndex) => !Number.isInteger(goodIndex) || goodIndex < 0 || goodIndex >= goodsCount)) {
        processInvalid = true;
        add(`QC_13_${index}`, `Production process ${index + 1} goods link`, "BLOCKER", "producedGoodIndexes must reference existing goods rows.", "REM_LINK_PROCESS_GOODS");
        continue;
      }
      const direct = decimal(process.attributedDirectTco2e);
      const indirect = decimal(process.attributedIndirectTco2e);
      if (direct === null || direct.lt(0) || indirect === null || indirect.lt(0)) {
        hasAllAttributed = false;
        processInvalid = true;
        add(`QC_13_${index}`, `Production process ${index + 1} attribution`, "BLOCKER", "Attributed direct and indirect tCO2e must be finite and non-negative.", "REM_COMPLETE_PROCESS_ATTRIBUTION");
        continue;
      }
      attributedDirectSum = attributedDirectSum.plus(direct);
      attributedIndirectSum = attributedIndirectSum.plus(indirect);
      add(`QC_13_${index}`, `Production process ${index + 1}`, "PASS");
    }
    if (hasAllAttributed && !processInvalid) {
      const installationDirect = decimal(caseData.directEmissions.value);
      const electricity = decimal(caseData.electricityConsumed.value);
      const factor = decimal(caseData.gridEmissionFactor.value);
      if (installationDirect === null || electricity === null || factor === null) {
        add("QC_13", "Production process reconciliation", "BLOCKER", "Installation emissions inputs are required to reconcile process attribution.", "REM_COMPLETE_PROCESS_ATTRIBUTION");
      } else {
        const expectedIndirect = electricity.times(factor);
        if (attributedDirectSum.minus(installationDirect).abs().gt(ALLOCATION_TOLERANCE) || attributedIndirectSum.minus(expectedIndirect).abs().gt(ALLOCATION_TOLERANCE)) {
          add("QC_13", "Production process reconciliation", "BLOCKER", `Attributed process emissions must reconcile to installation totals within ${ALLOCATION_TOLERANCE.toString()}.`, "REM_RECONCILE_PROCESS_ATTRIBUTION");
        } else if (!duplicateProcessIds) {
          add("QC_13", "Production process register", "PASS");
        } else {
          add("QC_13", "Production process IDs", "BLOCKER", "Production process IDs must be unique.", "REM_UNIQUE_PROCESS_IDS");
        }
      }
    } else if (duplicateProcessIds) {
      add("QC_13", "Production process IDs", "BLOCKER", "Production process IDs must be unique.", "REM_UNIQUE_PROCESS_IDS");
    }
  }

  if (streams.length === 0) {
    add("QC_14", "Source stream register", "BLOCKER", "At least one source stream is required before sealing.", "REM_ADD_SOURCE_STREAM");
  } else if (streams.length !== streamIds.size) {
    add("QC_14", "Source stream IDs", "BLOCKER", "Source stream IDs must be unique.", "REM_UNIQUE_SOURCE_STREAM_IDS");
  } else {
    let streamPass = true;
    for (const [index, stream] of streams.entries()) {
      const instrumentOk = Boolean(stream.instrumentId.trim()) && meterIds.has(stream.instrumentId);
      const evidenceOk = approvedCalibrationEvidence(stream.calibrationEvidenceId);
      const datesOk = calibrationCoversPeriod(stream.calibrationDate, stream.calibrationValidityEnd);
      const uncertaintyOk = boundedUncertainty(stream.maximumPermissibleUncertaintyPercent) && boundedUncertainty(stream.achievedUncertaintyPercent);
      const achieved = decimal(stream.achievedUncertaintyPercent);
      const mpu = decimal(stream.maximumPermissibleUncertaintyPercent);
      const achievedWithinMpu = achieved !== null && mpu !== null && achieved.lte(mpu);
      const tiersOk = boundedTier(stream.appliedTier);
      if (!stream.name.trim() || !instrumentOk || !evidenceOk || !datesOk || !uncertaintyOk || !achievedWithinMpu || !tiersOk) {
        streamPass = false;
        add(
          `QC_14_${index}`,
          `Source stream ${index + 1}`,
          "BLOCKER",
          !instrumentOk
            ? "Source stream instrumentId must reference a meter in the meter register."
            : !evidenceOk
              ? "Source stream calibration evidence must be APPROVED, SUPPORTED and CLEAN."
              : !datesOk
                ? "Calibration dates must be ISO YYYY-MM-DD and cover the full reporting period."
                : !tiersOk
                  ? "Applied tier must be an integer from 1 through 4."
                  : "Uncertainty percents must be finite, within 0–100, and achieved ≤ maximum permissible.",
          "REM_COMPLETE_SOURCE_STREAM"
        );
      } else {
        add(`QC_14_${index}`, `Source stream ${index + 1}`, "PASS");
      }
    }
    if (streamPass) add("QC_14", "Source stream register", "PASS");
  }

  if (emissionSources.length === 0) {
    add("QC_15", "Emission source register", "BLOCKER", "At least one emission source is required before sealing.", "REM_ADD_EMISSION_SOURCE");
  } else {
    let emissionPass = true;
    const emissionIds = new Set(emissionSources.map((source) => source.sourceId));
    if (emissionIds.size !== emissionSources.length) {
      emissionPass = false;
      add("QC_15", "Emission source IDs", "BLOCKER", "Emission source IDs must be unique.", "REM_UNIQUE_EMISSION_SOURCE_IDS");
    }
    for (const [index, source] of emissionSources.entries()) {
      const processLinkOk = !source.linkedProcessId || processIds.has(source.linkedProcessId);
      const streamLinkOk = !source.linkedStreamId || streamIds.has(source.linkedStreamId);
      if (!source.name.trim() || !processLinkOk || !streamLinkOk) {
        emissionPass = false;
        add(
          `QC_15_${index}`,
          `Emission source ${index + 1}`,
          "BLOCKER",
          !source.name.trim()
            ? "Emission source name is required."
            : "Emission source process/stream links must reference existing register IDs.",
          "REM_COMPLETE_EMISSION_SOURCE"
        );
      } else {
        add(`QC_15_${index}`, `Emission source ${index + 1}`, "PASS");
      }
    }
    if (emissionPass) add("QC_15", "Emission source register", "PASS");
  }

  if (meters.length === 0) {
    add("QC_16", "Meter register", "BLOCKER", "At least one meter with calibration and uncertainty is required before sealing.", "REM_ADD_METER");
  } else if (meters.length !== meterIds.size) {
    add("QC_16", "Meter IDs", "BLOCKER", "Meter IDs must be unique.", "REM_UNIQUE_METER_IDS");
  } else {
    let meterPass = true;
    for (const [index, meter] of meters.entries()) {
      const evidenceOk = approvedCalibrationEvidence(meter.calibrationEvidenceId);
      const datesOk = calibrationCoversPeriod(meter.calibrationDate, meter.calibrationValidityEnd);
      const uncertaintyOk = boundedUncertainty(meter.maximumPermissibleUncertaintyPercent) && boundedUncertainty(meter.achievedUncertaintyPercent);
      const achieved = decimal(meter.achievedUncertaintyPercent);
      const mpu = decimal(meter.maximumPermissibleUncertaintyPercent);
      const achievedWithinMpu = achieved !== null && mpu !== null && achieved.lte(mpu);
      if (!meter.description.trim() || !evidenceOk || !datesOk || !uncertaintyOk || !achievedWithinMpu) {
        meterPass = false;
        add(
          `QC_16_${index}`,
          `Meter ${index + 1}`,
          "BLOCKER",
          !evidenceOk
            ? "Meter calibration evidence must be APPROVED, SUPPORTED and CLEAN."
            : !datesOk
              ? "Meter calibration dates must be ISO YYYY-MM-DD and cover the full reporting period."
              : "Meter uncertainty percents must be finite, within 0–100, and achieved ≤ maximum permissible.",
          "REM_COMPLETE_METER"
        );
      } else {
        add(`QC_16_${index}`, `Meter ${index + 1}`, "PASS");
      }
    }
    if (meterPass) add("QC_16", "Meter register", "PASS");
  }

  return results;
}
