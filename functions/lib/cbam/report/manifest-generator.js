"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAuditManifest = generateAuditManifest;
exports.generateProprietaryXml = generateProprietaryXml;
const calculator_1 = require("../calculator");
function generateAuditManifest(caseData) {
    const calculations = (0, calculator_1.performDossierCalculations)(caseData);
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
function generateProprietaryXml(caseData) {
    // Generates CBAMValid Proprietary XML 
    // explicitly NOT labelled as official EU Registry XML as per user mandate
    const calculations = (0, calculator_1.performDossierCalculations)(caseData);
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
//# sourceMappingURL=manifest-generator.js.map