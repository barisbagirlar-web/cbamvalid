import crypto from "node:crypto";
import type { AuditReadyCase } from "../schema";
import type { Finding, CorrectiveAction } from "../report/premium-dossier-schema";
import { runQualityControls } from "./quality-controls";
import { runEvidenceSufficiency, isEvidenceSupportedState } from "./evidence-sufficiency";
import { getReportingPeriodAssessment } from "./readiness-score";
import {
  applyWorkingFileReviewPolicy,
  isPendingReviewOnly,
} from "./working-file-review-policy";

function stableHashPrefix(subject: string): string {
  return crypto.createHash("sha256").update(subject).digest("hex").slice(0, 8);
}

export function generateFindingsAndActions(caseData: AuditReadyCase, assessmentTimestamp?: string): {
  findings: Finding[];
  correctiveActions: CorrectiveAction[];
} {
  const findings: Finding[] = [];
  const correctiveActions: CorrectiveAction[] = [];

  // 1. Process working-file quality controls. Pending organisation review is
  // not a file-integrity defect and therefore cannot block operator package
  // generation. Rejected review, malware, ownership, linkage, support and
  // calculation defects remain fail-closed.
  const qcs = runQualityControls(applyWorkingFileReviewPolicy(caseData));
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
      blocksVerifierHandover: blocksOperatorReadiness,
      createdDeterministicallyFrom: "runQualityControls:working-file-policy",
      action,
    });

    correctiveActions.push(action);
  }

  // 2. Process Evidence Sufficiency Gaps
  const sufficiencies = runEvidenceSufficiency(caseData, assessmentTimestamp);
  for (const row of sufficiencies) {
    if (isEvidenceSupportedState(row.state)) {
      continue;
    }

    const pendingReviewOnly = isPendingReviewOnly(
      caseData,
      row.evidenceIds,
      row.reasonCodes
    );
    let findingId = `FND-EVD-${row.requirementId}-${stableHashPrefix(row.inputPath)}`;

    let severity: Finding["severity"] = "MINOR";
    if (row.reasonCodes.includes("EVIDENCE_ANNUAL_COVERAGE_INCOMPLETE")) {
      findingId = "FND-EVIDENCE-ANNUAL-COVERAGE-INCOMPLETE";
      severity = "CRITICAL";
    } else if (row.state === "MISSING" || row.state === "MALWARE_UNCLEARED" || row.state === "HASH_MISMATCH" || row.state === "BYTE_SIZE_MISMATCH") {
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
      requiredAction: pendingReviewOnly
        ? `Complete the organisation review for evidence linked to '${row.inputPath}'.`
        : `Provide valid and approved evidence for input path '${row.inputPath}'.`,
      responsibleRole: pendingReviewOnly ? "INTERNAL_REVIEWER" : "DATA_PREPARER",
      targetDate: null,
      closureCondition: pendingReviewOnly
        ? `Organisation review for '${row.inputPath}' is APPROVED.`
        : `Evidence sufficiency check status for '${row.inputPath}' is SUPPORTED.`,
      closureEvidenceIds: [],
      state: "OPEN",
    };

    findings.push({
      findingId,
      ruleId: row.requirementId,
      severity,
      category,
      status: "OPEN",
      title: pendingReviewOnly
        ? `Organisation review pending for ${row.inputPath}`
        : `Evidence sufficiency for ${row.inputPath}`,
      description: pendingReviewOnly
        ? `The evidence is present, linked and structurally valid, but organisation review is still pending.`
        : `Evidence check failed with status '${row.state}'. Reason codes: ${row.reasonCodes.join(", ")}`,
      regulatoryOrTechnicalBasis: "Commission Implementing Regulation (EU) 2025/2546 - Article 6",
      affectedInputIds: [row.inputPath],
      affectedCalculationIds: [],
      affectedEvidenceIds: row.evidenceIds,
      affectedReportSectionIds: [],
      impactStatement: pendingReviewOnly
        ? `The operator working file may be generated, but the package is not ready for independent-verifier handover until organisation review is completed.`
        : `Unsupported or missing evidence for input path '${row.inputPath}'. State: ${row.state}.`,
      remediationRequirement: pendingReviewOnly
        ? `Complete organisation review for the linked evidence at ${row.inputPath}.`
        : `Upload approved, clean, and supported evidence file linked to ${row.inputPath}.`,
      blocksOperatorReadiness: row.blocksOperatorReadiness,
      blocksSealing: pendingReviewOnly ? false : row.blocksSealing,
      blocksVerifierHandover: row.blocksOperatorReadiness,
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
      blocksVerifierHandover: gap.isBlocking && status === "OPEN",
      createdDeterministicallyFrom: "caseGapAssessment",
      action,
    });

    correctiveActions.push(action);
  });

  // 4. Period assessment. A current/future or interim reporting period cannot
  // claim definitive annual readiness, but it may still produce an explicitly
  // conditional operator working file.
  const period = getReportingPeriodAssessment(caseData, assessmentTimestamp);
  if (!period.definitiveAnnualEligible) {
    if (period.type !== "DEFINITIVE_ANNUAL") {
      const findingId = "FND-PERIOD-NON-ANNUAL";
      const action: CorrectiveAction = {
        actionId: `ACT-${findingId}`,
        findingId,
        priority: "P0",
        requiredAction: "Update the reporting period to a definitive annual period and supply full-year data before independent-verifier handover.",
        responsibleRole: "OPERATOR_ADMIN",
        targetDate: null,
        closureCondition: "Reporting period is updated to a completed definitive annual period.",
        closureEvidenceIds: [],
        state: "OPEN",
      };

      findings.push({
        findingId,
        ruleId: "REQ-PERIOD-ANNUAL",
        severity: "CRITICAL_BLOCKER",
        category: "REPORTING_PERIOD",
        status: "OPEN",
        title: "Definitive Annual Reporting Period Required for Verifier Handover",
        description: "This case covers an interim or partial-year period. The operator working file may be generated, but it cannot be represented as a completed definitive annual package.",
        regulatoryOrTechnicalBasis: "Commission Implementing Regulation (EU) 2025/2546 - Article 5",
        affectedInputIds: ["reportingPeriod.quarter"],
        affectedCalculationIds: [],
        affectedEvidenceIds: [],
        affectedReportSectionIds: [],
        impactStatement: "Quarterly or partial-year data blocks definitive annual readiness and verifier handover, not operator working-file generation.",
        remediationRequirement: "Change the reporting period to a completed full year (ANNUAL) and link corresponding annual data before verifier handover.",
        blocksOperatorReadiness: true,
        blocksSealing: false,
        blocksVerifierHandover: true,
        createdDeterministicallyFrom: "getReportingPeriodAssessment",
        action,
      });

      correctiveActions.push(action);
    }

    // Add other specific period findings.
    for (const bhId of period.hardBlockerFindingIds) {
      if (bhId === "FND-PERIOD-NON-ANNUAL") continue;

      let title = "Reporting Period Assessment Blocker";
      let desc = `The reporting period fails definitive-readiness assessment due to ${bhId}.`;
      let inputId = "reportingPeriod.year";
      let blocksWorkingFile = true;

      if (bhId === "FND-PERIOD-FUTURE-END-DATE") {
        title = "Future Reporting Period End Date";
        desc = "The reporting period end date is in the future relative to the assessment timestamp. The operator working file may be generated, but definitive annual readiness and verifier handover remain blocked.";
        inputId = "reportingPeriod.endDate";
        blocksWorkingFile = false;
      } else if (bhId === "FND-PERIOD-MISSING-START-DATE") {
        title = "Missing Start Date";
        desc = "The reporting period start date is missing.";
        inputId = "reportingPeriod.startDate";
      } else if (bhId === "FND-PERIOD-MISSING-END-DATE") {
        title = "Missing End Date";
        desc = "The reporting period end date is missing.";
        inputId = "reportingPeriod.endDate";
      } else if (bhId === "FND-PERIOD-INVALID-CHRONOLOGY") {
        title = "Invalid Chronology";
        desc = "The reporting period end date is chronologically before the start date.";
        inputId = "reportingPeriod.endDate";
      } else if (bhId === "FND-PERIOD-INVALID-START-DATE") {
        title = "Invalid Start Date";
        desc = "The reporting period start date is invalid.";
        inputId = "reportingPeriod.startDate";
      } else if (bhId === "FND-PERIOD-INVALID-END-DATE") {
        title = "Invalid End Date";
        desc = "The reporting period end date is invalid.";
        inputId = "reportingPeriod.endDate";
      }

      const action: CorrectiveAction = {
        actionId: `ACT-${bhId}`,
        findingId: bhId,
        priority: "P0",
        requiredAction: blocksWorkingFile
          ? "Correct the reporting period dates before generating the working file."
          : "Complete the reporting period and refresh annual evidence before independent-verifier handover.",
        responsibleRole: "OPERATOR_ADMIN",
        targetDate: null,
        closureCondition: blocksWorkingFile
          ? "Reporting period dates are valid and complete."
          : "The reporting period has ended and full-year evidence is complete.",
        closureEvidenceIds: [],
        state: "OPEN",
      };

      findings.push({
        findingId: bhId,
        ruleId: "REQ-PERIOD-VALID",
        severity: "CRITICAL_BLOCKER",
        category: "REPORTING_PERIOD",
        status: "OPEN",
        title,
        description: desc,
        regulatoryOrTechnicalBasis: "Commission Implementing Regulation (EU) 2025/2546",
        affectedInputIds: [inputId],
        affectedCalculationIds: [],
        affectedEvidenceIds: [],
        affectedReportSectionIds: [],
        impactStatement: blocksWorkingFile
          ? "Invalid or incomplete reporting-period dates block working-file generation."
          : "A future period blocks definitive annual readiness and verifier handover, but not an explicitly conditional operator working file.",
        remediationRequirement: blocksWorkingFile
          ? "Ensure all reporting-period bounds are valid and complete."
          : "Refresh the file after period end with complete annual data and evidence.",
        blocksOperatorReadiness: true,
        blocksSealing: blocksWorkingFile,
        blocksVerifierHandover: true,
        createdDeterministicallyFrom: "getReportingPeriodAssessment",
        action,
      });
      correctiveActions.push(action);
    }
  }

  return { findings, correctiveActions };
}
