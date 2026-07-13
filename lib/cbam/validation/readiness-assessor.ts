import { AuditReadyCase, GapRecord, GapSeverity, InputDatum } from "../schema";

export type VerificationReadinessStatus =
  | "NOT_READY"
  | "READY_WITH_WARNINGS"
  | "READY_FOR_INDEPENDENT_VERIFICATION_PREPARATION";

export interface VerificationReadinessAssessment {
  status: VerificationReadinessStatus;
  criticalBlockers: GapRecord[];
  allGaps: GapRecord[];
  isEligibleForSealing: boolean;
  completenessPercentage: number;
  evidenceCoveragePercentage: number;
}

const SEVERITY_WEIGHTS: Record<GapSeverity, number> = {
  BLOCKER: 100,
  CRITICAL: 40,
  MAJOR: 15,
  MINOR: 5,
  ADVISORY: 1,
};

function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `gap_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function hasValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== "";
}

function finitePositive(value: unknown): boolean {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0;
}

function supportedEvidence(caseData: AuditReadyCase, path: string, datum: InputDatum): boolean {
  if (!datum.evidenceId) return false;
  const evidence = caseData.evidenceRegister.find((record) => record.evidenceId === datum.evidenceId);
  return Boolean(
    evidence &&
    evidence.linkedInputs.includes(path) &&
    evidence.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/`) &&
    /^[a-f0-9]{64}$/i.test(evidence.fileHash) &&
    evidence.sizeBytes > 0 &&
    (evidence.supportStatus === "SUPPORTED" || evidence.supportStatus === "PARTIALLY_SUPPORTED") &&
    evidence.reviewStatus !== "REJECTED"
  );
}

