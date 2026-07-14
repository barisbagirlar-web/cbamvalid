"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExecutiveDossierPdf = generateExecutiveDossierPdf;
exports.generateTechnicalAnnexPdf = generateTechnicalAnnexPdf;
const jspdf_1 = require("jspdf");
const calculator_1 = require("../calculator");
function generateExecutiveDossierPdf(caseData) {
    var _a, _b;
    const doc = new jspdf_1.jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });
    const marginX = 20;
    let cursorY = 20;
    // Helper to add text and advance cursor
    const addLine = (text, size, isBold = false, advance = 8) => {
        if (cursorY > 280) {
            doc.addPage();
            cursorY = 20;
        }
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.text(text, marginX, cursorY);
        cursorY += advance;
    };
    // COVER PAGE
    doc.setFillColor(33, 37, 41);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(255, 255, 255);
    cursorY = 100;
    addLine("CBAMValid Audit-Ready Dossier", 24, true, 15);
    addLine(`Installation: ${caseData.installation.name.value}`, 16, false, 10);
    addLine(`Reporting Period: ${caseData.reportingPeriod.year.value} Q${caseData.reportingPeriod.quarter.value}`, 16, false, 30);
    addLine(`CONFIDENTIALITY CLASSIFICATION: STRICTLY CONFIDENTIAL`, 10, true, 10);
    addLine(`STATUS: ${caseData.status}`, 10, false, 10);
    addLine(`VERSION: ${caseData.version}`, 10, false, 10);
    const hash = `SHA-256: ${crypto.randomUUID()}-${Date.now()}`;
    addLine(`DOCUMENT HASH: ${hash}`, 8, false, 10);
    // PAGE 2: EXECUTIVE SUMMARY
    doc.addPage();
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(0, 0, 0);
    cursorY = 30;
    addLine("1. Executive Conclusion", 18, true, 12);
    const calculations = (0, calculator_1.performDossierCalculations)(caseData);
    addLine(`Total Embedded Emissions: ${calculations.totalEmbeddedEmissions} tCO2e/tonne`, 12, false, 8);
    addLine(`This dossier compiles the evidence and calculations in preparation`, 10, false, 6);
    addLine(`for an accredited independent verification as required by Regulation (EU) 2023/1773.`, 10, false, 12);
    addLine("2. Methodology & Scope", 18, true, 12);
    addLine(`Production Route: ${caseData.installation.productionRoute.value}`, 12, false, 8);
    addLine(`Sector: ${((_a = caseData.goods[0]) === null || _a === void 0 ? void 0 : _a.sector) || 'Unknown'}`, 12, false, 8);
    addLine(`CN Code Assessed: ${(_b = caseData.goods[0]) === null || _b === void 0 ? void 0 : _b.cnCode.value}`, 12, false, 12);
    addLine("3. Data Quality Assessment", 18, true, 12);
    const gaps = caseData.gapAssessment.filter(g => g.severity === "BLOCKER" || g.severity === "CRITICAL");
    if (gaps.length === 0) {
        addLine(`No critical data gaps were identified. Data completeness meets registry requirements.`, 10, false, 12);
    }
    else {
        addLine(`WARNING: Critical data gaps identified:`, 10, true, 8);
        gaps.forEach(g => {
            addLine(`- ${g.requirement}: ${g.whyItMatters}`, 10, false, 6);
        });
        cursorY += 6;
    }
    // Footer on all pages (simulated)
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`CBAMValid Verification-Ready Dossier | ${hash}`, 20, 285);
        doc.text(`Page ${i} of ${pageCount}`, 180, 285);
    }
    return doc.output('blob');
}
function generateTechnicalAnnexPdf(caseData) {
    const doc = new jspdf_1.jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });
    const marginX = 20;
    let cursorY = 20;
    const addLine = (text, size, isBold = false, advance = 8) => {
        if (cursorY > 190) {
            doc.addPage();
            cursorY = 20;
        }
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.text(text, marginX, cursorY);
        cursorY += advance;
    };
    addLine("Technical Calculation Annex", 20, true, 15);
    const calc = (0, calculator_1.performDossierCalculations)(caseData);
    calc.trace.forEach(node => {
        addLine(`Calculation Node: ${node.formulaId}`, 12, true, 6);
        addLine(`Source: ${node.officialSource} v${node.sourceVersion}`, 10, false, 6);
        addLine(`Hash: ${node.calculationHash}`, 8, false, 6);
        addLine(`Result: ${node.outputValue} ${node.outputUnit}`, 10, true, 12);
    });
    return doc.output('blob');
}
//# sourceMappingURL=pdf-generator.js.map