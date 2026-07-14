import { AuditReadyCase } from "../schema";
import { performDossierCalculations } from "../calculator";

export function generateAuditManifest(caseData: AuditReadyCase): string {
  const calculations = performDossierCalculations(caseData);
  
  const manifest = {
    _meta: {
      generator: "CBAMValid Enterprise Framework",
      version: "2.0.0",
      generatedAt: new Date().toISOString(),
      documentStatus: caseData.status,
      caseId: caseData.caseId,
      sealVersion: caseData.version,
    },
    regulatoryScope: {
      reportingYear: caseData.reportingPeriod.year.value,
      reportingQuarter: caseData.reportingPeriod.quarter.value,
      importerEori: caseData.importerIdentity.eoriNumber.value,
    },
    systemBoundaries: {
      installationName: caseData.installation.name.value,
      productionRoute: caseData.installation.productionRoute.value,
    },
    verificationReadiness: {
      gapsRemaining: caseData.gapAssessment.filter(g => g.resolutionStatus !== "RESOLVED").length,
      isSealed: caseData.status === "SEALED"
    },
    calculationLineage: calculations.trace.map(t => ({
      formulaId: t.formulaId,
      outputValue: t.outputValue,
      hash: t.calculationHash
    }))
  };

  return JSON.stringify(manifest, null, 2);
}

export function generateProprietaryXml(caseData: AuditReadyCase): string {
  // Generates CBAMValid Proprietary XML 
  // explicitly NOT labelled as official EU Registry XML as per user mandate
  const calculations = performDossierCalculations(caseData);

  return `<?xml version="1.0" encoding="UTF-8"?>
<CBAMValidDossier xmlns="urn:cbamvalid:schema:v2">
  <Disclaimer>This XML is a proprietary data export of the CBAMValid system and does not constitute an official European Commission CBAM Registry submission file.</Disclaimer>
  <CaseData>
    <CaseId>${caseData.caseId || ""}</CaseId>
    <Status>${caseData.status}</Status>
    <Version>${caseData.version}</Version>
  </CaseData>
  <Declarant>
    <EORI>${caseData.importerIdentity.eoriNumber.value || ""}</EORI>
  </Declarant>
  <Calculations>
    <TotalEmbeddedEmissions unit="tCO2e">${calculations.totalEmbeddedEmissions}</TotalEmbeddedEmissions>
  </Calculations>
</CBAMValidDossier>`;
}