export function assessCaseReadiness(caseData: AuditReadyCase): VerificationReadinessAssessment {
  const gaps: GapRecord[] = [];

  const addGap = (params: {
    key: string;
    requirement: string;
    severity: GapSeverity;
    issueType?: GapRecord["issueType"];
    whyItMatters: string;
    requiredEvidence: string;
    suggestedAction: string;
    isBlocking?: boolean;
    affectedResult?: string;
  }) => {
    gaps.push({
      gapId: stableId(`${caseData.caseId || "draft"}:${params.key}`),
      issueType: params.issueType,
      requirement: params.requirement,
      severity: params.severity,
      affectedResult: params.affectedResult,
      whyItMatters: params.whyItMatters,
      requiredEvidence: params.requiredEvidence,
      suggestedAction: params.suggestedAction,
      isBlocking: params.isBlocking ?? params.severity === "BLOCKER",
      resolutionStatus: "OPEN",
    });
  };

  if (!hasValue(caseData.exporterIdentity.legalName.value)) {
    addGap({
      key: "exporter-name",
      requirement: "Exporter legal identity",
      severity: "BLOCKER",
      issueType: "calculation blocker",
      whyItMatters: "The dossier must identify the operator or exporter responsible for the installation data.",
      requiredEvidence: "Corporate or commercial identity record",
      suggestedAction: "Enter the exporter legal name.",
    });
  }

  if (!hasValue(caseData.importerIdentity.eoriNumber.value)) {
    addGap({
      key: "eori-missing",
      requirement: "Declarant EORI reference",
      severity: "BLOCKER",
      issueType: "missing evidence",
      whyItMatters: "The dossier must identify the declarant relationship for the reported goods.",
      requiredEvidence: "EORI or importer/declarant record",
      suggestedAction: "Enter the EORI number and link supporting evidence.",
    });
  } else if (!supportedEvidence(caseData, "importerIdentity.eoriNumber", caseData.importerIdentity.eoriNumber)) {
    addGap({
      key: "eori-evidence",
      requirement: "EORI evidence linkage",
      severity: "BLOCKER",
      issueType: "missing evidence",
      whyItMatters: "The EORI value must be traceable to a registered source document.",
      requiredEvidence: "Importer/declarant or customs document",
      suggestedAction: "Link an evidence record to the EORI field.",
    });
  }

  if (!hasValue(caseData.reportingPeriod.year.value)) {
    addGap({
      key: "reporting-year",
      requirement: "Reporting year",
      severity: "BLOCKER",
      issueType: "calculation blocker",
      whyItMatters: "Calculation and source rules are versioned by reporting period.",
      requiredEvidence: "Reporting-period selection",
      suggestedAction: "Enter the reporting year.",
    });
  }

  if (caseData.goods.length === 0) {
    addGap({
      key: "goods-empty",
      requirement: "Goods and CN groups",
      severity: "BLOCKER",
      issueType: "calculation blocker",
      whyItMatters: "At least one good is required to establish the calculation denominator and product scope.",
      requiredEvidence: "Customs classification and production records",
      suggestedAction: "Add a good with CN code, sector and production quantity.",
    });
  }

  caseData.goods.forEach((good, index) => {
    const prefix = `goods.${index}`;
    const cnCode = String(good.cnCode.value || "");
    if (!/^\d{8}$/.test(cnCode)) {
      addGap({
        key: `${prefix}.cnCode-format`,
        requirement: `Good ${index + 1} CN code format`,
        severity: "BLOCKER",
        issueType: "data inconsistency",
        whyItMatters: "The preparation workflow requires an eight-digit CN code before sector-specific review.",
        requiredEvidence: "Customs classification record",
        suggestedAction: "Enter an eight-digit CN code.",
      });
    } else if (!supportedEvidence(caseData, `${prefix}.cnCode`, good.cnCode)) {
      addGap({
        key: `${prefix}.cnCode-evidence`,
        requirement: `Good ${index + 1} CN code evidence`,
        severity: "BLOCKER",
        issueType: "missing evidence",
        whyItMatters: "The declared customs classification must be traceable to a source document.",
        requiredEvidence: "Customs declaration, tariff ruling or product classification record",
        suggestedAction: "Link evidence to the CN code field.",
      });
    }

    if (!finitePositive(good.productionVolume.value)) {
      addGap({
        key: `${prefix}.productionVolume-value`,
        requirement: `Good ${index + 1} production quantity`,
        severity: "BLOCKER",
        issueType: "calculation blocker",
        whyItMatters: "Positive production quantity is required for specific embedded-emissions calculation.",
        requiredEvidence: "Plant production ledger or inventory record",
        suggestedAction: "Enter a positive production quantity.",
      });
    } else if (!supportedEvidence(caseData, `${prefix}.productionVolume`, good.productionVolume)) {
      addGap({
        key: `${prefix}.productionVolume-evidence`,
        requirement: `Good ${index + 1} production evidence`,
        severity: "BLOCKER",
        issueType: "missing evidence",
        whyItMatters: "The calculation denominator must be traceable to source production records.",
        requiredEvidence: "Production ledger, inventory movement or signed output report",
        suggestedAction: "Link evidence to the production-volume field.",
      });
    }
  });

  if (!hasValue(caseData.installation.name.value)) {
    addGap({
      key: "installation-name",
      requirement: "Installation identity",
      severity: "BLOCKER",
      issueType: "calculation blocker",
      whyItMatters: "All production and emissions data must be assigned to a defined installation.",
      requiredEvidence: "Installation identity or operating record",
      suggestedAction: "Enter the installation name.",
    });
  }

  if (!hasValue(caseData.installation.productionRoute.value)) {
    addGap({
      key: "production-route",
      requirement: "Production route",
      severity: "BLOCKER",
      issueType: "methodology deviation",
      whyItMatters: "The production route supports the system-boundary and precursor review.",
      requiredEvidence: "Technical process description",
      suggestedAction: "Enter the production route.",
    });
  }

  if (!caseData.installation.systemBoundaries?.trim()) {
    addGap({
      key: "system-boundary",
      requirement: "System-boundary statement",
      severity: "MAJOR",
      issueType: "methodology deviation",
      whyItMatters: "The reviewer must understand which processes and transfers are included.",
      requiredEvidence: "Monitoring plan or process boundary description",
      suggestedAction: "Document the installation system boundary.",
      isBlocking: false,
    });
  }

  const materialInputs: Array<{ path: string; label: string; datum: InputDatum; evidence: string }> = [
    { path: "directEmissions", label: "Direct emissions", datum: caseData.directEmissions, evidence: "Monitoring record, fuel data or approved source method" },
    { path: "electricityConsumed", label: "Electricity consumed", datum: caseData.electricityConsumed, evidence: "Meter record or electricity invoice" },
    { path: "gridEmissionFactor", label: "Grid emission factor", datum: caseData.gridEmissionFactor, evidence: "Documented factor source or contract evidence" },
  ];

  materialInputs.forEach(({ path, label, datum, evidence }) => {
    if (!hasValue(datum.value)) {
      addGap({
        key: `${path}-value`,
        requirement: `${label} value`,
        severity: "BLOCKER",
        issueType: "calculation blocker",
        whyItMatters: `${label} is required by the selected calculation pathway.`,
        requiredEvidence: evidence,
        suggestedAction: `Enter ${label.toLowerCase()} and document the selected source method.`,
      });
      return;
    }
    if (Number(datum.value) < 0 || !Number.isFinite(Number(datum.value))) {
      addGap({
        key: `${path}-invalid`,
        requirement: `${label} numeric validity`,
        severity: "BLOCKER",
        issueType: "data inconsistency",
        whyItMatters: "The calculation engine accepts only finite, non-negative inputs for this field.",
        requiredEvidence: evidence,
        suggestedAction: `Correct the ${label.toLowerCase()} value.`,
      });
      return;
    }
    if (!supportedEvidence(caseData, path, datum)) {
      addGap({
        key: `${path}-evidence`,
        requirement: `${label} evidence linkage`,
        severity: "BLOCKER",
        issueType: "missing evidence",
        whyItMatters: "Material calculation inputs must be traceable to registered evidence.",
        requiredEvidence: evidence,
        suggestedAction: `Upload and link evidence to ${label.toLowerCase()}.`,
      });
    }
    if (datum.sourceType === "ESTIMATED") {
      addGap({
        key: `${path}-estimated`,
        requirement: `${label} source-method review`,
        severity: "MAJOR",
        issueType: "unresolved assumption",
        whyItMatters: "Estimated data requires an explicit methodology decision and may not satisfy the intended actual-value pathway.",
        requiredEvidence: "Documented estimation method and reviewer rationale",
        suggestedAction: "Replace the estimate with supported primary/default data or document the methodology decision.",
        isBlocking: false,
      });
    }
  });

  caseData.carbonPriceRecords.forEach((record, index) => {
    const claimed = Number(record.amountPaid) > 0 || Number(record.eligibleCertificateReduction) > 0;
    if (!claimed) return;
    const evidence = record.proofOfPaymentEvidenceId
      ? caseData.evidenceRegister.find((item) => item.evidenceId === record.proofOfPaymentEvidenceId)
      : undefined;
    if (!evidence || evidence.reviewStatus === "REJECTED") {
      addGap({
        key: `carbon-price-${index}-proof`,
        requirement: `Carbon-price record ${index + 1} payment proof`,
        severity: "BLOCKER",
        issueType: "missing evidence",
        whyItMatters: "A claimed adjustment must reference an actual registered payment-evidence record.",
        requiredEvidence: "Payment proof and applicable legislation/reference",
        suggestedAction: "Link an existing evidence record to this carbon-price claim.",
      });
    }
    if (!record.legislationReference.trim()) {
      addGap({
        key: `carbon-price-${index}-basis`,
        requirement: `Carbon-price record ${index + 1} legal basis`,
        severity: "BLOCKER",
        issueType: "methodology deviation",
        whyItMatters: "The adjustment methodology must record the claimed legal or technical basis.",
        requiredEvidence: "Legislation or scheme reference",
        suggestedAction: "Enter the legal or scheme reference supporting the claim.",
      });
    }
  });

  const openRecordedGaps = caseData.gapAssessment.filter((gap) => gap.resolutionStatus !== "RESOLVED");
  gaps.push(...openRecordedGaps);

  const materialEvidenceChecks = [
    supportedEvidence(caseData, "importerIdentity.eoriNumber", caseData.importerIdentity.eoriNumber),
    supportedEvidence(caseData, "directEmissions", caseData.directEmissions),
    supportedEvidence(caseData, "electricityConsumed", caseData.electricityConsumed),
    supportedEvidence(caseData, "gridEmissionFactor", caseData.gridEmissionFactor),
    ...caseData.goods.flatMap((good, index) => [
      supportedEvidence(caseData, `goods.${index}.cnCode`, good.cnCode),
      supportedEvidence(caseData, `goods.${index}.productionVolume`, good.productionVolume),
    ]),
  ];
  const evidenceCoveragePercentage = materialEvidenceChecks.length === 0
    ? 0
    : Math.round((materialEvidenceChecks.filter(Boolean).length / materialEvidenceChecks.length) * 100);

  const criticalBlockers = gaps.filter((gap) => gap.isBlocking || gap.severity === "BLOCKER");
  const penalty = gaps.reduce((total, gap) => total + SEVERITY_WEIGHTS[gap.severity], 0);
  const completenessPercentage = criticalBlockers.length > 0 ? 0 : Math.max(0, 100 - penalty);

  const status: VerificationReadinessStatus = criticalBlockers.length > 0
    ? "NOT_READY"
    : gaps.length > 0
      ? "READY_WITH_WARNINGS"
      : "READY_FOR_INDEPENDENT_VERIFICATION_PREPARATION";

  return {
    status,
    criticalBlockers,
    allGaps: gaps,
    isEligibleForSealing: criticalBlockers.length === 0,
    completenessPercentage,
    evidenceCoveragePercentage,
  };
}
