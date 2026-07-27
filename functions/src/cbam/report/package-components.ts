/**
 * Canonical sealed-package component contracts.
 * Cover page, annex index, ZIP layout, and public verification MUST all use these lists.
 */
export const REQUIRED_TOP_LEVEL_COMPONENTS = [
  "Product and Scope Definition.pdf",
  "CN Code Classification.pdf",
  "Data Request Checklist.pdf",
  "Monitoring Plan Summary.pdf",
  "Process Map.pdf",
  "System Boundary.pdf",
  "Source Stream Register.csv",
  "Emission Source Register.csv",
  "Meter Register.csv",
  "Activity Data Ledger.csv",
  "Evidence Register.csv",
  "Field Evidence Matrix.csv",
  "Methodology Decision Log.pdf",
  "Calculation Annex.pdf",
  "Operator Emissions Report.pdf",
  "Operator Summary Statement.pdf",
  "Verification Readiness Assessment.pdf",
  "Misstatement Register.csv",
  "Corrective Action Log.csv",
  "O3CI Field Mapping.csv",
  "Calculation Trace.json",
  "Data Integrity Manifest.json",
  "Manifest Signature.sig",
  "Units and Conversions Register.csv",
  "Carbon Price Register.csv",
  "Verifier Workspace.xlsx",
  "Supporting_Evidence/",
] as const;

export const REQUIRED_TOP_LEVEL_COMPONENTS_V5 = [
  "CBAMValid Verification Readiness & Evidence Assurance Dossier.pdf",
  "Complete Dossier Compilation.pdf",
  "Product Scope Assessment.pdf",
  "CN Code Reasoning.pdf",
  "Required Data Checklist.pdf",
  "Installation Monitoring Plan.pdf",
  "Production Process Map.pdf",
  "System Boundary Register.pdf",
  "Source Stream Register.csv",
  "Emission Source Register.csv",
  "Measurement and Meter Register.csv",
  "Activity Data Ledger.csv",
  "Evidence Register.csv",
  "Field-to-Evidence Matrix.csv",
  "Methodology Decision Log.pdf",
  "Embedded Emissions Calculation Annex.pdf",
  "Operator Emissions Report.pdf",
  "Misstatement and Non-Conformity Register.csv",
  "Corrective Action Log.csv",
  "O3CI Field Mapping.csv",
  "Calculation Trace.json",
  "Verifier Workspace.xlsx",
  "Data Integrity Manifest.json",
  "Manifest Signature.sig",
  "Supporting_Evidence/",
] as const;

export const REQUIRED_TOP_LEVEL_COMPONENT_COUNT = REQUIRED_TOP_LEVEL_COMPONENTS.length;
export const REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5 = REQUIRED_TOP_LEVEL_COMPONENTS_V5.length;
