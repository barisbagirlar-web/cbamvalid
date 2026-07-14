import { AuditReadyCase } from "../schema";
import { getSectorConfig, CbamSector } from "../sectors/sector-adapter";
import { Decimal } from "decimal.js";

export type QualityControlStatus = "PASS" | "WARNING" | "BLOCKER" | "NOT_APPLICABLE";

export type RemediationCode = 
  | "REM_PROVIDE_EORI"
  | "REM_CORRECT_EORI_FORMAT"
  | "REM_CORRECT_YEAR"
  | "REM_ADD_GOODS"
  | "REM_CORRECT_CN_CODE"
  | "REM_REMOVE_NEGATIVE_EMISSIONS"
  | "REM_ADD_PRECURSOR_EMISSIONS"
  | "REM_PROVIDE_EVIDENCE_REGISTER"
  | "REM_REMOVE_DUPLICATE_DOCS"
  | "REM_ATTACH_PRIMARY_EVIDENCE"
  | "REM_ATTACH_PAYMENT_PROOF"
  | "REM_UPDATE_DEFAULT_VALUES"
  | "NONE";

export interface QualityControlResult {
  ruleId: string;
  name: string;
  status: QualityControlStatus;
  message?: string;
  remediationCode: RemediationCode;
}

export function runQualityControls(caseData: AuditReadyCase): QualityControlResult[] {
  const results: QualityControlResult[] = [];

  const addResult = (ruleId: string, name: string, status: QualityControlStatus, message: string, remediationCode: RemediationCode) => {
    results.push({ ruleId, name, status, message, remediationCode });
  };

  const addPass = (ruleId: string, name: string) => {
    results.push({ ruleId, name, status: "PASS", message: "Rule passed.", remediationCode: "NONE" });
  };

  // 1. EORI format and validation
  const eori = caseData.importerIdentity.eoriNumber.value?.toString();
  if (!eori) {
    addResult("QC_01", "EORI presence", "BLOCKER", "EORI number is completely missing.", "REM_PROVIDE_EORI");
  } else if (eori.length < 8 || eori.length > 17) {
    addResult("QC_01", "EORI format", "BLOCKER", `EORI ${eori} violates format rules.`, "REM_CORRECT_EORI_FORMAT");
  } else {
    addPass("QC_01", "EORI format");
  }

  // 2. Reporting Period Coverage
  const yearStr = caseData.reportingPeriod.year.value;
  const year = yearStr ? Number(yearStr) : NaN;
  if (isNaN(year) || year < 2023) {
    addResult("QC_02", "Reporting Period Coverage", "BLOCKER", "Invalid or missing reporting year.", "REM_CORRECT_YEAR");
  } else {
    addPass("QC_02", "Reporting Period Coverage");
  }

  // 3. CN Code Validity & Annex I Scope
  if (caseData.goods.length === 0) {
    addResult("QC_03", "Annex I Scope", "BLOCKER", "No goods defined.", "REM_ADD_GOODS");
  } else {
    let allValid = true;
    for (const good of caseData.goods) {
      if (!good.cnCode.value || good.cnCode.value.toString().length !== 8) {
        allValid = false;
        addResult("QC_03", "CN Code Validity", "BLOCKER", `Invalid CN Code: ${good.cnCode.value}`, "REM_CORRECT_CN_CODE");
      }
      const chap = good.cnCode.value?.toString().substring(0, 2);
      if (!["72", "73", "76", "25", "31", "28", "27"].includes(chap || "")) {
        allValid = false;
        addResult("QC_04", "Annex I Scope", "BLOCKER", `CN Code ${good.cnCode.value} is not in Annex I.`, "REM_CORRECT_CN_CODE");
      }
    }
    if (allValid) {
      addPass("QC_03", "CN Code Validity");
      addPass("QC_04", "Annex I Scope");
    }
  }

  // 4. Impossible negative values
  let direct = 0;
  if (caseData.directEmissions.value) {
    direct = new Decimal(caseData.directEmissions.value).toNumber();
  }
  if (direct < 0) {
    addResult("QC_05", "Impossible Negative Values", "BLOCKER", "Direct emissions cannot be negative.", "REM_REMOVE_NEGATIVE_EMISSIONS");
  } else {
    addPass("QC_05", "Impossible Negative Values");
  }

  // 5. Precursor completeness
  const hasPrecursors = caseData.precursors.length > 0;
  if (hasPrecursors) {
    let complete = true;
    for (const p of caseData.precursors) {
      if (p.directEmissions.value === null || p.directEmissions.value === undefined || p.directEmissions.value === "") complete = false;
    }
    if (!complete) {
      addResult("QC_06", "Precursor Completeness", "BLOCKER", "Missing precursor emissions data.", "REM_ADD_PRECURSOR_EMISSIONS");
    } else {
      addPass("QC_06", "Precursor Completeness");
    }
  } else {
    addResult("QC_06", "Precursor Completeness", "WARNING", "No precursors declared. Ensure product is not complex.", "NONE");
  }

  // 6. Missing evidence
  if (caseData.evidenceRegister.length === 0) {
    addResult("QC_07", "Missing Evidence", "BLOCKER", "Evidence register is completely empty.", "REM_PROVIDE_EVIDENCE_REGISTER");
  } else {
    addPass("QC_07", "Missing Evidence");
  }

  // 7. Duplicate source documents
  const hashes = new Set();
  let hasDuplicates = false;
  for (const doc of caseData.evidenceRegister) {
    if (hashes.has(doc.fileHash)) {
      hasDuplicates = true;
    }
    hashes.add(doc.fileHash);
  }
  if (hasDuplicates) {
    addResult("QC_08", "Duplicate Source Documents", "BLOCKER", "Duplicate file hashes detected in Evidence Register.", "REM_REMOVE_DUPLICATE_DOCS");
  } else {
    addPass("QC_08", "Duplicate Source Documents");
  }

  // 8. Actual value without evidence
  if (caseData.directEmissions.sourceType === "PRIMARY" && caseData.evidenceRegister.length === 0) {
    addResult("QC_09", "Actual Value Without Evidence", "BLOCKER", "Claimed primary monitoring data but provided no evidence.", "REM_ATTACH_PRIMARY_EVIDENCE");
  } else if (caseData.directEmissions.sourceType === "PRIMARY") {
    addPass("QC_09", "Actual Value Without Evidence");
  } else {
    results.push({ ruleId: "QC_09", name: "Actual Value Without Evidence", status: "NOT_APPLICABLE", message: "Source type is not PRIMARY.", remediationCode: "NONE" });
  }

  // 9. Carbon price without payment proof
  if (caseData.carbonPriceRecords.length > 0) {
    let missingProof = false;
    for (const rec of caseData.carbonPriceRecords) {
      if (!rec.proofOfPaymentEvidenceId) missingProof = true;
    }
    if (missingProof) {
      addResult("QC_10", "Carbon Price Without Payment Proof", "BLOCKER", "Carbon price rebate claimed without attached payment proof.", "REM_ATTACH_PAYMENT_PROOF");
    } else {
      addPass("QC_10", "Carbon Price Without Payment Proof");
    }
  } else {
    results.push({ ruleId: "QC_10", name: "Carbon Price Without Payment Proof", status: "NOT_APPLICABLE", message: "No carbon price records.", remediationCode: "NONE" });
  }

  // 10. Default-value source expiry
  if (year > 2026 && caseData.directEmissions.sourceType === "DEFAULT") {
    addResult("QC_11", "Default Value Source Expiry", "WARNING", "Default values are severely restricted after transitional period.", "REM_UPDATE_DEFAULT_VALUES");
  } else {
    addPass("QC_11", "Default Value Source Expiry");
  }

  // 11. De minimis threshold
  let totalVol = new Decimal(0);
  for (const good of caseData.goods) {
    if (good.productionVolume.value) {
      totalVol = totalVol.plus(new Decimal(good.productionVolume.value));
    }
  }
  if (totalVol.lessThan(50) && totalVol.greaterThan(0)) {
    addResult("QC_12", "De Minimis Threshold", "WARNING", "Total volume under 50 tonnes. CBAM may not apply.", "NONE");
  } else {
    results.push({ ruleId: "QC_12", name: "De Minimis Threshold", status: "NOT_APPLICABLE", message: "Volume exceeds de minimis.", remediationCode: "NONE" });
  }

  return results;
}
