import { AuditReadyCase } from "../schema";


export type QualityControlStatus = "PASS" | "WARNING" | "BLOCKER" | "NOT_APPLICABLE";

export interface QualityControlResult {
  ruleId: string;
  name: string;
  status: QualityControlStatus;
  message?: string;
}

export function runQualityControls(caseData: AuditReadyCase): QualityControlResult[] {
  const results: QualityControlResult[] = [];

  const addResult = (ruleId: string, name: string, status: QualityControlStatus, message?: string) => {
    results.push({ ruleId, name, status, message });
  };

  // 1. EORI format and validation
  const eori = caseData.importerIdentity.eoriNumber.value?.toString();
  if (!eori) {
    addResult("QC_01", "EORI presence", "BLOCKER", "EORI number is completely missing.");
  } else if (eori.length < 8 || eori.length > 17) {
    addResult("QC_01", "EORI format", "BLOCKER", `EORI ${eori} violates format rules.`);
  } else {
    addResult("QC_01", "EORI format", "PASS");
  }

  // 2. Reporting Period Coverage
  const year = Number(caseData.reportingPeriod.year.value);
  if (!year || year < 2023) {
    addResult("QC_02", "Reporting Period Coverage", "BLOCKER", "Invalid or missing reporting year.");
  } else {
    addResult("QC_02", "Reporting Period Coverage", "PASS");
  }

  // 3. CN Code Validity & Annex I Scope
  if (caseData.goods.length === 0) {
    addResult("QC_03", "Annex I Scope", "BLOCKER", "No goods defined.");
  } else {
    let allValid = true;
    for (const good of caseData.goods) {
      if (!good.cnCode.value || good.cnCode.value.toString().length !== 8) {
        allValid = false;
        addResult("QC_03", "CN Code Validity", "BLOCKER", `Invalid CN Code: ${good.cnCode.value}`);
      }
      // Extremely basic mock scope check
      const chap = good.cnCode.value?.toString().substring(0, 2);
      if (!["72", "73", "76", "25", "31", "28", "27"].includes(chap || "")) {
        allValid = false;
        addResult("QC_04", "Annex I Scope", "BLOCKER", `CN Code ${good.cnCode.value} is not in Annex I.`);
      }
    }
    if (allValid) {
      addResult("QC_03", "CN Code Validity", "PASS");
      addResult("QC_04", "Annex I Scope", "PASS");
    }
  }

  // 4. Impossible negative values
  const direct = Number(caseData.directEmissions.value);
  if (direct < 0) {
    addResult("QC_05", "Impossible Negative Values", "BLOCKER", "Direct emissions cannot be negative.");
  } else {
    addResult("QC_05", "Impossible Negative Values", "PASS");
  }

  // 5. Precursor completeness
  const hasPrecursors = caseData.precursors.length > 0;
  if (hasPrecursors) {
    let complete = true;
    for (const p of caseData.precursors) {
      if (!p.directEmissions.value && p.directEmissions.value !== 0) complete = false;
    }
    if (!complete) {
      addResult("QC_06", "Precursor Completeness", "BLOCKER", "Missing precursor emissions data.");
    } else {
      addResult("QC_06", "Precursor Completeness", "PASS");
    }
  } else {
    addResult("QC_06", "Precursor Completeness", "WARNING", "No precursors declared. Ensure product is not complex.");
  }

  // 6. Missing evidence
  if (caseData.evidenceRegister.length === 0) {
    addResult("QC_07", "Missing Evidence", "CRITICAL" as QualityControlStatus, "Warning: The evidence register is completely empty. We will escalate this to a BLOCKER if sealing.");
    // Temporarily using BLOCKER in the QC engine proper:
    addResult("QC_07", "Missing Evidence (Sealing)", "BLOCKER", "Evidence register is completely empty.");
  } else {
    addResult("QC_07", "Missing Evidence", "PASS");
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
    addResult("QC_08", "Duplicate Source Documents", "BLOCKER", "Duplicate file hashes detected in Evidence Register.");
  } else {
    addResult("QC_08", "Duplicate Source Documents", "PASS");
  }

  // 8. Actual value without evidence
  if (caseData.directEmissions.sourceType === "PRIMARY" && caseData.evidenceRegister.length === 0) {
    addResult("QC_09", "Actual Value Without Evidence", "BLOCKER", "Claimed primary monitoring data but provided no evidence.");
  } else if (caseData.directEmissions.sourceType === "PRIMARY") {
    addResult("QC_09", "Actual Value Without Evidence", "PASS");
  } else {
    addResult("QC_09", "Actual Value Without Evidence", "NOT_APPLICABLE");
  }

  // 9. Carbon price without payment proof
  if (caseData.carbonPriceRecords.length > 0) {
    let missingProof = false;
    for (const rec of caseData.carbonPriceRecords) {
      if (!rec.proofOfPaymentEvidenceId) missingProof = true;
    }
    if (missingProof) {
      addResult("QC_10", "Carbon Price Without Payment Proof", "BLOCKER", "Carbon price rebate claimed without attached payment proof.");
    } else {
      addResult("QC_10", "Carbon Price Without Payment Proof", "PASS");
    }
  } else {
    addResult("QC_10", "Carbon Price Without Payment Proof", "NOT_APPLICABLE");
  }

  // 10. Default-value source expiry
  // MOCK: assuming default values are valid for 2026
  if (year > 2026 && caseData.directEmissions.sourceType === "DEFAULT") {
    addResult("QC_11", "Default Value Source Expiry", "WARNING", "Default values are severely restricted after transitional period.");
  } else {
    addResult("QC_11", "Default Value Source Expiry", "PASS");
  }

  // 11. De minimis threshold
  let totalVol = 0;
  for (const good of caseData.goods) totalVol += Number(good.productionVolume.value || 0);
  if (totalVol < 50 && totalVol > 0) {
    addResult("QC_12", "De Minimis Threshold", "WARNING", "Total volume under 50 tonnes. CBAM may not apply.");
  } else {
    addResult("QC_12", "De Minimis Threshold", "NOT_APPLICABLE");
  }

  return results;
}
