export const PACKAGE_COMPONENTS = [
  {
    id: "productScopeAssessment",
    filename: "01_Product_Scope_Assessment.pdf",
    required: true,
    producer: "scopeAssessmentProducer",
    kind: "pdf"
  },
  {
    id: "cnCodeReasoning",
    filename: "02_CN_Code_Reasoning.pdf",
    required: true,
    producer: "cnCodeReasoningProducer",
    kind: "pdf"
  },
  {
    id: "requiredDataChecklist",
    filename: "03_Required_Data_Checklist.pdf",
    required: true,
    producer: "dataChecklistProducer",
    kind: "pdf"
  },
  {
    id: "installationMonitoringPlan",
    filename: "04_Installation_Monitoring_Plan.pdf",
    required: true,
    producer: "monitoringPlanProducer",
    kind: "pdf"
  },
  {
    id: "productionProcessMap",
    filename: "05_Production_Process_Map.pdf",
    required: true,
    producer: "processMapProducer",
    kind: "pdf"
  },
  {
    id: "systemBoundaryRegister",
    filename: "06_System_Boundary_Register.pdf",
    required: true,
    producer: "boundaryRegisterProducer",
    kind: "pdf"
  },
  {
    id: "sourceStreamRegister",
    filename: "07_Source_Stream_Register.csv",
    required: true,
    producer: "sourceStreamRegisterProducer",
    kind: "csv"
  },
  {
    id: "emissionSourceRegister",
    filename: "08_Emission_Source_Register.csv",
    required: true,
    producer: "emissionSourceRegisterProducer",
    kind: "csv"
  },
  {
    id: "measurementMeterRegister",
    filename: "09_Measurement_and_Meter_Register.csv",
    required: true,
    producer: "measurementMeterRegisterProducer",
    kind: "csv"
  },
  {
    id: "activityDataLedger",
    filename: "10_Activity_Data_Ledger.csv",
    required: true,
    producer: "activityDataLedgerProducer",
    kind: "csv"
  },
  {
    id: "evidenceRegister",
    filename: "11_Evidence_Register.csv",
    required: true,
    producer: "evidenceRegisterProducer",
    kind: "csv"
  },
  {
    id: "fieldToEvidenceMatrix",
    filename: "12_Field_to_Evidence_Matrix.csv",
    required: true,
    producer: "fieldToEvidenceMatrixProducer",
    kind: "csv"
  },
  {
    id: "methodologyDecisionLog",
    filename: "13_Methodology_Decision_Log.pdf",
    required: true,
    producer: "methodologyDecisionLogProducer",
    kind: "pdf"
  },
  {
    id: "calculationAnnex",
    filename: "14_Embedded_Emissions_Calculation_Annex.pdf",
    required: true,
    producer: "calculationAnnexProducer",
    kind: "pdf"
  },
  {
    id: "operatorEmissionsReport",
    filename: "15_Operator_Emissions_Report.pdf",
    required: true,
    producer: "operatorEmissionsReportProducer",
    kind: "pdf"
  },
  {
    id: "operatorSummaryEmissionsReport",
    filename: "16_Operator_Summary_Emissions_Report.pdf",
    required: true,
    producer: "operatorSummaryReportProducer",
    kind: "pdf"
  },
  {
    id: "verificationReadinessAssessment",
    filename: "17_Verification_Readiness_Assessment.pdf",
    required: true,
    producer: "readinessAssessmentProducer",
    kind: "pdf"
  },
  {
    id: "misstatementRegister",
    filename: "18_Misstatement_and_Non_Conformity_Register.csv",
    required: true,
    producer: "misstatementRegisterProducer",
    kind: "csv"
  },
  {
    id: "correctiveActionLog",
    filename: "19_Corrective_Action_Log.csv",
    required: true,
    producer: "correctiveActionLogProducer",
    kind: "csv"
  },
  {
    id: "o3ciFieldMapping",
    filename: "20_O3CI_Field_Mapping.csv",
    required: true,
    producer: "o3ciFieldMappingProducer",
    kind: "csv"
  },
  {
    id: "calculationTrace",
    filename: "21_Calculation_Trace.json",
    required: true,
    producer: "calculationTraceProducer",
    kind: "json"
  },
  {
    id: "dataIntegrityManifest",
    filename: "22_Data_Integrity_Manifest.json",
    required: true,
    producer: "dataIntegrityManifestProducer",
    kind: "json"
  },
  {
    id: "supportingEvidence",
    filename: "23_Supporting_Evidence/",
    required: true,
    producer: "supportingEvidenceProducer",
    kind: "directory"
  },
  {
    id: "executiveVerificationReadinessSummary",
    filename: "24_Executive_Verification_Readiness_Summary.pdf",
    required: true,
    producer: "executiveReadinessSummaryProducer",
    kind: "pdf"
  },
  {
    id: "perGoodEmbeddedEmissionsSchedule",
    filename: "25_Per_Good_Embedded_Emissions_Schedule.csv",
    required: true,
    producer: "perGoodEmissionsProducer",
    kind: "csv"
  },
  {
    id: "carbonPricePaidSchedule",
    filename: "26_Carbon_Price_Paid_Schedule.csv",
    required: true,
    producer: "carbonPricePaidProducer",
    kind: "csv"
  },
  {
    id: "readMeAndVerifierNavigationGuide",
    filename: "27_Read_Me_and_Verifier_Navigation_Guide.pdf",
    required: true,
    producer: "navigationGuideProducer",
    kind: "pdf"
  }
] as const;

export type PackageComponent = (typeof PACKAGE_COMPONENTS)[number];
export type PackageComponentId = PackageComponent["id"];
export type PackageComponentFilename = PackageComponent["filename"];
export type PackageComponentKind = PackageComponent["kind"];
