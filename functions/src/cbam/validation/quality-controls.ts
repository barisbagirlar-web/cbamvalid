import { AuditReadyCase, InputDatum } from "../schema";

export type QualityControlStatus = "PASS" | "WARNING" | "BLOCKER" | "NOT_APPLICABLE";

export interface QualityControlResult {
  ruleId: string;
  name: string;
  status: QualityControlStatus;
  message?: string;
  remediationCode?: string;
}

function finiteNonNegative(value: unknown): boolean {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0;
}

function finitePositive(value: unknown): boolean {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0;
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
    record.reviewStatus !== "REJECTED" &&
    (record.supportStatus === "SUPPORTED" || record.supportStatus === "PARTIALLY_SUPPORTED")
  );
}

export function runQualityControls(caseData: AuditReadyCase): QualityControlResult[] {
  const results: QualityControlResult[] = [];
  const add = (
    ruleId: string,
    name: string,
    status: QualityControlStatus,
    message?: string,
    remediationCode?: string
  ) => results.push({ ruleId, name, status, message, remediationCode });

  const eori = String(caseData.importerIdentity.eoriNumber.value || "").trim();
  if (!eori) {
    add("QC_01", "EORI presence", "BLOCKER", "EORI number is missing.", "REM_PROVIDE_EORI");
  } else if (!/^[A-Z]{2}[A-Z0-9]{6,15}$/i.test(eori)) {
    add("QC_01", "EORI format", "BLOCKER", "EORI must contain a two-letter country prefix followed by 6–15 alphanumeric characters.", "REM_CORRECT_EORI_FORMAT");
  } else if (!supportedEvidence(caseData, "importerIdentity.eoriNumber", caseData.importerIdentity.eoriNumber)) {
    add("QC_01", "EORI evidence", "BLOCKER", "EORI is not linked to a supported evidence record.", "REM_LINK_EORI_EVIDENCE");
  } else {
    add("QC_01", "EORI format and evidence", "PASS");
  }

  const year = Number(caseData.reportingPeriod.year.value);
  if (!Number.isInteger(year) || year < 2026 || year > 2100) {
    add("QC_02", "Definitive-period reporting year", "BLOCKER", "Enter a valid definitive-period reporting year from 2026 onward.", "REM_CORRECT_REPORTING_YEAR");
  } else {
    add("QC_02", "Definitive-period reporting year", "PASS");
  }

  if (caseData.goods.length === 0) {
    add("QC_03", "Goods definition", "BLOCKER", "No goods are defined.", "REM_ADD_GOOD");
  } else {
    caseData.goods.forEach((good, index) => {
      const cnPath = `goods.${index}.cnCode`;
      const productionPath = `goods.${index}.productionVolume`;
      const cnCode = String(good.cnCode.value || "");

      if (!/^\d{8}$/.test(cnCode)) {
        add(`QC_03_${index + 1}`, `Good ${index + 1} CN code format`, "BLOCKER", "CN code must contain exactly eight digits.", "REM_CORRECT_CN_CODE");
      } else if (!supportedEvidence(caseData, cnPath, good.cnCode)) {
        add(`QC_03_${index + 1}`, `Good ${index + 1} CN code evidence`, "BLOCKER", "CN code is not linked to supporting evidence.", "REM_LINK_CN_EVIDENCE");
      } else {
        add(`QC_03_${index + 1}`, `Good ${index + 1} CN code format and evidence`, "PASS");
      }

      if (!finitePositive(good.productionVolume.value)) {
        add(`QC_04_${index + 1}`, `Good ${index + 1} production quantity`, "BLOCKER", "Production quantity must be finite and greater than zero.", "REM_CORRECT_PRODUCTION_QUANTITY");
      } else if (!supportedEvidence(caseData, productionPath, good.productionVolume)) {
        add(`QC_04_${index + 1}`, `Good ${index + 1} production evidence`, "BLOCKER", "Production quantity is not linked to supporting evidence.", "REM_LINK_PRODUCTION_EVIDENCE");
      } else {
        add(`QC_04_${index + 1}`, `Good ${index + 1} production quantity and evidence`, "PASS");
      }

      if (!["IRON_AND_STEEL", "ALUMINIUM", "CEMENT", "FERTILISERS", "HYDROGEN", "ELECTRICITY"].includes(good.sector)) {
        add(`QC_05_${index + 1}`, `Good ${index + 1} sector mapping`, "BLOCKER", "The selected sector is unsupported by the active calculation engine.", "REM_SELECT_SUPPORTED_SECTOR");
      } else {
        add(`QC_05_${index + 1}`, `Good ${index + 1} sector mapping`, "PASS");
      }
    });
  }

  const materialInputs: Array<{ ruleId: string; path: string; name: string; datum: InputDatum }> = [
    { ruleId: "QC_06", path: "directEmissions", name: "Direct emissions", datum: caseData.directEmissions },
    { ruleId: "QC_07", path: "electricityConsumed", name: "Electricity consumed", datum: caseData.electricityConsumed },
    { ruleId: "QC_08", path: "gridEmissionFactor", name: "Grid emission factor", datum: caseData.gridEmissionFactor },
  ];

  for (const item of materialInputs) {
    if (!finiteNonNegative(item.datum.value)) {
      add(item.ruleId, item.name, "BLOCKER", `${item.name} must be a finite, non-negative number.`, `REM_CORRECT_${item.ruleId}`);
    } else if (!supportedEvidence(caseData, item.path, item.datum)) {
      add(item.ruleId, `${item.name} evidence`, "BLOCKER", `${item.name} is not linked to a supported evidence record.`, `REM_LINK_${item.ruleId}_EVIDENCE`);
    } else if (item.datum.sourceType === "ESTIMATED") {
      add(item.ruleId, `${item.name} source method`, "WARNING", `${item.name} uses an estimate and requires an explicit methodology decision before external reliance.`, `REM_DOCUMENT_${item.ruleId}_METHOD`);
    } else {
      add(item.ruleId, `${item.name} value and evidence`, "PASS");
    }
  }

  if (caseData.precursors.length === 0) {
    add("QC_09", "Precursor review", "WARNING", "No precursor records are declared. Confirm that the selected route and goods do not require precursor treatment.", "REM_CONFIRM_PRECURSOR_SCOPE");
  } else {
    caseData.precursors.forEach((precursor, index) => {
      if (!finiteNonNegative(precursor.directEmissions.value) || !finiteNonNegative(precursor.indirectEmissions.value)) {
        add(`QC_09_${index + 1}`, `Precursor ${index + 1} emissions`, "BLOCKER", "Precursor direct and indirect emissions must be finite and non-negative.", "REM_CORRECT_PRECURSOR_EMISSIONS");
      } else {
        add(`QC_09_${index + 1}`, `Precursor ${index + 1} emissions`, "PASS");
      }
    });
  }

  const seenHashes = new Set<string>();
  let duplicateHash = false;
  let invalidEvidenceMetadata = false;
  for (const evidence of caseData.evidenceRegister) {
    const normalizedHash = evidence.fileHash.toLowerCase();
    if (seenHashes.has(normalizedHash)) duplicateHash = true;
    seenHashes.add(normalizedHash);
    if (
      !/^[a-f0-9]{64}$/.test(normalizedHash) ||
      evidence.sizeBytes <= 0 ||
      !evidence.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/`) ||
      evidence.linkedInputs.length === 0
    ) {
      invalidEvidenceMetadata = true;
    }
  }

  if (caseData.evidenceRegister.length === 0) {
    add("QC_10", "Evidence register", "BLOCKER", "Evidence register is empty.", "REM_UPLOAD_EVIDENCE");
  } else if (invalidEvidenceMetadata) {
    add("QC_10", "Evidence metadata integrity", "BLOCKER", "One or more evidence records have invalid hash, size, ownership path or field linkage.", "REM_CORRECT_EVIDENCE_METADATA");
  } else if (duplicateHash) {
    add("QC_10", "Duplicate source documents", "BLOCKER", "Duplicate evidence hashes were detected.", "REM_REMOVE_DUPLICATE_EVIDENCE");
  } else {
    add("QC_10", "Evidence register integrity", "PASS");
  }

  if (caseData.carbonPriceRecords.length === 0) {
    add("QC_11", "Carbon-price adjustment evidence", "NOT_APPLICABLE");
  } else {
    caseData.carbonPriceRecords.forEach((record, index) => {
      const claimed = Number(record.amountPaid) > 0 || Number(record.eligibleCertificateReduction) > 0;
      if (!claimed) {
        add(`QC_11_${index + 1}`, `Carbon-price record ${index + 1}`, "NOT_APPLICABLE");
        return;
      }
      const proof = record.proofOfPaymentEvidenceId
        ? caseData.evidenceRegister.find((item) => item.evidenceId === record.proofOfPaymentEvidenceId)
        : undefined;
      if (!proof || proof.reviewStatus === "REJECTED") {
        add(`QC_11_${index + 1}`, `Carbon-price record ${index + 1} payment proof`, "BLOCKER", "The claimed adjustment does not reference an accepted evidence record.", "REM_LINK_CARBON_PRICE_PROOF");
      } else if (!record.legislationReference.trim()) {
        add(`QC_11_${index + 1}`, `Carbon-price record ${index + 1} legal basis`, "BLOCKER", "The claimed adjustment is missing its scheme or legislation reference.", "REM_ADD_CARBON_PRICE_BASIS");
      } else {
        add(`QC_11_${index + 1}`, `Carbon-price record ${index + 1} evidence`, "PASS");
      }
    });
  }

  const openRecordedFindings = caseData.gapAssessment.filter((gap) => gap.resolutionStatus !== "RESOLVED");
  if (openRecordedFindings.some((gap) => gap.isBlocking || gap.severity === "BLOCKER")) {
    add("QC_12", "Recorded blocking findings", "BLOCKER", "The dossier contains unresolved blocking findings.", "REM_RESOLVE_BLOCKING_FINDINGS");
  } else if (openRecordedFindings.length > 0) {
    add("QC_12", "Recorded open findings", "WARNING", "The dossier contains unresolved non-blocking findings.", "REM_REVIEW_OPEN_FINDINGS");
  } else {
    add("QC_12", "Recorded findings", "PASS");
  }

  return results;
}
