import { createHash } from "node:crypto";
import { AuditReadyCaseSchema } from "../functions/src/cbam/schema";
import { performDossierCalculations } from "../functions/src/cbam/calculator";
import { runQualityControls } from "../functions/src/cbam/validation/quality-controls";
import {
  deriveEnterprise1000Model,
  upgradeArtifactsToEnterprise1000,
} from "../functions/src/cbam/report/enterprise-1000-value-layer";
import { buildUnsignedVerifierArtifacts } from "../functions/src/cbam/report/verifier-package-builder";
import {
  REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5,
  REQUIRED_TOP_LEVEL_COMPONENTS_V5,
} from "../functions/src/cbam/report/package-components";
import {
  FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
  buildFourDossierEvidenceFiles,
  createFourDossierCase,
} from "../tests/fixtures/four-dossiers";

function fail(code: string, detail?: string): never {
  console.error(`${code}=FAIL${detail ? `:${detail}` : ""}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const rawCase = createFourDossierCase("STEEL_IN");
  const evidenceFiles = await buildFourDossierEvidenceFiles(rawCase);
  const caseData = AuditReadyCaseSchema.parse(rawCase);
  const calculation = performDossierCalculations(caseData);
  const controls = runQualityControls(caseData);

  const openPeriod = deriveEnterprise1000Model({
    caseData,
    calculation,
    generatedAt: "2026-08-08T12:00:00.000Z",
  });
  if (openPeriod.status !== "NOT_READY" || Number(openPeriod.preparationScore) >= 100) {
    fail("ENTERPRISE_1000_STATUS_CONTRACT", `${openPeriod.status}:${openPeriod.preparationScore}`);
  }

  const closedPeriod = deriveEnterprise1000Model({
    caseData,
    calculation,
    generatedAt: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
  });
  if (closedPeriod.status !== "READY_FOR_VERIFICATION") {
    fail("ENTERPRISE_1000_CLOSED_PERIOD_STATUS", closedPeriod.status);
  }
  if (closedPeriod.scenarios.length < 3) fail("ENTERPRISE_1000_SCENARIO_LAYER");
  if (closedPeriod.materialitySimulation.length !== caseData.goods.length) fail("ENTERPRISE_1000_MATERIALITY_SIMULATION");
  if (closedPeriod.handoverDrafts.length !== 7) fail("ENTERPRISE_1000_HANDOVER_DRAFTS");
  if (closedPeriod.evidenceVerifiability.some((row) => !row.verifiabilityBasis.trim())) fail("ENTERPRISE_1000_EVIDENCE_VERIFIABILITY");
  if (closedPeriod.findings.some((finding) => !finding.action?.requiredAction || !finding.action.priority || !finding.action.responsibleRole || !finding.action.state || !finding.action.closureCondition)) {
    fail("ENTERPRISE_1000_CORRECTIVE_CLOSURE");
  }

  const reportId = `report_${"e".repeat(64)}`;
  const rawArtifacts = await buildUnsignedVerifierArtifacts({
    caseData,
    calculation,
    controls,
    reportId,
    packageCode: "E1000",
    releaseVersion: 1,
    generatedAt: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
    evidenceFiles,
    assessmentContext: {
      generatedAt: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
      assessmentTimestamp: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
      reportId,
      packageCode: "E1000",
      releaseVersion: 1,
      rulesetVersion: calculation.ruleset,
      productCode: "pack_premium_dossier_v5",
      releaseContractVersion: 5,
    },
  });
  const upgraded = upgradeArtifactsToEnterprise1000({
    artifacts: rawArtifacts.filter((item) => !item.path.toLowerCase().endsWith(".pdf")),
    caseData,
    calculation,
    controls,
    reportId,
    packageCode: "E1000",
    releaseVersion: 1,
    generatedAt: FOUR_DOSSIER_ASSESSMENT_TIMESTAMP,
  });

  const pdfs = upgraded.artifacts.filter((item) => item.path.endsWith(".pdf"));
  const pdfHashes = pdfs.map((item) => createHash("sha256").update(item.bytes).digest("hex"));
  if (pdfs.length !== 11 || new Set(pdfHashes).size !== 11) fail("ENTERPRISE_1000_UNIQUE_DOCUMENTS", String(pdfs.length));
  if (pdfs.some((item) => item.path === "Complete Dossier Compilation.pdf")) fail("ENTERPRISE_1000_DUPLICATE_COMPILATION");

  const evidenceCsv = upgraded.artifacts.find((item) => item.path === "Evidence Register.csv")?.bytes.toString("utf8") || "";
  for (const required of ["A-E grade", "Independent verifiability", "Verifiability basis", "Automatic warning"]) {
    if (!evidenceCsv.includes(required)) fail("ENTERPRISE_1000_EVIDENCE_REGISTER", required);
  }
  const actionsCsv = upgraded.artifacts.find((item) => item.path === "Corrective Action Log.csv")?.bytes.toString("utf8") || "";
  for (const required of ["Action", "Priority", "Responsible role", "State", "Closure condition"]) {
    if (!actionsCsv.includes(required)) fail("ENTERPRISE_1000_CORRECTIVE_REGISTER", required);
  }

  if (REQUIRED_TOP_LEVEL_COMPONENT_COUNT_V5 !== 26 || REQUIRED_TOP_LEVEL_COMPONENTS_V5.length !== 26) {
    fail("ENTERPRISE_1000_TOP_LEVEL_CONTRACT");
  }

  console.log("ENTERPRISE_1000_STATUS_CONTRACT=PASS");
  console.log(`ENTERPRISE_1000_OPEN_PERIOD_SCORE=${openPeriod.preparationScore}`);
  console.log("ENTERPRISE_1000_UNIQUE_DOCUMENTS=11");
  console.log("ENTERPRISE_1000_EVIDENCE_VERIFIABILITY=PASS");
  console.log("ENTERPRISE_1000_CORRECTIVE_CLOSURE=PASS");
  console.log(`ENTERPRISE_1000_SCENARIO_LAYER=${closedPeriod.scenarios.length}`);
  console.log(`ENTERPRISE_1000_MATERIALITY_SIMULATION=${closedPeriod.materialitySimulation.length}`);
  console.log("ENTERPRISE_1000_HANDOVER_DRAFTS=7");
  console.log("ENTERPRISE_1000_RELEASE_READY=YES");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
