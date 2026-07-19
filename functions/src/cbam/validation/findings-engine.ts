import crypto from "node:crypto";
import type { AuditReadyCase } from "../schema";
import type { Finding, CorrectiveAction } from "../report/premium-dossier-schema";
import { runQualityControls } from "./quality-controls";
import { runEvidenceSufficiency } from "./evidence-sufficiency";
import { getReportingPeriodAssessment } from "./readiness-score";

function stableHashPrefix(subject: string): string {
  return crypto.createHash("sha256").update(subject).digest("hex").slice(0, 8);
}

export function generateFindingsAndActions(caseData: AuditReadyCase): {
  findings: Finding[];
  correctiveActions: CorrectiveAction[];
} {
  const findings: Finding[] = [];
  const correctiveActions: CorrectiveAction[] = [];

  // 1. Process Quality Controls
  const qcs = runQualityControls(caseData);
  for (const qc of qcs) {
    if (qc.status === "PASS" || qc.status === "NOT_APPLICABLE") {
      continue;
    }

    const findingId = `FND-${qc.ruleId}-${stableHashPrefix(qc.name)}`;
    const severity = qc.status === "BLOCKER" ? "CRITICAL" : "MAJOR";

    let category: Finding["category"] = "DATA_QUALITY";
    if (qc.ruleId === "QC_00" || qc.ruleId === "QC_01") category = "IDENTITY_GAP";
    else if (qc.ruleId.startsWith("QC_03")) category = "SCOPE_GAP";
    else if (qc.ruleId === "QC_05A") category = "ALLOCATION_EXCEPTION";
    else if (qc.ruleId === "QC_06" || qc.ruleId === "QC_07" || qc.ruleId === "QC_08") category = "EVIDENCE_GAP";
    else if (qc.ruleId.startsWith("QC_09")) category = "PRECURSOR_EXCEPTION";
    else if (qc.ruleId === "QC_10") category = "EVIDENCE_INTEGRITY";

    const blocksOperatorReadiness = qc.status === "BLOCKER";
    const blocksSealing = qc.status === "BLOCKER";

    const action: CorrectiveAction = {
      actionId: `ACT-${findingId}`,
      findingId,
      priority: severity === "CRITICAL" ? "P0" : "P1",
      requiredAction: qc.remediationCode || `Address quality control issue ${qc.ruleId}.`,
      responsibleRole: "OPERATOR_ADMIN",
      targetDate: null,
      closureCondition: `Pass quality control check ${qc.ruleId}.`,
      closureEvidenceIds: [],
      state: "OPEN",
    };

    findings.push({
      findingId,
      ruleId: qc.ruleId,
      severity,
      category,
      status: "OPEN",
      title: qc.name,
      description: qc.message || "Quality control check failed.",
      regulatoryOrTechnicalBasis: "Commission Implementing Regulation (EU) 2025/2546",
      affectedInputIds: [qc.ruleId],
      affectedCalculationIds: [],
      affectedEvidenceIds: [],
      affectedReportSectionIds: [],
      impactStatement: qc.message || `Quality control check ${qc.name} is in failing status.`,
      remediationRequirement: qc.remediationCode || "Provide corrected input or evidence linkage.",
      blocksOperatorReadiness,
      blocksSealing,
      createdDeterministicallyFrom: "runQualityControls",
      action,
    });

    correctiveActions.push(action);
  }

  // 2. Process Evidence Sufficiency Gaps
  const sufficiencies = runEvidenceSufficiency(caseData);
  for (const row of sufficiencies) {
    if (row.state === "SUPPORTED") {
      continue;
    }

    const findingId = `FND-EVD-${row.requirementId}-${stableHashPrefix(row.inputPath)}`;

    let severity: Finding["severity"] = "MINOR";
    if (row.state === "MISSING" || row.state === "MALWARE_UNCLEARED" || row.state === "HASH_MISMATCH" || row.state === "BYTE_SIZE_MISMATCH") {
      severity = "CRITICAL";
    } else if (row.state === "PARTIALLY_SUPPORTED") {
      severity = "MATERIAL";
    } else if (row.state === "UNLINKED" || row.state === "OUT_OF_PERIOD") {
      severity = "MAJOR";
    }

    const category: Finding["category"] = (row.state === "HASH_MISMATCH" || row.state === "BYTE_SIZE_MISMATCH" || row.state === "MALWARE_UNCLEARED")
      ? "EVIDENCE_INTEGRITY"
      : "EVIDENCE_GAP";

    const action: CorrectiveAction = {
      actionId: `ACT-${findingId}`,
      findingId,
      priority: (severity === "CRITICAL" || severity === "MATERIAL") ? "P0" : "P1",
      requiredAction: `Provide valid and approved evidence for input path '${row.inputPath}'.`,
      responsibleRole: "DATA_PREPARER",
      targetDate: null,
      closureCondition: `Evidence sufficiency check status for '${row.inputPath}' is SUPPORTED.`,
      closureEvidenceIds: [],
      state: "OPEN",
    };

    findings.push({
      findingId,
      ruleId: row.requirementId,
      severity,
      category,
      status: "OPEN",
      title: `Evidence sufficiency for ${row.inputPath}`,
      description: `Evidence check failed with status '${row.state}'. Reason codes: ${row.reasonCodes.join(", ")}`,
      regulatoryOrTechnicalBasis: "Commission Implementing Regulation (EU) 2025/2546 - Article 6",
      affectedInputIds: [row.inputPath],
      affectedCalculationIds: [],
      affectedEvidenceIds: row.evidenceIds,
      affectedReportSectionIds: [],
      impactStatement: `Unsupported or missing evidence for input path '${row.inputPath}'. State: ${row.state}.`,
      remediationRequirement: `Upload approved, clean, and supported evidence file linked to ${row.inputPath}.`,
      blocksOperatorReadiness: row.blocksOperatorReadiness,
      blocksSealing: row.blocksSealing,
      createdDeterministicallyFrom: "runEvidenceSufficiency",
      action,
    });

    correctiveActions.push(action);
  }

  // 3. Keep resolved/accepted findings history if they were in the original case gap assessment
  // Since we are evolutionary, if there were manual findings in caseData.gapAssessment, we can convert them.
  caseData.gapAssessment.forEach((gap, index) => {
    // Avoid duplicating deterministic findings
    const ruleId = gap.affectedResult || `GAP_${index}`;
    const findingId = `FND-GAP-${ruleId}-${stableHashPrefix(gap.requirement)}`;
    if (findings.some((f) => f.findingId === findingId || f.ruleId === ruleId)) {
      return;
    }

    let status: Finding["status"] = "OPEN";
    if (gap.resolutionStatus === "RESOLVED" || gap.resolutionStatus === "CORRECTED" || gap.resolutionStatus === "RECALCULATED" || gap.resolutionStatus === "REVIEWED") {
      status = "RESOLVED";
    }

    let severity: Finding["severity"] = "MINOR";
    if (gap.severity === "BLOCKER" || gap.severity === "CRITICAL") severity = "CRITICAL";
    else if (gap.severity === "MAJOR") severity = "MAJOR";

    const action: CorrectiveAction = {
      actionId: `ACT-${findingId}`,
      findingId,
      priority: severity === "CRITICAL" ? "P0" : "P1",
      requiredAction: gap.suggestedAction,
      responsibleRole: "OPERATOR_ADMIN",
      targetDate: null,
      closureCondition: gap.requiredEvidence,
      closureEvidenceIds: gap.resolutionEvidenceIds || [],
      state: status === "RESOLVED" ? "CLOSED" : "OPEN",
    };

    findings.push({
      findingId,
      ruleId,
      severity,
      category: "DATA_QUALITY",
      status,
      title: gap.requirement,
      description: gap.whyItMatters,
      regulatoryOrTechnicalBasis: "Commission Implementing Regulation (EU) 2025/2546",
      affectedInputIds: gap.affectedResult ? [gap.affectedResult] : [],
      affectedCalculationIds: [],
      affectedEvidenceIds: [],
      affectedReportSectionIds: [],
      impactStatement: gap.whyItMatters,
      remediationRequirement: gap.suggestedAction,
      blocksOperatorReadiness: gap.isBlocking && status === "OPEN",
      blocksSealing: gap.isBlocking && status === "OPEN",
      createdDeterministicallyFrom: "caseGapAssessment",
      action,
    });

    correctiveActions.push(action);
  });

  // 4. Period Assessment Check
  const period = getReportingPeriodAssessment(caseData);
  if (!period.definitiveAnnualEligible) {
    const findingId = "FND-PERIOD-NON-ANNUAL";
    const action: CorrectiveAction = {
      actionId: `ACT-${findingId}`,
      findingId,
      priority: "P0",
      requiredAction: "Update the reporting period to a definitive annual period (e.g., ANNUAL) or supply full-year data to enable verifier review.",
      responsibleRole: "OPERATOR_ADMIN",
      targetDate: null,
      closureCondition: "Reporting period is updated to a definitive annual period.",
      closureEvidenceIds: [],
      state: "OPEN",
    };

    findings.push({
      findingId,
      ruleId: "REQ-PERIOD-ANNUAL",
      severity: "CRITICAL",
      category: "PERIOD_MISMATCH",
      status: "OPEN",
      title: "Definitive Annual Reporting Period Required",
      description: `The selected reporting period is not a definitive annual period (detected type: ${period.type}). A quarterly or partial-year period cannot pass definitive annual verifier readiness.`,
      regulatoryOrTechnicalBasis: "Commission Implementing Regulation (EU) 2025/2546 - Article 5",
      affectedInputIds: ["reportingPeriod.quarter"],
      affectedCalculationIds: [],
      affectedEvidenceIds: [],
      affectedReportSectionIds: [],
      impactStatement: "Quarterly or partial-year data blocks definitive annual readiness and package sealing.",
      remediationRequirement: "Change the reporting period to a full year (ANNUAL) and link corresponding annual data.",
      blocksOperatorReadiness: true,
      blocksSealing: true,
      createdDeterministicallyFrom: "getReportingPeriodAssessment",
      action,
    });

    correctiveActions.push(action);
  }

  return { findings, correctiveActions };
}
